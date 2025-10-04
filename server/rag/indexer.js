// ✅ server/rag/indexer.js
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function indexDocuments() {
  console.log("\n📦 Début de l'indexation RAG...");

  try {
    console.log("🛠️  Conversion Markdown → JSONL...");
    await execAsync("node scripts/md2jsonl.mjs fiches build/rag/index.jsonl");

    console.log("🔗 Embedding JSONL → Vectors...");
    await execAsync("node scripts/embed.mjs build/rag/index.jsonl build/rag/index.vec.jsonl");

    console.log("✅ RAG vector store régénéré avec succès.");
  } catch (err) {
    console.error("❌ Erreur pendant le processus RAG :", err);
    throw err;
  }
}
