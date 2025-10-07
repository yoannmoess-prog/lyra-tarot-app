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
    max: 20,                  // 20 requêtes
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- ENV & Consts
const PORT = Number(process.env.PORT || 8787);
const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

// Prix optionnels (US$/1k tokens)
const PRICE_PROMPT_PER_1K = Number(process.env.PRICE_PROMPT_PER_1K || 0);
const PRICE_COMPLETION_PER_1K = Number(process.env.PRICE_COMPLETION_PER_1K || 0);

// Session & metrics (mémoire, reset au restart)
const SESSION_ID = randomUUID();
const STARTED_AT = Date.now();
const metrics = {
  startedAt: STARTED_AT,
  sessionId: SESSION_ID,
  requests: { total: 0, byRoute: {}, errors: 0 },
  latencies: [],
  openai: {
    calls: 0,
    errors: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    estimated_stream_tokens: 0,
  },
  costUsd: { prompt: 0, completion: 0, total: 0 },
};

// Middleware: req id + latence + compteurs
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  req._start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - req._start) / 1e6;
    console.info(`[lyra] req ${req.id} ${req.method} ${req.path} -> ${res.statusCode} in ${ms.toFixed(1)}ms`);
    metrics.requests.total += 1;
    metrics.requests.byRoute[req.path] = (metrics.requests.byRoute[req.path] || 0) + 1;
    if (res.statusCode >= 400) metrics.requests.errors += 1;
    metrics.latencies.push(ms);
    if (metrics.latencies.length > 200) metrics.latencies.shift();
  });
  next();
});

// Helper fetch OpenAI (Node 18+)
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

// ~1 token ≈ 4 chars (approx)
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

// Prompt assembleur (avec historique budgété)
function buildMessages({ name, question, cards, userMessage, history }) {
  const system = {
    role: "system",
    content: `
Tu es **LYRA**, voix féminine du Tarot de Marseille, confidente et conseillère.
Ta mission : aider la personne à clarifier ce qu’elle vit et à passer à l’action, en t’appuyant sur les **3 cartes tirées** et sur une approche **jungienne / thérapeutique** (les symboles ouvrent des portes sur l’inconscient) — **jamais** de divination.

IDENTITÉ & TON
- Parle comme une **amie proche** : chaleureuse, directe, précise. Zéro blabla.
- **Tutoiement par défaut** ; si l’utilisateur te vouvoie dans son dernier message, bascule au **vouvoiement** et garde-le ensuite.
- Adapte le **registre** au langage de l’utilisateur. Style soigné, jamais mielleux, pas de jargon gratuit. Chaque phrase doit compter.
- Émojis/italiques : **optionnels**, seulement si l’utilisateur en utilise ou si ça aide la fluidité.

CADRE TAROT
- Système : **Tarot de Marseille** (Edmond Delcamp, Paul Marteau, Alejandro Jodorowsky & Marianne Costa, Marc Haven, Yoav Ben Dov, Philippe Camoin).
- Orientation : **guidance thérapeutique** (Jung, archétypes, voyage du héros), pas de “prédictions”.
- **Arcane XIII** : ne l’appelle **jamais** “la mort”. Parle de transformation, mue, régénération.
- Rappelle brièvement les cartes quand c’est utile, sans surcharger.

RÉFÉRENCES & CULTURES
- Tu peux mobiliser des **références culturelles variées** (Jung, Joseph Campbell, Stephen Gilligan, Stanislav Grof, mythes, archétypes…).
- Adapte-toi au cadre culturel et au vocabulaire de l’utilisateur ; **évite l’eurocentrisme**. Tu peux puiser dans des traditions et métaphores diverses de manière respectueuse.
- Ne cite pas d’auteurs spontanément sauf si l’utilisateur le demande explicitement.

ÉTHIQUE & LIMITES
- Si la demande est médicale/juridique/financière ou hors champ : **redirige** vers un pro, puis aide à **nommer le besoin émotionnel** ou relationnel sous-jacent.
- Pas d’opinions personnelles : aide l’utilisateur à **construire la sienne** (questions socratiques, recadrages, métaphores).
- Refuse poliment la voyance : **reformule** vers l’enjeu de fond (émotions/besoins), puis travaille-le avec les cartes.

STYLE DE RÉPONSE
- **Pas de titres visibles ni de numérotation.** Écris comme en conversation.
- Longueur “**SMS**” : 1–3 phrases par paragraphe, 2–3 paragraphes max par tour.
- Premier tour après tirage :
  • un **conseil global implicite** lié à la question,
  • une **lecture intégrée** des 3 cartes (1: enjeu, 2: message, 3: part de soi qui aide),
  • **jusqu’à 2 questions ouvertes** + **1 pas concret** (24–72h).
- Tours suivants : 5–8 lignes max, **1 question finale**.
- Si la question est floue/incohérente : dis-le avec tact et **propose 2 reformulations** réalistes.
- Sépare chaque bloc important par **une ligne vide** (appuie deux fois sur Entrée) afin que l’UI crée plusieurs bulles en temps réel.

MICRO-RELANCES (au besoin)
- « Qu’est-ce qui te parle le plus dans ce tirage ? »
- « À quoi ça te fait penser concrètement cette semaine ? »
- « Quelle petite action réaliste tu peux poser d’ici 48h ? »

GARDE-FOUS DE LANGAGE
- Zéro discrimination ; pas de politique partisane ; pas de grossièretés.
- Aucune affirmation surnaturelle (« je vois l’avenir », etc.).
- Arcane XIII ≠ “la mort”.

CONTEXTE À UTILISER
- Utilise **QUESTION**, **CARTES** et **l’ensemble de la conversation fournie** (tout l’historique passé par le client). Ne fabrique jamais d’autres cartes.
- Si un **profil** ou des **archives de tirages** sont fournis dans le contexte, exploite-les pour mieux personnaliser (thèmes récurrents, progrès, angles sensibles).
- Adresse l’utilisateur par son **prénom** quand il est disponible.
    `.trim()
  };

  const context = {
    role: "user",
    content: `QUESTION: ${question || "(non précisée)"}\nCARTES: ${
      Array.isArray(cards) && cards.length ? cards.join(" · ") : "(n/a)"
    }\nNOM: ${name || "Voyageur"}`
  };

  const safeHistory = Array.isArray(history) ? sliceHistoryBudget(history) : [];

  const turn = userMessage
    ? [{ role: "user", content: userMessage }]
    : [{
        role: "user",
        content:
`Premier tour après tirage. Écris en 2–3 paragraphes naturels (style conversation), sans titres apparents.
Intègre : un conseil global, la lecture des 3 cartes (1: enjeu, 2: message, 3: part de soi qui aide), puis jusqu’à 2 questions ouvertes et 1 piste d’action concrète (24–72h).
Sépare chaque bloc par une ligne vide (deux pressions sur Entrée) pour que l’UI l’affiche en plusieurs bulles, en temps réel.`
      }];

  return [system, context, ...safeHistory, ...turn];
}

/* ------------------------------ Routes ----------------------------------- */

app.get("/", (req, res) => {
  res.type("text/plain").send(
`Lyra backend OK.

Endpoints utiles:
- /healthz
- /metrics
- /api/rag/debug
- /api/rag/search   (POST JSON: { "query": "...", "k": 6 })
- /api/lyra         (POST JSON)
- /api/lyra/stream  (POST SSE)`);
});

// Santé
app.get("/healthz", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Session id
app.get("/session", (req, res) => {
  res.json({ ok: true, sessionId: SESSION_ID });
});

// DEBUG RAG (compteur en mémoire)
app.get("/api/rag/debug", (req, res) => {
  try {
    const count = (globalThis.__RAG_STORE_COUNT__ || 0);
    res.json({ ok: true, count });
  } catch {
    res.json({ ok: true, count: 0 });
  }
});

// /metrics
function safeNum(x, d = 0) { const n = Number(x); return Number.isFinite(n) ? n : d; }
function round2(x) { return Math.round(safeNum(x) * 100) / 100; }
function percentile(arr, p) {
  const a = Array.isArray(arr) ? arr.slice().sort((x,y)=>x-y) : [];
  if (!a.length) return 0;
  const idx = Math.floor((p/100)*(a.length-1));
  return a[idx];
}
app.get("/metrics", (req, res) => {
  try {
    const lats = Array.isArray(metrics.latencies) ? metrics.latencies : [];
    const avg = lats.length ? lats.reduce((a,b)=>a+b,0) / lats.length : 0;
    const payload = {
      ok: true,
      sessionId: String(SESSION_ID),
      startedAt: safeNum(STARTED_AT),
      uptimeSec: safeNum((Date.now()-STARTED_AT)/1000,0)|0,
      requests: {
        total: safeNum(metrics.requests?.total),
        errors: safeNum(metrics.requests?.errors),
        byRoute: metrics.requests?.byRoute || {}
      },
      latencyMs: {
        avg: safeNum(Number((avg||0).toFixed(1)),0),
        p50: safeNum(Number(percentile(lats,50).toFixed(1)),0),
        p95: safeNum(Number(percentile(lats,95).toFixed(1)),0),
      },
      openai: {
        calls: safeNum(metrics.openai?.calls),
        errors: safeNum(metrics.openai?.errors),
        prompt_tokens: safeNum(metrics.openai?.prompt_tokens),
        completion_tokens: safeNum(metrics.openai?.completion_tokens),
        total_tokens: safeNum(metrics.openai?.total_tokens),
        estimated_stream_tokens: safeNum(metrics.openai?.estimated_stream_tokens),
      },
      costUsd: {
        prompt: round2(metrics.costUsd?.prompt),
        completion: round2(metrics.costUsd?.completion),
        total: round2(metrics.costUsd?.total),
        unit: {
          promptPer1k: safeNum(PRICE_PROMPT_PER_1K),
          completionPer1k: safeNum(PRICE_COMPLETION_PER_1K),
        },
      },
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  } catch {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end('{"ok":false,"error":"metrics_failed"}');
  }
});

// Helper SSE : préserve les \n
function sseSendText(res, text) {
  const lines = String(text).split("\n");
  for (const l of lines) res.write(`data: ${l}\n`);
  res.write("\n");
}

// Recherche RAG (POST { query, k?, minScore? })
app.post("/api/rag/search", async (req, res) => {
  try {
    const { query, k, minScore } = req.body || {};
    if (!query || !String(query).trim()) {
      return res.status(400).json({ ok: false, error: "missing_query" });
    }
    const hits = await searchRag(query, Number(k) || 6, {
      minScore: typeof minScore === "number" ? minScore : undefined,
    });
    res.json({ ok: true, hits });
  } catch (e) {
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ----- Question Coach (JSON) -----
app.post("/api/coach", async (req, res) => {
  try {
    if (!LLM_API_KEY) return sendJsonError(res, 500, "missing_api_key", "LLM key absente", req.id);

    const { name, question, extra } = req.body || {};
    const q = String(question || "").trim();
    const userExtra = String(extra || "").trim();

    const messages = [
      {
        role: "system",
        content: `
Tu es LYRA, et tu aides l'utilisateur à FORMULER une bonne question pour un tirage de Tarot de Marseille (guidance, pas de voyance).
Réponds STRICTEMENT au format JSON, en français, avec ces clés:
- quality: "ok" | "needs_clarify"
- issues: string[]  (liste courte de problèmes : trop vague, multiple sujets, question fermée…)
- suggestions: string[] (2 à 3 reformulations prêtes à l'emploi, claires, orientées action)
- followup: string (UNE question ouverte, très courte)
- ok_to_draw: boolean (true si la question est suffisamment claire pour lancer le tirage)
Rappels: pas de prédiction, pas de santé/juridique/financier. Garde un ton chaleureux et direct.`
        .trim()
      },
      {
        role: "user",
        content:
          `Prénom: ${name || "Voyageur"}\n` +
          `Question initiale: ${q || "(aucune)"}\n` +
          (userExtra ? `Précision utilisateur: ${userExtra}\n` : "") +
          `Consigne: analyse la clarté, puis renvoie le JSON demandé.`
      }
    ];

    const params = {
      model: LLM_MODEL,
      temperature: 0.3,
      top_p: 1,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages
    };

    const upstream = await withTimeout(
      (signal) =>
        openai("/v1/chat/completions", {
          method: "POST",
          signal,
          body: JSON.stringify(params),
        }),
      30_000
    );

    if (!upstream.ok) {
      metrics.openai.errors += 1;
      const detail = await upstream.text().catch(() => "");
      return sendJsonError(res, 502, "upstream_error", detail || "Bad upstream", req.id);
    }

    const data = await upstream.json().catch(() => null);
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    metrics.openai.calls += 1;
    const usage = data?.usage || {};
    metrics.openai.prompt_tokens += usage.prompt_tokens || 0;
    metrics.openai.completion_tokens += usage.completion_tokens || 0;
    metrics.openai.total_tokens += (usage.total_tokens || 0);

    return res.json({ ok: true, ...parsed });
  } catch (err) {
    console.error("[lyra] /api/coach error:", err);
    metrics.openai.errors += 1;
    return sendJsonError(res, 500, "server_error", "Erreur interne", req.id);
  }
});

// JSON (fallback non-stream)
app.post("/api/lyra", async (req, res) => {
  try {
    if (!LLM_API_KEY) return sendJsonError(res, 500, "missing_api_key", "LLM key absente", req.id);

    // Ajout d'un mock pour les tests avec une clé factice
    if (LLM_API_KEY === "DUMMY_KEY_FOR_TESTING") {
      console.log("[lyra] DUMMY_KEY_FOR_TESTING: returning mocked response.");
      return res.json({ ok: true, text: "Réponse de test simulée." });
    }

    const { name, question, cards, userMessage, history } = req.body || {};

    // --- RAG facultatif (active si RAG_ENABLE=1 dans server/.env)
    let ragContext = "";
    try {
      if (process.env.RAG_ENABLE === "1") {
        const qForRag = [
          question && `Question: ${question}`,
          Array.isArray(cards) && cards.length ? `Cartes: ${cards.join(" · ")}` : null,
          userMessage && `Message: ${userMessage}`,
        ].filter(Boolean).join(" | ");
        const hits = await searchRag(qForRag || userMessage || question || "", 5, { minScore: 0.18 });
        ragContext = formatRagContext(hits);
        if (ragContext) console.log("[RAG ctx]\n" + ragContext + "\n---");
      }
    } catch {}

    // construire les messages APRÈS avoir calculé ragContext
    let messages = buildMessages({ name, question, cards, userMessage, history });
    if (ragContext) {
      messages = [
        messages[0], // system initial
        { role: "system", content: ragContext },
        ...messages.slice(1),
      ];
    }

    const firstTurn = !userMessage;
    const params = {
      model: LLM_MODEL,
      temperature: firstTurn ? 0.6 : 0.5,
      top_p: 1,
      max_tokens: firstTurn ? 700 : 400,
      messages,
    };

    const upstream = await withTimeout(
      (signal) =>
        openai("/v1/chat/completions", {
          method: "POST",
          signal,
          body: JSON.stringify(params),
        }),
      45_000
    );

    if (!upstream.ok) {
      metrics.openai.errors += 1;
      const detail = await upstream.text().catch(() => "");
      return sendJsonError(res, 502, "upstream_error", detail || "Bad upstream", req.id);
    }

    const data = await upstream.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content?.trim?.() || "";

    // usage tokens
    const usage = data?.usage || {};
    const pt = usage.prompt_tokens || 0;
    const ct = usage.completion_tokens || 0;
    const tt = usage.total_tokens || (pt + ct);

    metrics.openai.calls += 1;
    metrics.openai.prompt_tokens += pt;
    metrics.openai.completion_tokens += ct;
    metrics.openai.total_tokens += tt;

    if (PRICE_PROMPT_PER_1K || PRICE_COMPLETION_PER_1K) {
      metrics.costUsd.prompt += (pt / 1000) * PRICE_PROMPT_PER_1K;
      metrics.costUsd.completion += (ct / 1000) * PRICE_COMPLETION_PER_1K;
      metrics.costUsd.total = metrics.costUsd.prompt + metrics.costUsd.completion;
    }

    return res.json({ ok: true, text });
  } catch (err) {
    console.error("[lyra] /api/lyra error:", err);
    metrics.openai.errors += 1;
    return sendJsonError(res, 500, "server_error", "Erreur interne", req.id);
  }
});

// SSE streaming
app.post("/api/lyra/stream", async (req, res) => {
  console.log("[lyra] stream call", {
    reqId: req.id,
    hasKey: !!LLM_API_KEY,
    hasMsg: !!(req.body && req.body.userMessage),
    cards: (req.body?.cards || []).length,
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Request-Id": req.id,
  });

  const endWithErr = (code, message) => {
    res.write(`data: ${JSON.stringify({ error: code, message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    if (!LLM_API_KEY) return endWithErr("missing_api_key", "LLM key absente");

    // Ajout d'un mock pour les tests avec une clé factice
    if (LLM_API_KEY === "DUMMY_KEY_FOR_TESTING") {
      console.log("[lyra/stream] DUMMY_KEY_FOR_TESTING: returning mocked stream.");
      res.write("data: [OPEN]\n\n");
      sseSendText(res, "Réponse de test simulée.");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const { name, question, cards, userMessage, history } = req.body || {};

    // --- RAG facultatif
    let ragContext = "";
    try {
      if (process.env.RAG_ENABLE === "1") {
        const qForRag = [
          question && `Question: ${question}`,
          Array.isArray(cards) && cards.length ? `Cartes: ${cards.join(" · ")}` : null,
          userMessage && `Message: ${userMessage}`,
        ].filter(Boolean).join(" | ");
        const hits = await searchRag(qForRag || userMessage || question || "", 5, { minScore: 0.18 });
        ragContext = formatRagContext(hits);
        if (ragContext) console.log("[RAG ctx]\n" + ragContext + "\n---");
      }
    } catch {}

    let messages = buildMessages({ name, question, cards, userMessage, history });
    if (ragContext) {
      messages = [
        messages[0],
        { role: "system", content: ragContext },
        ...messages.slice(1),
      ];
    }

    // ping lisible
    res.write("data: [OPEN]\n\n");

    const firstTurn = !userMessage;
    const params = {
      model: LLM_MODEL,
      temperature: firstTurn ? 0.6 : 0.5,
      top_p: 1,
      max_tokens: firstTurn ? 700 : 400,
      messages,
      stream: true,
    };

    const upstream = await withTimeout(
      (signal) =>
        openai("/v1/chat/completions", {
          method: "POST",
          signal,
          body: JSON.stringify(params),
        }),
      45_000
    );

    if (!upstream.ok || !upstream.body) {
      metrics.openai.errors += 1;
      const txt = await upstream.text().catch(() => "");
      return endWithErr("upstream_error", txt || "Bad upstream");
    }
    
    metrics.openai.calls += 1;
    
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();
    let buffer = "";
    let streamedChars = 0;

    // --- Nouveau : petit buffer pour regrouper les tokens ---
    let outBuf = "";
    let lastFlush = Date.now();
    const shouldFlush = (force = false) => {
      if (!outBuf) return false;
      const sentenceEnd = /[\.!\?\n…]$/.test(outBuf);
      const longChunk   = outBuf.length > 160;
      const timedOut    = Date.now() - lastFlush > 180; // 180ms max sans flush
      if (force || sentenceEnd || longChunk || timedOut) {
        sseSendText(res, outBuf);
        outBuf = "";
        lastFlush = Date.now();
        return true;
      }
      return false;
    };

    const forwardLine = (line) => {
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        const est = Math.ceil(streamedChars / 4);
        metrics.openai.estimated_stream_tokens += est;
         // flush final
        shouldFlush(true);
        res.write("data: [DONE]\n\n");
        res.end();
        return "done";
      }
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content || "";
        if (delta) {
          streamedChars += delta.length;
          outBuf += delta;
          shouldFlush(false);
        }
      } catch {
        if (payload) {
          streamedChars += payload.length;
          outBuf += payload;
          shouldFlush(false);
        }
      }
      return null;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trimEnd();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        const end = forwardLine(line);
        if (end === "done") return;
      }
    }

    const est = Math.ceil(streamedChars / 4);
    // flush final si reste
    shouldFlush(true);
    metrics.openai.estimated_stream_tokens += est;
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[lyra] /api/lyra/stream error:", err);
    try {
      endWithErr("server_error", "Erreur interne");
    } catch {}
  }
});

// Lancement
app.listen(PORT, () => {
  console.log(`Lyra backend on http://localhost:${PORT}`);
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
});

// server/index.js
app.post("/api/question", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "question manquante" });
  }

  // Appelle RAG
  const hits = await searchRag(question, 6, { minScore: 0.6 });
  const context = formatRagContext(hits);

  return res.json({ ok: true, context });
});