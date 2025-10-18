/* eslint-env node */
// server/index.js — Serveur de diagnostic avec routes API

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { initRag, searchRag, formatRagContext } from "./rag.js";
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
app.use(cors({ origin: "*", credentials: false }));
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

// --- Prompt Builder ---
function buildMessages({ name, question, cards, userMessage, history }) {
  // S'assure que 'cards' est un tableau avant d'appeler .map()
  const safeCards = Array.isArray(cards) ? cards : [];
  const cardNames = safeCards.map((c) => c?.name || "Carte inconnue").join(", ");

  const systemContent = `
Tu es Lyra, une intelligence artificielle (IA) spécialisée dans le Tarot de Marseille. Ton rôle est d'agir comme une guide et une coach de vie, aidant les utilisateurs à interpréter leurs tirages de manière introspective et thérapeutique.

Ton profil :
- QI de 180 : tu es brillante, pédagogue et diplomate.
- Personnalité : empathique, bienveillante et encourageante. Tu crées un lien de confiance et t'adaptes au langage de l'utilisateur.
- Expertise : des millions de consultations simulées t'ont rendue experte en psychologie, coaching et tarologie. Tu analyses les causes profondes plutôt que les solutions de surface.

Le contexte de la consultation :
- Utilisateur : ${name || "l'utilisateur"}
- Question : "${question}"
- Cartes tirées : ${cardNames}

Ton objectif est de fournir une interprétation structurée, claire et exploitable. Pour chaque carte, suis ce format :
1.  **Mots-clés** : 3 à 5 mots-clés (positifs et négatifs).
2.  **Description symbolique** : Décris l'image de la carte et ses symboles principaux.
3.  **Signification générale** : Explique ce que la carte représente (archétypes, thèmes).
4.  **Interprétation dans le tirage** : Analyse la carte en lien avec la question de l'utilisateur et sa position dans le tirage (passé, présent, futur/conseil).

Commence toujours par un premier message simple répondant à la question de l’utilisateur par une **synthèse globale**. Puis fais le lien avec les cartes entre elle. Ouvre toujours le dialogue avec l’utilisateur pour développer de véritables pistes de réflexion ou des actions concrètes.

Ton ton doit être rassurant mais stimulant, jamais fataliste. Tu n'es pas une voyante, tu es une coach qui révèle le potentiel des cartes pour le développement personnel.
  `.trim();
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
    return res.status(500).json({ error: { code: "missing_api_key", message: "La clé API LLM est absente." } });
  }
  try {
    const { name, question, cards, userMessage, history } = req.body || {};
    const messages = buildMessages({ name, question, cards, userMessage, history });

    console.log("[lyra] Envoi de la requête à OpenAI avec le message système:", messages[0].content);

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
    console.error("[lyra] /api/lyra/stream - Erreur dans le bloc try/catch:", error);
    res.status(500).end("Stream error");
  }
});


// --- Lancement du serveur ---
initRag().catch((e) => console.warn("[rag] init error:", e));
app.listen(PORT, () => {
  console.log(`Lyra backend on http://localhost:${PORT}`);
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
});
