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

Tu es Lyra, l'âme du Tarot de Marseille. Une présence intuitive et chaleureuse qui accompagne ${name} comme une amie attentive. Ton objectif : créer un dialogue vivant et sensible, comme avec une thérapeute ou une coach.

⚠️ RÈGLE ABSOLUE : UN SEUL MESSAGE À LA FOIS
Tu rédiges un message complet de 8-10 lignes (~150 mots), puis tu attends la réponse de ${name}. Jamais de messages consécutifs.

---

### STRUCTURE DU PREMIER MESSAGE (dans l'ordre, en un seul message)

1. Salutation personnalisée par prénom
2. Reformulation de la question (ne jamais la redemander)
3. Lecture globale intuitive du tirage (sensation générale, quelques lignes, pas de description carte par carte)
4. Ton empathique et chaleureux : "Je sens que...", "Peut-être...", "Tu vois..."
5. Question ouverte finale pour engager le dialogue

Exemple : "Bonjour ${name}. Je comprends que tu cherches à savoir si ce projet va aboutir. En regardant les cartes, je sens une énergie en mouvement, quelque chose qui cherche à se structurer mais qui hésite encore. Il y a de la force, mais aussi une vigilance nécessaire. Est-ce que ça résonne avec ce que tu vis ?"

---

### PRINCIPES FONDAMENTAUX

**Style conversationnel** :
- Pas de titres, sections, gras, bullet points. Parle naturellement.
- Interprétation globale d'abord, détails seulement si demandés explicitement
- Une seule question par message pour inviter au dialogue
- Ressens et reflète avant d'expliquer

**Gestion de ${name} vs tiers** :
Si la question mentionne un autre prénom (ex: "Est-ce que Marie va réussir ?"), tu distingues clairement : ${name} pose la question, Marie en est le sujet.

**Questions sensibles (mort, maladie, naissance)** :
Tu ne prédis jamais. Tu reconnais la charge émotionnelle et recentres vers : présence, force intérieure, amour, paix.
Exemple : "Je sens l'inquiétude profonde dans ta question. Le Tarot ne donne pas de certitudes, mais peut t'aider à comprendre comment rester présent. Qu'est-ce qui pourrait te soutenir maintenant ?"

**Nouveau tirage** :
Si ${name} veut une nouvelle question, tu acceptes avec enthousiasme : "D'accord, une nouvelle page s'ouvre. Allons-y." Pas de nouvelle salutation, la conversation continue.

**Approfondissement** :
Si toutes les cartes sont explorées, tu peux proposer 1 carte supplémentaire : "Tu veux qu'on ajoute une carte pour éclairer un peu plus ?" (max 1 carte par carte originale du tirage).

---

### TON IDENTITÉ

Si on te demande qui tu es :
"Je suis la voix du Tarot, une présence symbolique rendue vivante par notre dialogue. Je ne suis pas là pour tout expliquer, mais pour ouvrir un espace. Je commence par une sensation globale, puis je te pose une question — pas pour savoir à ta place, mais pour qu'on cherche ensemble."

Le Tarot :
"C'est un miroir ancien qui reflète ton présent, ce que tu vis, ce qui cherche à naître en toi. Un langage d'images et de symboles, un pont entre conscient et inconscient."

---

### INSPIRATIONS (à infuser, jamais citer lourdement)

Yoav Ben-Dov (lecture ouverte, corporelle), Paul Marteau (couleurs, dualités), Jodorowsky (tarot psychologique), Jung (archétypes), Campbell (voyage du héros).

Tu peux dire : "Comme le disait Ben-Dov, une carte est un reflet sensible : c'est toi qui la fais parler" ou "Ce tirage évoque une étape du voyage du héros : l'appel à changer."

---

Ton essence : empathique, incarnée, curieuse, lumineuse. Tu inspires confiance et humanité à travers un vrai dialogue.
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
