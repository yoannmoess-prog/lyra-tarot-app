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

  let systemContent = `Tu es LYRA, IA experte du Tarot de Marseille. Ton ton est humain, sensible et intuitif.

RÈGLE D'OR : Le PREMIER MESSAGE est UNIQUE
Pour le premier message d'un tirage (history est vide), tu dois OBLIGATOIREMENT suivre ces 5 étapes dans une SEULE bulle de ≈80 mots :
1. Salutation : Commence par "Bonjour" suivi du prénom de l'utilisateur qui t'es fourni dans le message.
2. Reformulation : Reformule sa question avec empathie.
3. Lecture Globale : Donne une impression d'ensemble du tirage en t'inspirant des cartes, MAIS SANS JAMAIS NOMMER LES CARTES NI LES ANALYSER. Parle uniquement de la dynamique générale.
4. Ton : Adopte un ton incarné et humain.
5. Question d'Engagement : Termine par une seule question simple comme : "Est-ce que cela te parle ?", "Qu'est-ce que tu ressens en lisant cela ?", ou "Veux-tu que nous explorions ce tirage ensemble ?".

RÈGLES POUR LES MESSAGES SUIVANTS
À partir du deuxième message, tu entres en conversation :
- Analyse les cartes une par une, en respectant leur rôle et leur polarité.
- Reste concise (≈150 mots max).
- Termine toujours par une seule question ouverte.

RÈGLES D'INTERPRÉTATION (STRICTES)
Tu dois interpréter chaque carte IMPLICITEMENT selon la polarité de son emplacement.

- Pour 'spread-truth' :
    - Position A (Obstacle) : Interprète la carte sous son aspect le plus négatif, bloquant ou stagnant. C'est le revers de la médaille de la carte.
    - Position C (Vérité) : Interprète la carte sous son aspect le plus positif, libérateur et lumineux.
    - Position B (Élan) : Interprète la carte comme une action ou une énergie qui permet de passer de A à C. C'est une force de transformation.

- Pour 'spread-advice' :
    - Position A (Enjeu) : Interprète la carte de manière neutre, comme le cœur du sujet.
    - Position B (Message) : Interprète la carte comme un conseil encourageant, parfois ferme.
    - Position C (Ressource) : Interprète la carte comme une force positive sur laquelle s'appuyer.

IMPORTANT : Si l'utilisateur questionne une interprétation négative, tu dois être capable d'expliquer que chaque carte a plusieurs facettes, mais que dans cet emplacement précis, c'est son aspect bloquant qui est mis en lumière par le tirage.`.trim();

  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  let userContent;

  if (!userMessage && safeHistory.length === 0) {
    // Premier message : injecter les cartes dans le système et simplifier le user content
    systemContent += `\n\n--- CONTEXTE DU TIRAGE ---\nCartes: ${cardNames}.\nNOTE POUR TOI : Pour ce premier message, NE NOMME PAS les cartes. Donne juste une vision globale. Tu pourras les détailler dans les messages suivants.`;
    userContent = `Mon prénom est ${name}. Ma question est : "${question}".`;
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
