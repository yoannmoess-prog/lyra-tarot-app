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
  const systemPrompt = `
    Tu es un expert en tarot et en psychologie. Ton unique rôle est de classifier la question de l'utilisateur pour déterminer le type de tirage de tarot le plus approprié.

    Tu as deux options :
    1.  "tirage-verite" : Choisis cette option si la question révèle une peur profonde, un doute existentiel, un blocage, une quête de vérité cachée, ou un besoin de comprendre les causes profondes d'une situation.
    2.  "tirage-conseil" : Choisis cette option pour toutes les autres questions, notamment celles qui demandent un conseil pratique, une orientation générale, ou une aide à la décision.

    Exemples pour "tirage-verite" :
    - "J'ai peur de sortir dans la rue."
    - "J'ai peur que mon mari me trompe."
    - "Est-ce que je vais trouver l'homme de ma vie ?"
    - "On m'a proposé un projet mais j'ai un blocage."
    - "Je ne sais pas pourquoi je sabote mes relations."

    Exemples pour "tirage-conseil" :
    - "Que dois-je faire pour améliorer ma carrière ?"
    - "J'hésite entre deux offres d'emploi, que me conseillez-vous ?"
    - "Comment puis-je mieux communiquer avec mon fils ?"

    Ta réponse DOIT être UNIQUEMENT "tirage-verite" ou "tirage-conseil", sans aucune autre explication, ponctuation ou texte.
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      temperature: 0,
      max_tokens: 5,
    });

    const result = response.choices[0]?.message?.content?.trim();

    if (result === "tirage-verite" || result === "tirage-conseil") {
      console.log(`[rag] Classification de la question : "${question}" → ${result}`);
      return result;
    } else {
      console.warn(`[rag] Classification inattendue reçue : "${result}". Utilisation du tirage par défaut.`);
      return "tirage-conseil";
    }
  } catch (error) {
    console.error("[rag] Erreur lors de la classification de la question:", error);
    return "tirage-conseil";
  }
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
