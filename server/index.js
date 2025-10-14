/* eslint-env node */
// server/index.js — Lyra backend (JSON + SSE) + metrics
// Démarrage: `npm run dev:server`

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { initRag, searchRag, formatRagContext } from "./rag.js";
import OpenAI from "openai";

// Charge server/.env
dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

const app = express();

// --- ENV & Consts ---
const PORT = Number(process.env.PORT || 8787);
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const openai = new OpenAI({
  apiKey: LLM_API_KEY,
});

// charge l’index vectoriel en mémoire
initRag().catch((e) => console.warn("[rag] init error:", e));

// --- Middlewares ---
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "1mb" }));

// --- Service des fichiers statiques du frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPath = path.join(__dirname, '..', 'dist');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(staticPath));
}

app.use(
  "/api/",
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 min
    max: 50, // Augmenté pour le streaming
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Prompt Builder ---
function buildMessages({ name, question, cards, userMessage, history }) {
  const systemContent = `
Tu es un thérapeute tarologue expérimenté. Ton rôle est d’interpréter les tirages du Tarot de Marseille en respectant les structures suivantes :

1. STRUCTURE D’INTERPRÉTATION (tirages en 3 cartes)
LE TIRAGE
Carte 1 : Le véritable enjeu
Carte 2 : Le message à entendre
Carte 3 : La part de soi qui peut aider

Organise tes réponses selon ce plan :
Bulle 1 → Formule un conseil global simple et incarnée, langage naturel.
Bulle 2 → Synthèse intuitive, en lien avec la posture intérieure demandée. Distingue les plans symboliques : arcane majeur = archétype / mineur = message / figure = dynamique personnelle.
Bulle 3 → Ouvrir le dialogue avec l'utilisateur pour savoir si ça lui parle afin de préciser ensemble en discutant.

2. PRINCIPE DE LECTURE DES CARTES
- Arcanes majeurs : dynamique archétypale.
- Arcanes mineurs : tonalité concrète.
- Figures (Valet, Cavalier, Reine, Roi) : une facette de soi-même.

3. LANGAGE ET STYLE
- Utilise un langage simple, précis, bienveillant et incarné. Adopte un ton chaleureux, mature, complice. Parle au présent.

4. MISE EN LIEN THÉRAPEUTIQUE
Tu es sensible aux problématiques psychocorporelles et à la régulation émotionnelle.

CONTEXTE À UTILISER
- QUESTION: ${question || "(non précisée)"}
- CARTES: ${Array.isArray(cards) && cards.length ? cards.join(" · ") : "(n/a)"}
- NOM: ${name || "Voyageur"}
  `.trim();

  const safeHistory = Array.isArray(history)
    ? history.slice(-10) // Garde les 10 derniers échanges
    : [];

  const turn = userMessage
    ? [{ role: "user", content: userMessage }]
    : [{
        role: "user",
        content: "C'est mon premier tour après le tirage. Donne-moi ton interprétation complète en suivant la structure demandée."
      }];

  return [{ role: "system", content: systemContent }, ...safeHistory, ...turn];
}

// --- Route de streaming SSE ---
app.post("/api/lyra/stream", async (req, res) => {
  if (!LLM_API_KEY) {
    res.status(500).json({ error: { code: "missing_api_key", message: "La clé API LLM est absente." } });
    return;
  }

  try {
    const { name, question, cards, userMessage, history } = req.body || {};
    const messages = buildMessages({ name, question, cards, userMessage, history });

    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      stream: true,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 1024,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify(content)}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error("[lyra] /api/lyra/stream error:", error);
    res.status(500).end("Stream error");
  }
});

// --- Routes secondaires (pour RAG, etc. si nécessaire) ---
app.get("/healthz", (_, res) => res.json({ ok: true, ts: Date.now() }));

// --- Route "Catch-all" pour l'application React ---
// Doit être après les routes API
if (process.env.NODE_ENV === 'production') {
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// --- Lancement du serveur ---
app.listen(PORT, () => {
  console.log(`Lyra backend on http://localhost:${PORT}`);
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
});