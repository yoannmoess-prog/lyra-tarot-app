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

// Charge server/.env - Correction du chemin pour être plus robuste
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();

// charge l’index vectoriel en mémoire
initRag().catch((e) => console.warn("[rag] init error:", e));

// CORS + JSON
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "1mb" }));

// Rate-limit
app.use(
  "/api/",
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 min
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- ENV & Consts
const PORT = Number(process.env.PORT || 8787);
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const openai = new OpenAI({ apiKey: LLM_API_KEY });

// Prix optionnels
const PRICE_PROMPT_PER_1K = Number(process.env.PRICE_PROMPT_PER_1K || 0);
const PRICE_COMPLETION_PER_1K = Number(process.env.PRICE_COMPLETION_PER_1K || 0);

// Metrics
const SESSION_ID = randomUUID();
const STARTED_AT = Date.now();
const metrics = {
  startedAt: STARTED_AT,
  sessionId: SESSION_ID,
  requests: { total: 0, byRoute: {}, errors: 0 },
  latencies: [],
  openai: {
    calls: 0, errors: 0,
    prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_stream_tokens: 0,
  },
  costUsd: { prompt: 0, completion: 0, total: 0 },
};

// Middleware latence
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  req._start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - req._start) / 1e6;
    console.info(`[lyra] ${req.method} ${req.path} -> ${res.statusCode} in ${ms.toFixed(1)}ms`);
    metrics.requests.total++;
    metrics.requests.byRoute[req.path] = (metrics.requests.byRoute[req.path] || 0) + 1;
    if (res.statusCode >= 400) metrics.requests.errors++;
    metrics.latencies.push(ms);
    if (metrics.latencies.length > 200) metrics.latencies.shift();
  });
  next();
});

// Timeout helper
async function withTimeout(fn, ms = 45_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fn(ac.signal);
  } finally {
    clearTimeout(t);
  }
}

function sendJsonError(res, status, code, message, reqId) {
  res.status(status).json({ ok: false, error: { code, message }, reqId });
}

const approxTokens = (s) => Math.ceil((s || "").length / 4);
function sliceHistoryBudget(history = [], maxTokens = 3500) {
  const kept = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const cost = approxTokens(h.content) + 4;
    if (used + cost > maxTokens) break;
    kept.push(h);
    used += cost;
  }
  return kept.reverse();
}

// ---------------- Prompt assembleur ----------------
function buildMessages({ name, question, cards, userMessage, history }) {
  const system = {
    role: "system",
    content: `
Tu es **LYRA**, voix féminine du Tarot de Marseille, confidente et conseillère.
... (contenu du prompt inchangé) ...
    `.trim(),
  };

  const safeHistory = Array.isArray(history) ? sliceHistoryBudget(history) : [];
  const turn = userMessage
    ? [{ role: "user", content: userMessage }]
    : [{
        role: "user",
        content:
`Premier tour après tirage. Donne ton interprétation complète.
Puis propose 2–3 CTA sous forme de questions reliées à ton interprétation. Réponds au format JSON : {"text": "...", "suggestions": ["...","...","..."]}`
      }];

  return [system, ...safeHistory, ...turn];
}

// ---------------- Routes ----------------
app.get("/", (_, res) => res.type("text/plain").send("Lyra backend OK."));
app.get("/healthz", (_, res) => res.json({ ok: true, ts: Date.now() }));

app.post("/api/lyra/stream", async (req, res) => {
  if (!LLM_API_KEY) {
    return res.status(500).json({ error: { code: "missing_api_key", message: "La clé API LLM est absente." } });
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

// ----- /api/lyra (ancienne route, maintenant non-stream) -----
app.post("/api/lyra", async (req, res) => {
  try {
    if (!LLM_API_KEY) return sendJsonError(res, 500, "missing_api_key", "LLM key absente", req.id);
    if (LLM_API_KEY === "DUMMY_KEY_FOR_TESTING") return res.json({ ok: true, text: "Réponse de test simulée.", suggestions: ["Exemple 1", "Exemple 2"] });

    const { name, question, cards, userMessage, history } = req.body || {};

    let ragContext = "";
    try {
      if (process.env.RAG_ENABLE === "1") {
        const qForRag = [question && `Question: ${question}`, Array.isArray(cards) && cards.length ? `Cartes: ${cards.join(" · ")}` : null, userMessage && `Message: ${userMessage}`].filter(Boolean).join(" | ");
        const hits = await searchRag(qForRag || userMessage || question || "", 5, { minScore: 0.18 });
        ragContext = formatRagContext(hits);
      }
    } catch {}

    let messages = buildMessages({ name, question, cards, userMessage, history });
    if (ragContext) messages.splice(1, 0, { role: "system", content: ragContext });

    const params = {
      model: LLM_MODEL,
      temperature: userMessage ? 0.5 : 0.6,
      top_p: 1,
      max_tokens: userMessage ? 400 : 700,
      response_format: { type: "json_object" },
      messages,
    };

    const completion = await openai.chat.completions.create(params);

    const raw = completion.choices[0].message.content.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw, suggestions: [] };
    }

    const text = parsed.text || raw;
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    // Metrics
    const usage = completion.usage || {};
    metrics.openai.calls++;
    metrics.openai.prompt_tokens += usage.prompt_tokens || 0;
    metrics.openai.completion_tokens += usage.completion_tokens || 0;
    metrics.openai.total_tokens += usage.total_tokens || 0;

    return res.json({ ok: true, text, suggestions });
  } catch (err) {
    console.error("[lyra] /api/lyra error:", err);
    metrics.openai.errors++;
    return sendJsonError(res, 500, "server_error", "Erreur interne", req.id);
  }
});

// --- Routes secondaires (inchangées) ---
app.post("/api/rag/search", async (req, res) => {
  try {
    const { query, k, minScore } = req.body || {};
    if (!query || !String(query).trim()) return res.status(400).json({ ok: false, error: "missing_query" });
    const hits = await searchRag(query, Number(k) || 6, { minScore: typeof minScore === "number" ? minScore : undefined });
    res.json({ ok: true, hits });
  } catch {
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/coach", async (req, res) => {
  try {
    const { name, question, extra } = req.body || {};
    const q = String(question || "").trim();
    const userExtra = String(extra || "").trim();
    const messages = [
      {
        role: "system",
        content: `
Tu es LYRA, tu aides à formuler une bonne question pour un tirage thérapeutique.
... (contenu du prompt inchangé) ...
`
      },
      {
        role: "user",
        content: `Prénom: ${name || "Voyageur"}\nQuestion: ${q || "(aucune)"}\n${userExtra ? "Précision: " + userExtra : ""}`
      }
    ];
    const params = { model: LLM_MODEL, temperature: 0.3, response_format: { type: "json_object" }, messages };
    const completion = await openai.chat.completions.create(params);
    const raw = completion.choices[0].message.content || "{}";
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return res.json({ ok: true, ...parsed });
  } catch (err) {
    console.error("[lyra] /api/coach error:", err);
    return sendJsonError(res, 500, "server_error", "Erreur interne", req.id);
  }
});

// --- Service des fichiers statiques et route "Catch-all" pour le Frontend ---
// Doit être placé APRÈS les routes API pour ne pas les intercepter.
// const staticPath = path.resolve(__dirname, "..", "dist");
// app.use(express.static(staticPath));
// app.get("*", (req, res) => {
//   res.sendFile(path.resolve(staticPath, "index.html"));
// });

// Lancement
app.listen(PORT, () => {
  console.log(`Lyra backend on http://localhost:${PORT}`);
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
});