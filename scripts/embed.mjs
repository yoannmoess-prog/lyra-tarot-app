// scripts/embed.mjs
// Usage: node scripts/embed.mjs input.jsonl output.jsonl
// Lit un JSONL (id,text,meta) et écrit un JSONL (id,text,meta,embedding)
// Traitement séquentiel pour une meilleure robustesse en production.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });

const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const EMB_MODEL = process.env.RAG_EMBED_MODEL || "text-embedding-3-small";

const args = process.argv.slice(2);
const [inFile, outFile] = args;

if (!inFile || !outFile) {
  console.error("Usage: node scripts/embed.mjs <input.jsonl> <output.jsonl>");
  process.exit(1);
}

const inAbs  = path.resolve(process.cwd(), inFile);
const outAbs = path.resolve(process.cwd(), outFile);

if (!LLM_API_KEY) {
  console.warn("[embed] ⚠️  LLM_API_KEY manquante dans server/.env — génération d'un fichier vide.");
  fs.writeFileSync(outAbs, "");
  process.exit(0);
}

console.log(`[embed] modèle utilisé : ${EMB_MODEL}`);
console.log(`[embed] mode : 🚶 Séquentiel (robuste)`);

async function embedOne(text) {
  const r = await fetch(`${LLM_BASE_URL}/v1/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMB_MODEL, input: text }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Embeddings upstream error: ${r.status} ${t}`);
  }
  const j = await r.json();
  const v = j?.data?.[0]?.embedding;
  if (!Array.isArray(v)) throw new Error("Embedding manquant");
  // normalisation L2
  let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  return v.map(x => x / n);
}

async function run() {
  if (!fs.existsSync(inAbs)) {
    console.error(`[embed] input introuvable: ${inAbs}`);
    process.exit(1);
  }

  // Lecture du fichier de sortie existant (reprise)
  const existing = fs.existsSync(outAbs) ? (await fsp.readFile(outAbs, "utf8")).trim().split("\n").filter(Boolean) : [];
  const doneIds = new Set(existing.map(line => {
    try { return JSON.parse(line).id; } catch { return null; }
  }).filter(Boolean));
  console.log(`[embed] reprise automatique activée → ${doneIds.size} chunks déjà vectorisés.`);

  const input = fs.createReadStream(inAbs, "utf8");
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const out = await fsp.open(outAbs, doneIds.size ? "a" : "w");

  let total = 0;
  let ok = doneIds.size;
  let skipped = 0;

  for await (const line of rl) {
    const l = line.trim();
    if (!l) continue;
    total++;

    try {
      const row = JSON.parse(l);
      if (!row || typeof row.text !== "string") {
        skipped++;
        continue;
      }
      if (doneIds.has(row.id)) {
        skipped++;
        continue;
      }

      // Traitement séquentiel
      const vec = await embedOne(row.text.slice(0, 4000));
      const outRow = { id: row.id, text: row.text, meta: row.meta || {}, embedding: vec };
      await out.write(JSON.stringify(outRow) + "\n");
      ok++;
      if (ok % 10 === 0) console.log(`• ${ok} chunks vectorisés…`);

    } catch (e) {
      console.warn(`[embed] ligne ignorée (${e.message || e})`);
      skipped++;
    }
  }

  await out.close();
  console.log(`✅ OK → ${outAbs}`);
  console.log(`[embed] lignes lues: ${total}, vectorisées: ${ok}, ignorées: ${skipped}`);
}

run().catch(e => {
  console.error("[embed] erreur:", e);
  process.exit(1);
});