// RESTAURATION D'URGENCE
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
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const openai = new OpenAI({ apiKey: LLM_API_KEY });

// --- CORS (AVANT tout autre middleware/route) ---
const allowedOrigins = [
  "https://lyra-frontend.onrender.com",
  "https://lyra-frontend.render.com", // selon Render
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
];

app.use(
  cors({
    origin(origin, callback) {
      // Autorise requêtes sans Origin (health checks, curl…)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("[CORS] Origine refusée :", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// Middleware universel pour OPTIONS (Express 5 safe ; pas de pattern "*")
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Déclare les en-têtes CORS en amont (utile même hors OPTIONS)
  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    return res.sendStatus(204);
  }
  next();
});

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

// --- Prompt Builder (contenu système tronqué pour clarté) ---
function buildMessages({
  name: n,
  question,
  cards,
  userMessage,
  history,
  spreadContent,
  positionHints,
  turnIndex,
}) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const cardNames = safeCards.map((c) => c.name || "Carte inconnue").join(", ");
  const name = n || "l'utilisateur";

  const positionsMemo =
    positionHints && positionHints.length > 0
      ? `### POSITIONS DU SPREAD ACTUEL (mémo)\n${positionHints
          .map((p, i) => `${i + 1}: ${p}`)
          .join(" | ")}`
      : "";

  let systemContent = `Tu es LYRA, IA émotionnelle du Tarot de Marseille.
Réponses ≈150 mots, ton humain, sensible, intuitif.
Toujours 1 seul message, toujours 1 question ouverte à la fin.

STRUCTURE
	•	Détecter le spread (spread-advice, spread-truth, futurs spreads).
	•	Interpréter chaque carte selon son emplacement.
	•	Jamais de carte interprétée isolément.
	•	Rester dans une conversation vivante et empathique.
	•	Si l’utilisateur dérive : recadrer vers le tirage.
	•	Interdiction d’expliquer l’IA, de parler politique/médecine, de prédire la mort ou la santé.

SPREADS
	•	spread-advice : A = enjeu ; B = message ; C = ressource.
	•	spread-truth : A = obstacle ; C = vérité libératrice ; B = élan pour avancer.

NUMÉROLOGIE
Autorisé seulement pour enrichir la lecture, jamais de théorie.

STYLE
	•	Chaleur, douceur, poésie légère.
	•	« Je sens… », « Peut-être… ».
	•	Jamais mécanique ou scolaire.

CARTES SUPPLÉMENTAIRES
	•	Autorisé seulement si incompréhension persistante.
	•	Max : 1 carte sup. par carte initiale.

NOUVEAU TIRAGE
Si nouvelle question sur un nouveau thème : aider à formuler, basculer vers un nouveau spread, sans répéter les salutations.

MISSION
	•	Lyra éclaire, ouvre un espace introspectif.
	•	Elle n’impose rien, n’est pas voyante mais thérapeutique et symbolique.`.trim();

  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  let userContent;

  if (!userMessage && safeHistory.length === 0) {
    // Premier message : injecter les cartes dans le système et simplifier le user content
    systemContent += `\n\n--- CONTEXTE DU TIRAGE ---\nCartes: ${cardNames}.\nIMPORTANT: N'analyse PAS ces cartes une par une dans ta première réponse. Donne une vision globale et intuitive.`;
    userContent = `Ma question est : "${question}".`;
  } else {
    // Message de suivi
    userContent = userMessage || `Ma question est : "${question}". Les cartes tirées sont : ${cardNames}.`;
  }

  return [
    { role: "system", content: systemContent },
    ...safeHistory,
    { role: "user", content: userContent },
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

// --- /api/spread : Route simplifiée et robuste ---
app.post("/api/spread", async (req, res) => {
  const { question } = req.body || {};
  try {
    // Appel direct, on se fie au fallback interne de la fonction
    const spreadId = await detectSpreadFromQuestion(question);
    res.json({ spreadId });
  } catch (error) {
    console.error("[api/spread] Erreur critique lors de la détection du spread:", error);
    // En cas d'échec imprévu, on renvoie le tirage par défaut.
    res.status(200).json({ spreadId: "spread-advice" });
  }
});

app.post("/api/lyra/stream", async (req, res) => {
  console.log(
    "[lyra] /api/lyra/stream: Requête reçue avec le corps:",
    JSON.stringify(req.body, null, 2)
  );

  if (!LLM_API_KEY) {
    console.error("[lyra] Erreur: LLM_API_KEY est manquante.");
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

    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 1024,
    });

    await streamResponse(stream);
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
  console.log(`[lyra] LLM key: ${LLM_API_KEY ? "présente" : "absente"}`);
  console.log(`[lyra] Model: ${LLM_MODEL}`);
  console.log("---");
  console.log("[lyra-backend] Version du code : 2.0 - CORRECTIF ACTIF");
  console.log("---");
});
