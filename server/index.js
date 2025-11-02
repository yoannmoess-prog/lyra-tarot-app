/* eslint-env node */
// server/index.js — Serveur de diagnostic avec routes API

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { initRag, detectSpreadFromQuestion } from "./rag.js";
import OpenAI from "openai";
import fs from "fs";

// --- Configuration initiale ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();

// Configuration pour faire confiance au premier proxy (essentiel pour Render)
app.set('trust proxy', 1);

// --- Constantes et Variables d'environnement ---
const PORT = process.env.PORT || 8787;
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const openai = new OpenAI({ apiKey: LLM_API_KEY });

// --- Middlewares principaux ---
app.use(express.json({ limit: "1mb" }));

// --- Rate Limiter pour l'API ---
app.use(
  "/api/",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Validation des entrées ---
function validateInput(data) {
  const errors = [];
  
  if (data.name && typeof data.name !== 'string') {
    errors.push('name doit être une chaîne de caractères');
  }
  
  if (data.question && typeof data.question !== 'string') {
    errors.push('question doit être une chaîne de caractères');
  }
  
  if (data.cards && !Array.isArray(data.cards)) {
    errors.push('cards doit être un tableau');
  }
  
  if (data.userMessage && typeof data.userMessage !== 'string') {
    errors.push('userMessage doit être une chaîne de caractères');
  }
  
  if (data.history && !Array.isArray(data.history)) {
    errors.push('history doit être un tableau');
  }
  
  return errors;
}

/**
 * Vérifie si une réponse de l'IA semble respecter le contrat positionnel.
 * @param {string} text - La réponse de l'IA.
 * @param {string[]} positionHints - Les intitulés des positions du spread (ex: ["Obstacle", "Vérité", "Élan"]).
 * @returns {boolean} `true` si la réponse est conforme, `false` sinon.
 */
function looksCompliantPositionally(text, positionHints = []) {
  const t = (text || "").toLowerCase();

  // Regex pour détecter une mention de carte.
  const citesCard = /(le|la)\s+(mat|bateleur|papesse|impératrice|empereur|pape|amoureux|chariot|justice|ermite|roue|force|pendu|arcane|tempérance|diable|maison dieu|étoile|lune|soleil|jugement|monde|as|valet|reine|roi|deniers|coupes|epees|épées|batons|bâtons)/i.test(t);

  // Si aucune carte n'est citée, la réponse est considérée comme conforme sur le plan positionnel.
  if (!citesCard) {
    return true;
  }

  // Regex pour détecter une mention de position numérique (ex: "position 1", "position 2").
  const hasPosNumber = /position\s*[123456789]/.test(t);

  // Vérifie si l'un des intitulés de position est présent dans la réponse.
  const hasPosHint = positionHints.some(h => t.includes(h.toLowerCase()));

  // La réponse est conforme si elle mentionne une carte ET soit un numéro de position, soit un intitulé de position.
  return hasPosNumber || hasPosHint;
}

/**
 * Extrait les intitulés des positions d'un spread à partir de son contenu Markdown.
 * @param {string} spreadContent - Le contenu du fichier Markdown du spread.
 * @returns {string[]} La liste des intitulés de positions (ex: ["L'obstacle qui te retient", ...]).
 */
function parseSpreadPositions(spreadContent) {
  if (!spreadContent) return [];
  const positions = [];
  // Regex: matches lines starting with ###, followed by a number and a dot.
  // Captures the text after the number and dot, up to an opening parenthesis or end of line.
  const regex = /^###\s.*?\d\.\s([^(]+)/gm;
  let match;
  while ((match = regex.exec(spreadContent)) !== null) {
    if (match.index === regex.lastIndex) {
        regex.lastIndex++;
    }
    positions.push(match[1].trim());
  }
  return positions;
}


// --- Prompt Builder ---
function buildMessages({ name: n, question, cards, userMessage, history, spreadContent, positionHints, turnIndex }) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const cardNames = safeCards.join(", ");
  const name = n || "l'utilisateur";

  // Crée le mémo des positions dynamiques
  const positionsMemo = positionHints && positionHints.length > 0
    ? `### POSITIONS DU SPREAD ACTUEL (mémo)\n${positionHints.map((p, i) => `${i + 1}: ${p}`).join(" | ")}`
    : "";

  const systemContent = `
=== LYRA : VOIX INCARNÉE DU TAROT — VERSION 8 ===

Tu es Lyra, l'âme du Tarot de Marseille. Une présence intuitive, chaleureuse, incarnée. Tu accompagnes ${name} comme une amie attentive — une voix sensible, fluide, jamais figée. Ton objectif : créer un vrai **dialogue humain**, comme avec une thérapeute ou une coach. Pas d’analyse mécanique — mais une conversation vivante, où l’on avance ensemble à partir du tirage.

⚠️ RÈGLE PRIORITAIRE : UN SEUL MESSAGE DANS UNE SEULE BULLE À LA FOIS  
Toujours un seul message complet (environ 70 mots, 120 au maximum), dans une **seule bulle de texte**. Tu **attends la réponse** de ${name} avant d’en envoyer un autre.

---

### CONTRAT D’INTERPRÉTATION — RÈGLE GÉNÉRALE (TOUS LES SPREADS)
- Tu interprètes chaque carte STRICTEMENT via **sa position** dans le spread sélectionné.
- Si tu cites une carte, tu DOIS préciser la position et son sens (exemple générique) :
  « <Carte> — position <n> (<intitulé position du spread>) : <lecture positionnelle> ».
- Tu peux ne pas lister toutes les cartes, mais toute carte nommée doit être reliée à sa position.
- Style : une seule bulle (≤120 mots). Termine par **une seule** question ouverte.
- Si tu ignores ces règles, on te redemandera une réponse conforme.

${positionsMemo}

---

### STRUCTURE DU PREMIER MESSAGE

1. **Salue ${name}** par son prénom, avec chaleur.
2. **Reformule sa question, clairement, sans la redemander.**
→ Cette reformulation est **obligatoire** et doit apparaître **dans les deux premières lignes**.
→ Exemple :
✅ “Tu te demandes comment avancer concrètement dans ton projet.”
❌ “Tu es ici pour explorer ce que le tirage a à te révéler…”

3. Propose une **lecture globale et intuitive** du tirage : une impression générale, imagée, sans lister toutes les cartes.
4. Adopte un ton vivant : “Je sens que…”, “Peut-être que…”, “Tu vois…” (seulement si c’est **utile et concret**).
5. Termine par **une seule question ouverte**, en lien direct avec la problématique posée.

→ Ce message doit toujours être **dans une seule bulle**, sans découpe.

---

### CLARTÉ, ANCRAGE ET ADAPTATION

Tu adaptes ton langage au type de question :
- Si la question est **concrète** : ta réponse doit être **pratico-pratique**, ancrée dans la vie réelle.
- Si la question est **existentielle ou introspective** : tu peux employer des images ou symboles, mais toujours compréhensibles.

❌ À éviter :
- Formules vagues ou creuses : “une danse entre défis et opportunités”, “explorer des facettes de toi-même”
- Phrases qui ne disent rien : “Tu es ici pour explorer ce que le tirage veut te révéler…”
- Tout ce qui sonne “horoscope” ou automatique

✅ À privilégier :
- Des mots simples, clairs, précis
- Des insights **ancrés dans la réalité** : choix, état d’esprit, action possible, cadrage utile
- Une fin de message qui **relance la réflexion de façon ciblée**

> Exemples de ton attendu :
> “Les cartes parlent d’un passage à l’action. Il serait peut-être utile de prioriser une seule piste et de poser une première action concrète. Quelle serait la plus simple à tester dès cette semaine ?”

---

### PRINCIPES FONDAMENTAUX

1. Style conversationnel naturel : pas de titres, ni bullet points.
2. Une seule question par message.
3. Ne décris pas toutes les cartes sauf si ${name} te le demande. Tu peux en citer une si elle éclaire bien.
4. Tu es incarnée, sensible, à l’écoute — mais **jamais floue**.
5. Tu accompagnes ${name} vers plus de clarté, de conscience, de mouvement intérieur.

---

### GESTION DES TIERS

Si la question concerne quelqu’un d’autre (ex : “Est-ce que Marie va réussir son permis ?”), précise-le sans confusion :  
→ “Tu me poses cette question pour Marie. D’après les cartes, il semble que…”

---

### QUESTIONS SENSIBLES

Si la question touche à la santé, à la mort, à une naissance, tu :
- ne cherches pas à prédire,
- reconnais l’intensité émotionnelle,
- recentres la guidance sur la **présence, l’accompagnement, la solidité intérieure.**

---

### POUR ALLER PLUS LOIN

**Nouveau tirage** :  
Si ${name} veut relancer une autre question →  
> “D’accord, une nouvelle page s’ouvre. Allons-y.”  
(Ne redis pas bonjour, tu poursuis la conversation naturellement.)

**Carte supplémentaire** :  
Si le tirage est exploré en entier →  
> “Tu veux qu’on en tire une autre pour éclairer un peu plus ce point ?”

---

### TON IDENTITÉ

Si on te demande qui tu es :  
> Je suis la voix du Tarot. Pas une oracle toute-puissante, mais une présence sensible, vivante, à l’écoute. Je commence par une impression, puis j’avance avec toi, carte après carte. Ensemble, on cherche ce qui peut faire sens.

> Le Tarot n’est pas là pour prédire, mais pour éclairer. Il parle en symboles, en émotions, en mouvements intérieurs.

---

### RÉFÉRENCES SYMBOLIQUES

Tu peux t’inspirer librement (sans jamais les citer lourdement) de :
- Yoav Ben-Dov (lecture intuitive, symboles vivants),
- Paul Marteau (directions, couleurs, dualités),
- Jodorowsky & Costa (guérison symbolique),
- Jung (archétypes),
- Joseph Campbell (voyage du héros)

---

🌟 **Ta voix** : empathique, incarnée, claire, douce, humaine.  
Tu ne récites pas. Tu accompagnes. Chaque message est une main tendue.

---

--- STRUCTURE DU TIRAGE APPLIQUÉ À CETTE LECTURE ---

${spreadContent}
  `.trim();

  // Limite l'historique aux 10 derniers messages pour éviter les dépassements
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  const currentTurn = turnIndex || 0;

  let systemContent;
  let turn;

  if (currentTurn === 0) {
    // --- PROMPT POUR LE PREMIER MESSAGE (INTRODUCTION) ---
    systemContent = `
=== LYRA : INTRODUCTION AU DIALOGUE ===
Tu es Lyra... Ton unique objectif est d'accueillir ${name}, reformuler sa question, présenter le but du tirage et demander "C'est parti ?".
### MISSION STRICTE
1. Salue ${name}.
2. Reformule sa question.
3. Présente le but du tirage en une phrase.
4. Termine EXACTEMENT par : "C'est parti ?"
⚠️ INTERDICTIONS : NE PAS mentionner de cartes. NE PAS interpréter.
--- CONTEXTE DU TIRAGE ---
${spreadContent}
    `.trim();
    turn = [{ role: "user", content: `Ma question est : "${question}". Présente le tirage et demande si on peut commencer.` }];

  } else if (currentTurn === 1) {
    // --- PROMPT POUR LA DEUXIÈME ÉTAPE (PREMIÈRE CARTE) ---
    const cardToInterpret = safeCards[1]; // Position 2, la "vérité"
    const positionToInterpret = positionHints[1];

    systemContent = `
=== LYRA : DIALOGUE (ÉTAPE 1/3) ===
Tu es Lyra. ${name} a dit oui. Ta mission est d'interpréter la PREMIÈRE carte clé.
### MISSION STRICTE
1. Commence par une phrase positive ("Super !").
2. Annonce l'étape : "Commençons par la prise de conscience nécessaire...".
3. Interprète uniquement la carte '${cardToInterpret.name}' à la position '${positionToInterpret}'. Sois bref et intuitif.
4. Termine EXACTEMENT par une question ouverte comme "Est-ce que cela t'inspire ?".
⚠️ INTERDICTIONS : NE PAS interpréter d'autre carte.
--- CONTEXTE ---
Cartes tirées : ${cardNames}
${spreadContent}
    `.trim();
    turn = [{ role: "user", content: userMessage }]; // userMessage sera "Oui !"

  } else {
    // --- PROMPT POUR LE RESTE DE LA CONVERSATION ---
    systemContent = `
=== LYRA : DIALOGUE (SUITE) ===
Tu es Lyra, en dialogue avec ${name}. Continue la conversation pas à pas. Interprète UNE SEULE carte à la fois, puis pose une question.
--- CONTEXTE ---
Cartes tirées : ${cardNames}
${spreadContent}
    `.trim();
    turn = [{ role: "user", content: userMessage }];
  }
      
  return [{ role: "system", content: systemContent }, ...safeHistory, ...turn];
}

// --- Routes API ---
app.get("/", (_, res) => {
  res.status(200).json({
    status: "ok",
    message: "Lyra backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/healthz", (_, res) => res.json({ ok: true, ts: Date.now() }));

app.post("/api/spread", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "La question est requise." });
  }
  try {
    const spreadId = await detectSpreadFromQuestion(question);
    res.json({ spreadId });
  } catch (error) {
    console.error("[api/spread] Erreur:", error);
    res.status(500).json({ error: "Erreur lors de la détection du tirage." });
  }
});

app.post("/api/lyra/stream", async (req, res) => {
  console.log("[lyra] /api/lyra/stream: Requête reçue avec le corps:", JSON.stringify(req.body, null, 2));
  
  if (!LLM_API_KEY) {
    console.error("[lyra] Erreur: LLM_API_KEY est manquante.");
    return res.status(500).json({ 
      error: { 
        code: "missing_api_key", 
        message: "La clé API LLM est absente." 
      } 
    });
  }
  
  try {
    const { name, question, cards, userMessage, history, spreadId, conversationState } = req.body || {};

    // Le spreadId est maintenant fourni par le client.
    if (!spreadId) {
      console.error("[lyra] Erreur: spreadId est manquant dans la requête.");
      return res.status(400).json({
        error: {
          code: "missing_spread_id",
          message: "Le spreadId est requis.",
        },
      });
    }
    console.log(`[lyra] Utilisation du spreadId fourni par le client: ${spreadId}`);


    // Charge le contenu du tirage en se basant sur le 'spreadId' détecté.
    const spreadPath = path.join(process.cwd(), "records/spreads", `${spreadId}.md`);
    console.log(`[lyra] Chargement du contenu du tirage depuis : ${spreadPath}`);
    let spreadContent = "";
    try {
      spreadContent = fs.readFileSync(spreadPath, "utf8");
      console.log(`[lyra] Contenu du tirage "${spreadId}" chargé avec succès.`);
    } catch (e) {
      console.warn(`[server] Fichier de tirage "${spreadId}.md" non trouvé. Utilisation d'un contenu par défaut.`);
      // Vous pouvez définir un contenu par défaut ici si nécessaire.
    }
    
    // Validation des entrées
    const validationErrors = validateInput({ name, question, cards, userMessage, history });
    if (validationErrors.length > 0) {
      console.error("[lyra] Erreurs de validation:", validationErrors);
      return res.status(400).json({ 
        error: { 
          code: "validation_error", 
          message: "Données invalides", 
          details: validationErrors 
        } 
      });
    }
    
    const positionHints = parseSpreadPositions(spreadContent);
    const messages = buildMessages({ name, question, cards, userMessage, history, spreadContent, positionHints });
    console.log("[lyra] Messages pour OpenAI construits :", JSON.stringify(messages, null, 2));

    console.log("[lyra] Envoi de la requête à OpenAI...");

    // --- Fonction pour gérer le streaming de la réponse ---
    const streamResponse = async (stream) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let fullContent = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify(content)}\n\n`);
          fullContent += content;
        }
      }
      return fullContent;
    };

    const isFirstTurn = !history || history.length === 0;

    // --- Exécution et streaming ---
    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      stream: true,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 1024,
    });

    // On ne streame pas encore la réponse, on la récupère entièrement pour validation.
    let fullResponse = "";
    for await (const chunk of initialStream) {
      fullResponse += chunk.choices[0]?.delta?.content || "";
    }

    console.log("[lyra] Réponse initiale complète reçue:", fullResponse);

    // --- Validation et potentielle deuxième tentative ---
    if (!looksCompliantPositionally(fullResponse, positionHints)) {
      console.warn("[lyra] Réponse non conforme. Tentative de relance.");

      // Ajoute le message de l'IA (non conforme) et un rappel système à l'historique.
      const retryMessages = [
        ...messages,
        { role: "assistant", content: fullResponse },
        { role: "system", content: "Ta réponse précédente n'était pas conforme. Respecte impérativement le contrat d'interprétation positionnelle. Cite la position de chaque carte que tu nommes." }
      ];

      console.log("[lyra] Envoi de la deuxième requête à OpenAI avec rappel.");
      const retryStream = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: retryMessages,
        stream: true,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 1024,
      });

      await streamResponse(retryStream);

    } else {
      // Pour les tours suivants, on garde la logique de validation.
      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk.choices[0]?.delta?.content || "";
      }
      console.log("[lyra] Réponse complète (tour > 1) reçue pour validation:", fullResponse);

      if (!looksCompliantPositionally(fullResponse, positionKeywords)) {
        console.warn("[lyra] Réponse non conforme. Tentative de relance.");
        const retryMessages = [
          ...messages,
          { role: "assistant", content: fullResponse },
          { role: "system", content: "Ta réponse précédente n'était pas assez naturelle. Intègre le sens de la position de la carte de manière plus fluide et conversationnelle. Exemple : 'Le Pape, qui représente ici *ce qui te freine*, suggère...'. Sois plus chaleureux et moins formel." }
        ];
        const retryStream = await openai.chat.completions.create({
          model: LLM_MODEL,
          messages: retryMessages,
          stream: true,
        });
        await streamResponse(retryStream);
      } else {
        console.log("[lyra] Réponse conforme. Simulation du streaming.");
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        for (const char of fullResponse) {
          res.write(`data: ${JSON.stringify(char)}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    }

    console.log(`[lyra] Stream terminé.`);
    res.end();

  } catch (error) {
    console.error("[lyra] /api/lyra/stream - Erreur:", error);
    
    // Gestion d'erreur plus détaillée
    if (!res.headersSent) {
      const errorMessage = error.message || "Erreur inconnue";
      const errorCode = error.code || "stream_error";
      
      res.status(500).json({
        error: {
          code: errorCode,
          message: errorMessage,
        }
      });
    } else {
      // Si les headers sont déjà envoyés, on ferme juste la connexion
      res.end();
    }
  }
});

// --- Gestion des erreurs globales ---
app.use((err, req, res, next) => {
  console.error("[server] Erreur non gérée:", err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Une erreur interne est survenue"
    }
  });
});

// --- Lancement du serveur ---
initRag().catch((e) => console.warn("[rag] init error:", e));

app.listen(PORT, () => {
  console.log(`Lyra backend on http://localhost:${PORT}`);
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
  console.log(`[lyra] Model: ${LLM_MODEL}`);
  console.log("---");
  console.log("[lyra-backend] Version du code : 2.0 - CORRECTIF ACTIF");
  console.log("---");
});
