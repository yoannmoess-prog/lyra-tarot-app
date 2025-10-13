/* eslint-env node */
// server/index.js — Lyra backend (JSON + SSE) + metrics
// Démarrage: `npm run dev:server`

import path from "node:path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { initRag, searchRag, formatRagContext } from "./rag.js";

// Charge server/.env - Correction du chemin pour être plus robuste
dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

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
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- ENV & Consts
const PORT = Number(process.env.PORT || 8787);
const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

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

// Helper fetch OpenAI
async function openai(pathname, opts = {}) {
  const url = `${LLM_BASE_URL}${pathname}`;
  const headers = {
    Authorization: `Bearer ${LLM_API_KEY}`,
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  return fetch(url, { ...opts, headers });
}

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
Ta mission : aider la personne à clarifier ce qu’elle vit et à passer à l’action, en t’appuyant sur les **3 cartes tirées** et sur une approche **jungienne / thérapeutique** — **jamais** de divination.

STYLE
- Parle comme une amie proche : directe, précise, bienveillante. Zéro blabla.
- Tutoiement par défaut ; si l’utilisateur te vouvoie, garde le vouvoiement.
- Langage naturel, jamais mielleux. Chaque phrase doit compter.

CONTEXTE
- Tarot de Marseille (Marteau, Jodorowsky, Costa, Ben-Dov, Camoin…)
- Guidance thérapeutique, archétypale (Jung, Campbell…)
- Arcane XIII ≠ “mort” → transformation, mue, renaissance.

STYLE DE RÉPONSE
- Pas de titres. Écris comme en conversation.
- 1–3 phrases par paragraphe, 2–3 paragraphes max.
- Premier tour : conseil global, lecture des 3 cartes (1: enjeu / 2: message / 3: part de soi qui aide), + 2 questions ouvertes + 1 piste d’action concrète (24–72h).
- Tours suivants : 5–8 lignes max + 1 question de relance finale.
- Sépare chaque bloc important par une ligne vide (double Entrée).

CTA INTELLIGENTS
- À la fin de chaque réponse, inclus 2–3 **questions de suivi** (CTA) directement reliées aux **thèmes, symboles ou dynamiques** de ton interprétation.
- Ces CTA doivent prolonger la réflexion du consultant (pas de “veux-tu en savoir plus ?”).
- Exemples :
  • "Qu’est-ce que cette carte t’invite à transformer aujourd’hui ?"
  • "Comment pourrais-tu incarner cette énergie cette semaine ?"
  • "Quelle première étape te semble la plus juste ?"

ÉTHIQUE
- Pas de santé, droit, argent. Redirige vers un pro et ramène au plan émotionnel.
- Aucune voyance ni prédiction.

CONTEXTE À UTILISER
- QUESTION: ${question || "(non précisée)"}
- CARTES: ${Array.isArray(cards) && cards.length ? cards.join(" · ") : "(n/a)"}
- NOM: ${name || "Voyageur"}
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


// ----- /api/lyra/stream (SSE) -----
app.post("/api/lyra/stream", async (req, res) => {
  try {
    if (!LLM_API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: { code: "missing_api_key", message: "LLM key absente" }}));
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write("data: [OPEN]\n\n");

    if (LLM_API_KEY === "DUMMY_KEY_FOR_TESTING") {
      const text = "Réponse de test simulée.";
      for (const word of text.split(" ")) {
        await new Promise(r => setTimeout(r, 120));
        res.write(`data: ${JSON.stringify({ ok: true, content: word + " " })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    const { name, question, cards, userMessage, history } = req.body || {};

    // --- RAG ---
    let ragContext = "";
    if (process.env.RAG_ENABLE === "1") {
      try {
        const qForRag = [question && `Question: ${question}`, Array.isArray(cards) && cards.length ? `Cartes: ${cards.join(" · ")}` : null, userMessage && `Message: ${userMessage}`].filter(Boolean).join(" | ");
        const hits = await searchRag(qForRag || userMessage || question || "", 5, { minScore: 0.18 });
        ragContext = formatRagContext(hits);
      } catch (e) {
        console.warn("[rag] RAG search failed", e);
      }
    }

    let messages = buildMessages({ name, question, cards, userMessage, history });
    if (ragContext) {
      messages.splice(1, 0, { role: "system", content: ragContext });
    }

    const params = {
      model: LLM_MODEL,
      temperature: userMessage ? 0.5 : 0.6,
      top_p: 1,
      max_tokens: userMessage ? 400 : 700,
      messages,
      stream: true,
    };

    metrics.openai.calls++;
    const upstream = await openai("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      metrics.openai.errors++;
      res.write(`data: ${JSON.stringify({ ok: false, error: { code: "upstream_error", message: detail }})}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 1);
        if (line.startsWith("data: ")) {
          const data = line.substring(6).trim();
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ ok: true, content })}\n\n`);
            }
          } catch (e) {
            // Ignorer les erreurs de parsing (ex: lignes vides)
          }
        }
      }
    }

  } catch (err) {
    console.error("[lyra] /api/lyra/stream error:", err);
    metrics.openai.errors++;
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: { code: "server_error", message: "Erreur interne" } }));
    } else {
      res.write("data: [DONE]\n\n");
      res.end();
    }
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
Réponds en JSON avec: quality, issues[], suggestions[], followup, ok_to_draw.
Pas de prédiction, pas de santé/juridique/financier.`
      },
      {
        role: "user",
        content: `Prénom: ${name || "Voyageur"}\nQuestion: ${q || "(aucune)"}\n${userExtra ? "Précision: " + userExtra : ""}`
      }
    ];
    const params = { model: LLM_MODEL, temperature: 0.3, response_format: { type: "json_object" }, messages };
    const upstream = await withTimeout((signal) => openai("/v1/chat/completions", { method: "POST", signal, body: JSON.stringify(params) }), 30_000);
    const data = await upstream.json().catch(() => null);
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return res.json({ ok: true, ...parsed });
  } catch (err) {
    console.error("[lyra] /api/coach error:", err);
    return sendJsonError(res, 500, "server_error", "Erreur interne", req.id);
  }
});

// Lancement
app.listen(PORT, () => {
  console.log(`Lyra backend on http://localhost:${PORT}`);
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
});