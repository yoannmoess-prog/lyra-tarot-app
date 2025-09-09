// src/Page5.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Page5.css";
import background from "./assets/background.jpg";

export default function Page5() {
  const { state } = useLocation();
  const name = (state?.name || "voyageur").trim();
  const question = (state?.question || "").trim();
  const cards = Array.isArray(state?.cards)
    ? state.cards
    : [{slot:0, name:"Carte 1"},{slot:1, name:"Carte 2"},{slot:2, name:"Carte 3"}];

  const cardNames = useMemo(
    () => cards.map((c, i) => (typeof c?.name === "string" && c.name.trim()) || `Carte ${i+1}`),
    [cards]
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div
      className="app-container p5-page"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "transparent",
      }}
    >
      <main className="p5-content">
        {/* Titre */}
        {question && <h2 className="p5-title">{question}</h2>}

        {/* 3 cartes déjà retournées (faces non gérées ici, on affiche juste des placeholders) */}
        <div className="p5-cards-rail">
          {[0,1,2].map((i) => (
            <figure key={`c-${i}`} className="p5-card-outer">
              <div className="p5-card is-front">
                <div className="p5-front-placeholder">{cardNames[i]}</div>
              </div>
              <figcaption className="p5-caption">{cardNames[i]}</figcaption>
            </figure>
          ))}
        </div>

        {/* Dialogue en flux, fade au montage */}
        <section className="p5-chat-col">
          <article className={`chat chat-in ${mounted ? "show" : ""}`}>
            <div className="bubble bubble-in">
              <div className="bubble-name">Lyra</div>
              <p>
                {name}, voici une première lecture de votre tirage (3 cartes). La première
                carte éclaire le contexte, la seconde révèle la tension ou l’obstacle,
                et la troisième indique l’issue possible si vous cultivez l’attitude
                suggérée par l’ensemble.
              </p>
              <p>
                • <strong>Carte 1</strong> — ancre émotionnelle et point de départ.<br/>
                • <strong>Carte 2</strong> — ce qui demande ajustement.<br/>
                • <strong>Carte 3</strong> — la voie d’évolution à privilégier.
              </p>
              <p>
                Posez-vous : « Quelle petite décision concrète puis-je prendre
                aujourd’hui pour me rapprocher de ce que je souhaite ? »
              </p>
            </div>
          </article>

          <article className={`chat chat-out ${mounted ? "show-late" : ""}`}>
            <div className="bubble bubble-out">
              <div className="bubble-name">Vous</div>
              <form onSubmit={(e)=>e.preventDefault()}>
                <input
                  className="msg-input"
                  type="text"
                  placeholder="message…"
                  autoFocus
                />
              </form>
            </div>
          </article>

          <div className="p5-endpad" />
        </section>
      </main>
    </div>
  );
}