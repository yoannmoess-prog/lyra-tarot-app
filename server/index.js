/* eslint-env node */
// server/index.js — Serveur de diagnostic minimal

import express from "express";

const app = express();
const PORT = process.env.PORT || 8787;

app.get("/", (req, res) => {
  res.send("Le serveur de diagnostic est en ligne.");
});

app.listen(PORT, () => {
  console.log(`Serveur de diagnostic démarré sur le port ${PORT}`);
});