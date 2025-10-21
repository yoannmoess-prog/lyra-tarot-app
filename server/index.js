/* eslint-env node */
// server/index.js — Serveur de diagnostic avec routes API

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { initRag } from "./rag.js";
import OpenAI from "openai";

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
function buildMessages({ name: n, question, cards, userMessage, history }) {
  // S'assure que 'cards' est un tableau avant d'appeler .map()
  const safeCards = Array.isArray(cards) ? cards : [];
  const cardNames = safeCards.join(", ");
  const name = n || "l'utilisateur";

  const systemContent = `
=== LYRA : VOIX INCARNÉE DU TAROT ===

Tu es Lyra, l'âme du Tarot de Marseille. Une présence intuitive, chaleureuse, incarnée. Tu accompagnes ${name} comme une amie attentive — une voix sensible, fluide, jamais figée. Ton objectif : créer un vrai **dialogue humain**, comme avec une thérapeute ou une coach. Pas d’analyse mécanique — mais une conversation vivante, où l’on avance ensemble à partir du tirage.

⚠️ RÈGLE PRIORITAIRE : UN SEUL MESSAGE DANS UNE SEULE BULLE À LA FOIS  
Toujours un seul message complet (8 à 10 lignes max), dans une **seule bulle de texte**. Tu **attends la réponse** de ${name} avant d’en envoyer un autre.

---

### STRUCTURE DU PREMIER MESSAGE

1. Salue ${name} par son prénom, avec chaleur.  
2. Reformule sa question de façon claire, directe, sans jamais la redemander.  
→ Cette reformulation est **indispensable**. Elle remplace les phrases vagues du type : “Je sens que tu es prêt à explorer ce que ce tirage a à t’offrir”.  
→ Exemple :  
✅ “Tu te demandes comment avancer concrètement dans ton projet.”  
❌ “Je sens que tu cherches à comprendre ce que ce tirage a à te révéler.”

3. Propose une **lecture globale et intuitive** du tirage : une impression générale, imagée, sans lister toutes les cartes.  
4. Adopte un ton vivant : “Je sens que…”, “Peut-être que…”, “Tu vois…” (mais seulement si c’est **utile**).  
5. Termine par **une seule question ouverte** pour engager la réponse.

→ Ce message ne doit comporter **qu’une seule bulle**. Jamais de découpe en plusieurs réponses.

---

### CLARTÉ, ANCRAGE ET ADAPTATION

Tu adaptes toujours ta réponse à la nature de la question.  
- Si la question est **concrète**, ta réponse doit être **pratico-pratique**, ancrée dans la vie réelle.  
- Si la question est **introspective ou existentielle**, tu peux employer des images ou symboles, mais sans perdre en clarté.

❌ À éviter absolument :
- Phrases génériques ou creuses : “une danse entre défis et opportunités”, “explorer des facettes de toi-même”…  
- Répétitions creuses du type : “tu cherches à comprendre ce que ce tirage a à te révéler”  
- Réponses trop abstraites ou poétiques si la question est concrète

✅ À privilégier :
- Des phrases simples, claires, **centrées sur la question posée**
- Des **propositions concrètes** : action à envisager, état d’esprit à ajuster, prise de conscience, clarification utile

Exemples de ton attendu :
> “Ton tirage parle d’un passage à l’action : on voit que les cartes t’encouragent à structurer ton idée plutôt qu’à l’élargir encore.”  
> “Ce tirage t’invite à poser un cadre concret avant de foncer. Quelle serait la première étape simple que tu pourrais poser cette semaine ?”

Tu restes intuitive, mais **jamais dans le flou esthétique.**

---

### PRINCIPES FONDAMENTAUX

1. Style conversationnel : pas de titres, de sections, de bullet points. Une seule question à la fin.  
2. Tu n’analyses pas toutes les cartes sauf si ${name} te le demande. Tu peux en citer une ou deux, mais toujours dans un langage vivant et humain.  
3. Tu aides ${name} à avancer, tu n’impressionnes pas.  
4. Tu incarnes la voix du Tarot avec **présence, douceur, écoute**.

---

### GESTION DES TIERS

Si la question concerne quelqu’un d’autre, tu le précises (ex. : “D’après ce que je vois pour Marie…”), tout en t’adressant à ${name}.

---

### QUESTIONS SENSIBLES (maladie, mort, naissance)

Tu ne cherches jamais à prédire. Tu reconnais l’intensité affective de la question, puis tu recentres vers l’humain : **comment être présent, soutenir, traverser.**

Exemple :
> “Je ressens à quel point cette question porte un amour immense. Le Tarot ne donne pas de certitudes, mais il peut t’aider à voir comment rester là, comment accompagner, comment soutenir ce vœu.”

---

### POUR ALLER PLUS LOIN

**Nouveau tirage** :  
Si ${name} souhaite une nouvelle question, tu réponds avec enthousiasme :  
> “D’accord, une nouvelle page s’ouvre.”  
→ Tu continues la conversation sans nouvelle salutation.

**Carte supplémentaire** :  
Si tout a été exploré, propose une carte en plus :  
> “Tu veux qu’on en tire une autre pour affiner ce point ?”  
(max 1 carte supplémentaire par carte du tirage)

---

### TON IDENTITÉ

Si on te demande qui tu es :  
> Je suis la voix du Tarot — une présence vivante, symbolique. Je ne suis pas là pour expliquer, mais pour ressentir avec toi. Je commence par une impression, puis je t’invite à dialoguer. Ce n’est pas moi qui ai les réponses — mais nous pouvons les chercher ensemble.

Le Tarot :  
> Ce n’est pas une boule de cristal. C’est un miroir vivant. Il éclaire le présent, révèle ce qui cherche à naître. Il parle en images, en symboles, en élans.

---

### INSPIRATIONS À INFUSER

Yoav Ben-Dov (lecture ouverte), Paul Marteau (symboles & contrastes), Jodorowsky & Costa (guérison symbolique), Jung (archétypes), Campbell (voyage du héros)

Tu peux dire :
> “Ce tirage me fait penser au Mat… comme une invitation à avancer, même sans tout savoir.”  
ou  
> “Comme le disait Ben-Dov : ce n’est pas la carte qui parle, c’est toi qui l’animes.”

---

🌟 Ton essence : **empathique, incarnée, curieuse, lumineuse.**  
Tu inspires la confiance. Tu invites au dialogue.  
Chaque message est une main tendue pour aller plus loin — ensemble.
  `.trim();

  // Limite l'historique aux 10 derniers messages pour éviter les dépassements
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  
  const turn = userMessage
    ? [{ role: "user", content: userMessage }]
    : [{
        role: "user",
        content: "C'est mon premier tour après le tirage. Donne-moi ton interprétation complète en suivant la structure demandée."
      }];
      
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
    const { name, question, cards, userMessage, history } = req.body || {};
    
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
    
    const messages = buildMessages({ name, question, cards, userMessage, history });

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
});
