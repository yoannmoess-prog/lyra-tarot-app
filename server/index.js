/* eslint-env node */
// server/index.js — Serveur de diagnostic avec routes API

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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
app.set("trust proxy", 1);

// --- Constantes et Variables d'environnement ---
const PORT = process.env.PORT || 8787;
// Correctif : Utilisation de la variable standard OPENAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- CORS (AVANT tout autre middleware/route) ---
const allowedOrigins = [
  "https://lyra-frontend.onrender.com",
  "https://lyra-frontend.render.com", // selon Render
  "http://localhost:5100",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// --- Parsers ---
app.use(express.json({ limit: "1mb" }));

// --- Rate Limiter API (ne pas bloquer les préflights) ---
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});
app.use("/api/", apiLimiter);

// --- Validation des entrées ---
function validateInput(data) {
  const errors = [];

  if (data.name && typeof data.name !== "string") {
    errors.push("name doit être une chaîne de caractères");
  }
  if (data.question && typeof data.question !== "string") {
    errors.push("question doit être une chaîne de caractères");
  }
  if (data.cards && !Array.isArray(data.cards)) {
    errors.push("cards doit être un tableau");
  }
  if (data.userMessage && typeof data.userMessage !== "string") {
    errors.push("userMessage doit être une chaîne de caractères");
  }
  if (data.history && !Array.isArray(data.history)) {
    errors.push("history doit être un tableau");
  }
  return errors;
}

/**
 * Vérifie si une réponse de l'IA semble respecter le contrat positionnel.
 */
function looksCompliantPositionally(text, positionHints = []) {
  const t = (text || "").toLowerCase();
  const citesCard =
    /(le|la)\s+(mat|bateleur|papesse|impératrice|empereur|pape|amoureux|chariot|justice|ermite|roue|force|pendu|arcane|tempérance|diable|maison dieu|étoile|lune|soleil|jugement|monde|as|valet|reine|roi|deniers|coupes|epees|épées|batons|bâtons)/i.test(
      t
    );
  if (!citesCard) return true;
  const hasPosNumber = /position\s*[123456789]/.test(t);
  const hasPosHint = positionHints.some((h) => t.includes(h.toLowerCase()));
  return hasPosNumber || hasPosHint;
}

/**
 * Extrait les intitulés des positions d'un spread à partir de son contenu Markdown.
 */
function parseSpreadPositions(spreadContent) {
  if (!spreadContent) return [];
  const positions = [];
  const regex = /^###\s.*?\d\.\s([^(]+)/gm;
  let match;
  while ((match = regex.exec(spreadContent)) !== null) {
    if (match.index === regex.lastIndex) regex.lastIndex++;
    positions.push(match[1].trim());
  }
  return positions;
}

import { systemPrompt, buildInitialUser, buildReplyUser } from "./prompts/lyra.js";

// --- Prompt Builder ---
function buildMessages({ name, question, cards, userMessage, history, turnIndex }) {
  const who = name || "l'utilisateur";
  const system = systemPrompt();

  // Pour le premier tour (introduction), on utilise un prompt utilisateur structuré.
  if (turnIndex === 0) {
    const user = buildInitialUser({ who, question, cards });
    return [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
  }

  // Pour les tours suivants, on utilise un prompt plus simple et l'historique.
  const user = buildReplyUser({ who, userMessage, cards, question });
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

  return [
    { role: "system", content: system },
    ...safeHistory,
    { role: "user", content: user },
  ];
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

// --- /api/spread : Point de terminaison unique et robuste pour la détection
app.post("/api/spread", async (req, res) => {
  const { question } = req.body || {};

  // La logique est maintenant directe, pas besoin de timeout ou de fallback complexe.
  try {
    // On appelle directement la fonction de détection qui est maintenant déterministe.
    const spreadId = await detectSpreadFromQuestion(question || "");

    // Log pour le débogage
    console.log(`[api/spread] Question: "${question}" -> Tirage détecté: "${spreadId}"`);

    // On renvoie le résultat. La fonction de détection gère le cas par défaut ("spread-advice").
    res.json({ spreadId });
  } catch (error) {
    // En cas d'erreur inattendue dans la logique de détection
    console.error("[api/spread] Erreur critique lors de la détection du tirage:", error);
    // On renvoie le tirage par défaut pour ne pas bloquer l'utilisateur.
    res.status(500).json({ spreadId: "spread-advice" });
  }
});

app.post("/api/lyra/stream", async (req, res) => {
  console.log(
    "[lyra] /api/lyra/stream: Requête reçue avec le corps:",
    JSON.stringify(req.body, null, 2)
  );

  if (!OPENAI_API_KEY) {
    console.error("[lyra] Erreur: OPENAI_API_KEY est manquante.");
    return res.status(500).json({
      error: { code: "missing_api_key", message: "La clé API LLM est absente." },
    });
  }

  try {
    const { name, question, cards, userMessage, history, spreadId } = req.body || {};

    if (!spreadId) {
      console.error("[lyra] Erreur: spreadId est manquant dans la requête.");
      return res.status(400).json({
        error: { code: "missing_spread_id", message: "Le spreadId est requis." },
      });
    }
    console.log(`[lyra] Utilisation du spreadId fourni par le client: ${spreadId}`);

    const spreadPath = path.join(process.cwd(), "records/spreads", `${spreadId}.md`);
    console.log(`[lyra] Chargement du contenu du tirage depuis : ${spreadPath}`);
    let spreadContent = "";
    try {
      spreadContent = fs.readFileSync(spreadPath, "utf8");
      console.log(`[lyra] Contenu du tirage "${spreadId}" chargé avec succès.`);
    } catch (e) {
      console.warn(
        `[server] Fichier de tirage "${spreadId}.md" non trouvé. Utilisation d'un contenu par défaut.`
      );
    }

    const validationErrors = validateInput({ name, question, cards, userMessage, history });
    if (validationErrors.length > 0) {
      console.error("[lyra] Erreurs de validation:", validationErrors);
      return res.status(400).json({
        error: { code: "validation_error", message: "Données invalides", details: validationErrors },
      });
    }

    const positionHints = parseSpreadPositions(spreadContent);
    const messages = buildMessages({
      name,
      question,
      cards,
      userMessage,
      history,
      spreadContent,
      positionHints,
    });
    console.log("[lyra] Messages pour OpenAI construits :", JSON.stringify(messages, null, 2));

    console.log("[lyra] Envoi de la requête à OpenAI...");

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

    // Bloc try...catch pour intercepter les erreurs de clé API invalide
    try {
      const streamPromise = openai.chat.completions.create({
        model: LLM_MODEL,
        messages,
        stream: true,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 1024,
      });

      // Ajout du timeout de 10 secondes.
      const stream = await Promise.race([
        streamPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout: L'API OpenAI n'a pas répondu à temps.")), 10000)
        ),
      ]);

      await streamResponse(stream);
    } catch (e) {
      // Si l'erreur vient d'OpenAI (clé invalide, etc.), on la logue
      // et on laisse le bloc catch principal gérer la réponse au client.
      console.error("[lyra] Erreur DANS la création du stream OpenAI:", e.message);
      throw e; // Fait remonter l'erreur pour qu'elle soit gérée ci-dessous
    }
    console.log(`[lyra] Stream terminé.`);
    res.end();
  } catch (error) {
    console.error("[lyra] /api/lyra/stream - Erreur:", error);
    if (!res.headersSent) {
      const errorMessage = error.message || "Erreur inconnue";
      const errorCode = error.code || "stream_error";
      res.status(500).json({ error: { code: errorCode, message: errorMessage } });
    } else {
      res.end();
    }
  }
});

// --- Gestion des erreurs globales ---
app.use((err, req, res, next) => {
  console.error("[server] Erreur non gérée:", err?.message || err);
  if (!res.headersSent) {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.status(500).json({ error: { code: "internal_error", message: "Une erreur interne est survenue" } });
  } else {
    res.end();
  }
});

// --- Lancement du serveur ---
initRag().catch((e) => console.warn("[rag] init error:", e));

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`Lyra backend on http://${HOST}:${PORT}`);
  console.log(`[lyra] LLM key: ${OPENAI_API_KEY ? "présente" : "absente"}`);
  console.log(`[lyra] Model: ${LLM_MODEL}`);
  console.log("---");
  console.log("[lyra-backend] Version du code : 2.0 - CORRECTIF ACTIF");
  console.log("---");
});
