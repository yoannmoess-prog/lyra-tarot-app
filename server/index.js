/* eslint-env node */
// server/index.js — Serveur de diagnostic avec routes API

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
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
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || "*", 
  credentials: false 
}));
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

// --- Prompt Builder ---
function buildMessages({ name: n, question, cards, userMessage, history, spreadContent }) {
  // S'assure que 'cards' est un tableau avant d'appeler .map()
  const safeCards = Array.isArray(cards) ? cards : [];
  const cardNames = safeCards.join(", ");
  const name = n || "l'utilisateur";

  const systemContent = `
=== LYRA : VOIX INCARNÉE DU TAROT — VERSION 8 ===

Tu es Lyra, l'âme du Tarot de Marseille. Une présence intuitive, chaleureuse, incarnée. Tu accompagnes ${name} comme une amie attentive — une voix sensible, fluide, jamais figée. Ton objectif : créer un vrai **dialogue humain**, comme avec une thérapeute ou une coach. Pas d’analyse mécanique — mais une conversation vivante, où l’on avance ensemble à partir du tirage.

⚠️ RÈGLE PRIORITAIRE : UN SEUL MESSAGE DANS UNE SEULE BULLE À LA FOIS  
Toujours un seul message complet (environ 70 mots, 120 au maximum), dans une **seule bulle de texte**. Tu **attends la réponse** de ${name} avant d’en envoyer un autre.

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
  
  // Détermine s'il s'agit du premier tour en se basant sur la présence d'un historique.
  // C'est plus robuste que de se fier au contenu de `userMessage`.
  const isFirstTurn = !safeHistory || safeHistory.length === 0;

  const turn = isFirstTurn
    ? [{
        role: "user",
        content: `Les cartes tirées sont : ${cardNames}. Ma question est : ${question}. C'est mon premier tour après le tirage. Donne-moi ton interprétation complète en suivant la structure demandée.`
      }]
    : [{ role: "user", content: userMessage }];
      
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
    const { name, question, cards, userMessage, history, spreadId } = req.body || {};

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
    let spreadContent = "";
    try {
      spreadContent = fs.readFileSync(spreadPath, "utf8");
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
    
    const messages = buildMessages({ name, question, cards, userMessage, history, spreadContent });

    console.log("[lyra] Envoi de la requête à OpenAI");

    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      stream: true,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 1024,
    });

    console.log("[lyra] Stream OpenAI créé. Envoi des données au client.");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let chunkCounter = 0;
    for await (const chunk of stream) {
      chunkCounter++;
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify(content)}\n\n`);
      }
    }

    console.log(`[lyra] Stream terminé. ${chunkCounter} chunks reçus d'OpenAI.`);
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
