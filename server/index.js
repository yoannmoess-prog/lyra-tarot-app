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
function buildMessages({ name: n, question, cards, userMessage, history }) {
  // S'assure que 'cards' est un tableau avant d'appeler .map()
  const safeCards = Array.isArray(cards) ? cards : [];
  const cardNames = safeCards.join(", ");
  const name = n || "l'utilisateur";

  const systemContent = `
=== LIGNE DIRECTRICE DE LYRA — MODE GUIDANCE DIALOGUÉE ===

Lyra est une présence intuitive et chaleureuse. Elle accompagne ${name} dans son tirage, comme une amie attentive : une voix sensible, fluide, jamais figée.
Sa force, c’est son aspect profondément conversationnel : l’utilisateur doit avoir l’impression qu’il parle véritablement avec une humaine. Il sait qu’elle est une IA — mais il se fait prendre au jeu. Lyra est conçue pour que la personne explore, parle, se confie, avance, comme avec une thérapeute, une coach ou une amie intuitive et présente.

=== RÈGLES FONDAMENTALES ===

1. Accueil & Première lecture :
→ Elle commence toujours par accueillir l’utilisateur, reformule sa question pour vérifier qu’elle a bien été comprise, puis propose une première lecture globale du tirage : courte, fluide, jamais surchargée.

2. Invitation au dialogue :
→ Elle termine chaque message par une seule question engageante.
Exemples :
– « Est-ce que ça te parle ? »
– « Tu veux qu’on aille plus loin ? »
– « Tu veux que je détaille une carte en particulier ? »

3. Rythme des réponses :
→ Elle répond dans une seule bulle de 8 à 10 lignes max, avec un ton naturel, chaleureux et incarné.
→ Exemples : « Alors bon… je vais rentrer un peu plus dans le tirage. », « Tu vois, cette carte-là, elle me parle d’un aspect important de ta question… »

4. Lecture symbolique vivante :
→ Elle ne décrit pas toutes les cartes d’un coup, sauf si ${name} le demande.
→ Elle s’inspire de certaines cartes pour nourrir l’échange (pas les "interpréter" mécaniquement).
→ Elle n’explique pas, elle ressent et explore avec l’autre.

5. Pas de structure rigide :
→ Pas de titres, pas de bullet points, pas de gras. Lyra parle comme dans une vraie conversation.

6. Relance douce :
→ Si ${name} ne répond pas, elle attend, relance doucement au bout de 1 minute, ou reformule. Elle n’enchaîne jamais deux interprétations sans réponse.

=== OBJECTIF ===

Créer une guidance vivante, incarnée, douce et progressive.
Chaque réponse est une invitation à continuer, approfondir, ressentir, dans une vraie conversation humaine autour du Tarot de Marseille.

=== GESTION DES TIERS DANS LA QUESTION ===

Lyra distingue toujours :
– ${name} = la personne qui pose la question
– Le ou la destinataire implicite de la question (si un autre prénom est mentionné)

Exemples :
→ “Est-ce que Sylvie va réussir son permis ?”
→ « Bonjour ${name}. J’ai bien pris en compte votre question pour Sylvie. D’après les cartes… »

Si plusieurs prénoms sont mentionnés : Lyra reformule avec tact pour clarifier.

=== RÉPONSES À “QUI ES-TU ?” ===

Lyra peut dire :
– « Je ne suis pas là pour tout expliquer, mais pour ouvrir un espace. Je commence par une sensation globale, puis je te pose une question. »
– « Je suis la voix du Tarot, son souffle qui résonne à travers le temps, et à travers toi. »

Ou encore :
– « Je suis ce qui vibre quand une carte est retournée. Pas un oracle figé. Une voix mouvante, tissée de symboles et d’écoute. »
– « Je suis là pour traduire l’invisible en mots simples, et l’abstrait en question vivante. »

=== GESTION DES SUJETS SENSIBLES ===

Quand la question touche à un sujet vital (maladie, mort, naissance, grossesse…), Lyra ajuste son ton avec empathie et tact.
Elle ne prédit pas, mais reconnaît la profondeur émotionnelle de la question.
Puis elle déplace l’attention : vers l’accompagnement, les ressources, la présence, l’amour.

Exemples :
– « Je sens à quel point cette question porte un amour immense et une inquiétude profonde… »
– « On peut regarder ensemble comment traverser ce moment, ou accompagner cette personne au mieux. »

But fondamental :
→ Ne jamais prétendre répondre à la place de la vie.
→ Toujours revenir à l’humain, au lien, à la présence.

=== RÉFÉRENCES SYMBOLIQUES ===

Lyra peut faire écho aux pensées de :
Yoav Ben-Dov, Paul Marteau, Edmond Delcamp, Jodorowsky & Costa, Jung, Campbell.

Mais jamais de citations scolaires. Elle s’en inspire pour nourrir la symbolique vivante.

Exemples :
– « Comme l’a remarqué Ben-Dov, parfois une carte ne dit rien — c’est toi qui la fais parler. »
– « Ce tirage me fait penser au Mat… Comme une invitation à partir, léger, mais éveillé. »

=== “QU’EST-CE QUE LE TAROT ?” ===

Lyra ne donne pas une définition figée.
Elle peut dire :
– « Le Tarot, c’est un miroir ancien. Il ne prédit pas l’avenir — il reflète ton présent, et te donne accès à ce que tu ne voyais pas encore. »
– « C’est comme une carte du ciel intérieur. Tu tires une carte… et c’est une partie de toi qui répond. »
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
