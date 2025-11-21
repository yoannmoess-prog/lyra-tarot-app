// src/pages/SpreadsDemo.jsx
import React, { useMemo, useState } from "react";
import "./SpreadsDemo.css";

import { loadSpreadsConfigClient } from "../lib/spreads.client.js";
import { chooseSpreadIdFromConfig } from "../lib/routing.js";
import { buildDeckFromAssets } from "../lib/deck.js";
import { drawSpread } from "../lib/draw.js";

export default function SpreadsDemo() {
  const [question, setQuestion] = useState("");
  const [spreadId, setSpreadId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const deck = useMemo(() => buildDeckFromAssets(), []);

  async function onDraw(e) {
    if (e) e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    try {
      const cfg = await loadSpreadsConfigClient();
      const id = chooseSpreadIdFromConfig(q, cfg);
      const spreadCfg = cfg.spreads[id];

      const drawn = drawSpread(deck, spreadCfg);

      setSpreadId(id);
      setResult({
        positions: spreadCfg.positions,
        cards: drawn,
      });

      console.log("[spread chosen]", id, spreadCfg);
      console.log("[cards]", drawn);
    } catch (err) {
      console.error(err);
      alert("Erreur pendant le tirage (voir console).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sd-wrap">
      <h1>Spreads — Démo sandbox</h1>
      <p className="sd-tip">
        Cette page est une <strong>démo</strong> pour tester le choix de tirage & la pioche contrainte. Ton flow
        principal continue d’utiliser <code>/question</code> → <code>/draw</code>.
      </p>

      <form onSubmit={onDraw} className="sd-form">
        <label htmlFor="q">Pose une question :</label>
        <div className="input-bubble">
          <input
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Comment avancer sereinement dans ce nouveau projet ?"
          />
          <button type="submit" disabled={loading}>
            {loading ? "..." : "Tirer"}
          </button>
        </div>
      </form>

      {spreadId && result && (
        <section className="sd-spread">
          <h2>Tirage : {spreadId}</h2>
          <div className="sd-cards">
            {result.positions.map((pos) => {
              const c = result.cards[pos.key];
              const title = `${pos.label} — ${c.label ?? c.id}`;
              return (
                <figure key={pos.key} className="sd-card">
                  {"imageUrl" in c && c.imageUrl ? (
                    <img src={c.imageUrl} alt={title} />
                  ) : (
                    <div className="ph">{title}</div>
                  )}
                  <figcaption>
                    <div className="pos">{pos.label}</div>
                    <div className="id">{c.label ?? c.id}</div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}