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

let STORE = null; // Les données ne sont plus chargées au démarrage
let storePromise = null; // Pour gérer les chargements concurrents

async function loadStore() {
  const file = path.resolve(process.cwd(), STORE_PATH);
  console.log(`[rag] Lecture du store : ${file}`);
  if (!fs.existsSync(file)) {
    console.warn(`[rag] Store introuvable : ${file}. Lancez d'abord : npm run rag:embed`);
    return [];
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
    } catch (e) {
      console.warn(`[rag] Ligne JSON invalide ignorée : ${l}`, e);
    }
  }
  console.log(`[rag] ${tmp.length} chunks chargés en mémoire.`);
  return tmp;
}

// `getStore` garantit que le store n'est chargé qu'une seule fois.
async function getStore() {
  if (STORE) return STORE;
  if (!storePromise) {
    storePromise = loadStore().then(loadedStore => {
      STORE = loadedStore;
      globalThis.__RAG_STORE_COUNT__ = STORE.length;
      return STORE;
    });
  }
  return storePromise;
}


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
    "peur", "crain", "crains", "dout", "anxiété", "angoisse", "permis de conduire",
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

  // Si aucun mot-clé n'est trouvé, on utilise le tirage par défaut sans appeler le LLM.
  // C'est plus rapide, plus fiable et moins coûteux.
  console.log(`[rag] Méthode : Défaut. Aucun mot-clé de peur détecté. Utilisation du spread-advice.`);
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

// `initRag` ne fait plus rien, le chargement est maintenant paresseux.
export async function initRag() {
  console.log("[rag] Initialisation différée. Le store sera chargé à la première requête.");
  // On s'assure que la variable globale est initialisée pour la compatibilité
  if (typeof globalThis.__RAG_STORE_COUNT__ === 'undefined') {
    globalThis.__RAG_STORE_COUNT__ = 0;
  }
}

export async function searchRag(query, k = 6, opts = {}) {
  const store = await getStore();
  if (!store.length) return [];

  const qv = await embed(String(query).slice(0, 4000));
  const scored = store.map((r) => ({
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
