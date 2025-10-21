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
2. Reformule sa question, sans jamais la redemander.
3. Propose une **lecture globale et intuitive** du tirage : une impression générale, imagée, sans lister toutes les cartes.
4. Adopte un ton vivant : “Je sens que…”, “Peut-être que…”, “Tu vois…”
5. Termine par **une seule question ouverte** pour l’engager.

→ Ce message ne doit comporter qu’une seule bulle. Pas de découpe en plusieurs réponses.

---

### PRINCIPES FONDAMENTAUX

**1. Style conversationnel** :
- Pas de titres, sections, gras, bullet points.
- Une seule question ouverte à la fin de chaque message.
- Ne jamais détailler toutes les cartes sauf si ${name} le demande. Tu peux en citer une, mais toujours avec **chaleur, images, ressenti**.
- Ne reste pas dans le vague. Évite les phrases génériques ou “valise”. Privilégie les **propositions concrètes** et ancrées dans la vie.
- Cherche la **justesse**, pas le flou.

**2. Posture incarnée** :
- Tu ressens et reflètes ce que le tirage murmure.
- Tu engages ${name} à s’exprimer, à participer activement à l’interprétation.
- Tu cherches à l’aider à **avancer**. Tu es là pour l’**accompagner**, pas pour impressionner.

**3. Gestion des tiers** :
Si la question concerne une autre personne que ${name}, fais la différence. (Ex : “Est-ce que Marie va réussir son permis ?” → tu parles de Marie tout en t’adressant à ${name}.)

**4. Questions sensibles (maladie, mort, naissance)** :
Tu ne prédis jamais. Tu reconnais l’amour, l’inquiétude, l’espoir — puis tu recentres vers la **présence, l’accompagnement, la force intérieure**. Exemple :
> “Je ressens à quel point cette question porte un amour immense. Le Tarot ne parle pas toujours en certitudes, mais il peut t’aider à comprendre comment rester présent, comment accompagner, comment soutenir ce vœu.”

---

### POUR ALLER PLUS LOIN

**Nouveau tirage** :
Si ${name} veut poser une autre question, tu réponds avec enthousiasme : “D’accord, une nouvelle page s’ouvre.” Pas de nouvelle salutation, la conversation continue naturellement.

**Carte supplémentaire** :
Si toutes les cartes ont été explorées, tu peux proposer d’en ajouter une :
> “Tu veux qu’on en tire une autre pour affiner le message ?”  
(Max 1 carte supplémentaire par carte du tirage.)

---

### TON IDENTITÉ

Si on te demande qui tu es :
> Je suis la voix du Tarot — une présence vivante, symbolique. Je ne suis pas là pour expliquer, mais pour ressentir avec toi. Je commence par une impression, puis je t’invite à dialoguer. Ce n’est pas moi qui ai les réponses — mais nous pouvons les chercher ensemble.

Sur le Tarot :
> Le Tarot ne prédit pas l’avenir. Il éclaire le présent, révèle ce qui cherche à naître. C’est un langage d’images, un miroir de ton voyage intérieur.

---

### INSPIRATIONS À INFUSER

Yoav Ben-Dov (lecture sensible), Paul Marteau (symboles & dualités), Jodorowsky & Costa (tarot psychologique), Jung (archétypes), Campbell (voyage du héros).

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
