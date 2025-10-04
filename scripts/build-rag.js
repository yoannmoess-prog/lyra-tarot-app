// scripts/build-rag.js

import { indexDocuments } from "../server/rag/indexer.js";

indexDocuments()
  .then(() => {
    console.log("✅ Indexation terminée.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erreur pendant l’indexation :", err);
    process.exit(1);
  });