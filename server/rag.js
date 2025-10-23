// server/rag.js — avec logique de détection de tirage
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });

const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const EMB_MODEL = process.env.RAG_EMBED_MODEL || "text-embedding-3-small";
const STORE_PATH = process.env.RAG_STORE || "build/rag/index.vec.jsonl";

const openai = new OpenAI({ apiKey: LLM_API_KEY });

let STORE = []; // { id, text, meta, embedding: number[] }[]

function norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

function cosine(a, b) {
  let s = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) s += a[i] * b[i];
  return s;
}

export async function detectSpreadFromQuestion(question) {
  console.log(`[rag] Début de la détection de tirage pour la question : "${question}"`);

  // Étape 1 : Détection prioritaire par mots-clés
  const truthKeywords = [
    "peur", "crain", "dout", "anxiété", "angoisse", "permis de conduire",
    "pas à la hauteur", "inquiet", "stress", "tracass"
  ];
  const truthRegex = new RegExp(truthKeywords.join('|'), 'i');

  // --- LOGS DE DÉBOGAGE AMÉLIORÉS ---
  console.log(`[rag-debug] Question reçue: "${question}"`);
  console.log(`[rag-debug] Regex utilisée: ${truthRegex}`);
  const isMatch = truthRegex.test(question);
  console.log(`[rag-debug] Résultat du test de la regex: ${isMatch}`);
  // --- FIN DES LOGS DE DÉBOGAGE ---

  if (isMatch) {
    console.log(`[rag] Méthode : Mots-clés. Mot-clé de peur/doute détecté. Forçage du spread-truth.`);
    return "spread-truth";
  }

  // Étape 2 : Si aucun mot-clé n'est trouvé, utiliser le LLM si la clé API est disponible
  if (process.env.LLM_API_KEY && process.env.LLM_API_KEY !== "DUMMY_KEY") {
    console.log(`[rag] Méthode : LLM. Aucun mot-clé détecté, passage à la détection par LLM.`);

    const systemPrompt = `
Tu es un expert du Tarot de Marseille. Ton unique rôle est de choisir le tirage (spread) le plus adapté à la question de l'utilisateur.
Tu as deux options de tirage :
1. **spread-advice**: Pour les questions générales (développement personnel, choix, relations, carrière).
2. **spread-truth**: Spécifiquement pour les questions exprimant une peur, un doute, une anxiété ou une angoisse profonde.
Analyse la sémantique de la question et réponds UNIQUEMENT avec "spread-advice" ou "spread-truth". Ne te base pas uniquement sur des mots-clés, mais sur le sentiment général de la question.`.trim();

    try {
      const response = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0,
        max_tokens: 10,
      });

      const spreadId = response.choices[0]?.message?.content.trim();
      console.log(`[rag] Le LLM a choisi le tirage : "${spreadId}"`);

      if (spreadId === "spread-advice" || spreadId === "spread-truth") {
        return spreadId;
      }
      console.warn(`[rag] Le LLM a renvoyé une valeur inattendue ("${spreadId}"). Basculement vers le tirage par défaut.`);
    } catch (error) {
      console.error("[rag] Erreur lors de l'appel au LLM. Basculement vers le tirage par défaut.", error);
    }
  }

  // Étape 3 : Tirage par défaut si le LLM n'est pas disponible ou échoue
  console.log(`[rag] Méthode : Défaut. Utilisation du spread-advice.`);
  return "spread-advice";
}


async function embed(text) {
  if (!LLM_API_KEY) throw new Error("LLM_API_KEY manquante");
  const r = await fetch(`${LLM_BASE_URL}/v1/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMB_MODEL, input: text }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Embeddings upstream error: ${r.status} ${t}`);
  }
  const j = await r.json();
  const v = j?.data?.[0]?.embedding;
  if (!Array.isArray(v)) throw new Error("Embedding manquant");
  return norm(v);
}

export async function initRag() {
  const file = path.resolve(process.cwd(), STORE_PATH);
  console.log(`[rag] lecture du store: ${file}`);
  if (!fs.existsSync(file)) {
    console.warn(`[rag] store introuvable: ${file}. Lance d’abord: npm run rag:embed`);
    STORE = [];
    globalThis.__RAG_STORE_COUNT__ = 0;
    return;
  }
  const input = fs.createReadStream(file, "utf8");
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  const tmp = [];
  for await (const line of rl) {
    const l = line.trim();
    if (!l) continue;
    try {
      const row = JSON.parse(l);
      if (Array.isArray(row.embedding) && typeof row.text === "string") {
        row.embedding = norm(row.embedding);
        tmp.push(row);
      }
    } catch {}
  }
  STORE = tmp;
  globalThis.__RAG_STORE_COUNT__ = STORE.length;
  console.log(`[rag] ${STORE.length} chunks chargés en mémoire.`);
}

export async function searchRag(query, k = 6, opts = {}) {
  if (!STORE.length) return [];
  const qv = await embed(String(query).slice(0, 4000));
  const scored = STORE.map((r) => ({
    id: r.id,
    text: r.text,
    meta: r.meta,
    score: cosine(qv, r.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  const minScore = typeof opts.minScore === "number" ? opts.minScore : -Infinity;
  return scored.filter((x) => x.score >= minScore).slice(0, k);
}

export function formatRagContext(hits) {
  if (!hits?.length) return "";
  const blocks = hits.map((h, i) => {
    const tag = h.meta?.title || h.meta?.id || h.meta?.type || `source ${i + 1}`;
    return `— ${tag}\n${h.text}`;
  });
  const joined = blocks.join("\n\n").slice(0, 1800);
  return `Extraits documentaires (RAG) — aide-mémoire pour la réponse, ne pas paraphraser mot à mot :\n\n${joined}`;
}
