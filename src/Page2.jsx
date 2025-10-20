// src/Page2.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Page2.css";

export default function Page2() {
  const nav = useNavigate();
  const inputRef = useRef(null);

  // ----- État -----
  const [name, setName] = useState("");
  // "form" → "formOut" → "ovIn" → "ovHold" → "ovOut"
  const [phase, setPhase] = useState("form");
  const [arrive, setArrive] = useState(false); // fade-in 1s à l'arrivée

  const DUR = { formOut: 1000, ovIn: 1000, ovHold: 1000, ovOut: 1000 };

  // ----- Phrases -----
  const greetings = useMemo(
    () => [
      "Commençons par faire connaissance. Je m’appelle Lyra, et toi ?",
      "Je suis Lyra. Et toi, comment puis-je t'appeler à l'aube de ce voyage ?",
      "Mon nom est Lyra. Le tien m’est encore inconnu. Comment dois-je t'appeler ?",
      "Je suis Lyra. Commence par me dire ton prénom. Ce sera notre premier pas.",
      "Un prénom, c’est déjà une intention. Je m’appelle Lyra, et toi ?",
    ],
    []
  );
  const [greeting] = useState(() => greetings[Math.floor(Math.random() * greetings.length)]);

  const transitions = useMemo(
    () => [
      (n) => `Enchantée, ${n}. Et bienvenue dans le monde du Tarot.`,
      (n) => `Bonjour, ${n}. Heureuse que les cartes nous aient réunis.`,
      (n) => `Bienvenue, ${n}. Faisons parler le Tarot ensemble.`,
      (n) => `Enchantée, ${n}. Notre voyage avec le Tarot commence maintenant.`,
      (n) => `Bienvenue parmi les symboles, ${n}. Que le Tarot t'ouvre ses portes !`,
      (n) => `C’est un plaisir de t'accueillir, ${n}. Bienvenue là où les symboles prennent tout leurs sens.`,
    ],
    []
  );
  const [overlayText, setOverlayText] = useState("");

  // ----- Mount: focus + fade-in 2s -----
  useEffect(() => {
    const raf = requestAnimationFrame(() => setArrive(true));
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(id); };
  }, []);

  // ----- Transition orchestrée -----
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const begin = (finalName) => {
    if (phase !== "form") return; // évite double déclenchement
    const pick = transitions[Math.floor(Math.random() * transitions.length)];
    setOverlayText(pick(finalName));
    setPhase("formOut"); // 1) fade-out form (2s)

    timers.current.push(setTimeout(() => {
      setPhase("ovIn");  // 2) overlay in (2s)
      timers.current.push(setTimeout(() => {
        setPhase("ovHold"); // 3) hold (2s)
        timers.current.push(setTimeout(() => {
          setPhase("ovOut"); // 4) overlay out (2s)
          timers.current.push(setTimeout(() => {
            nav("/question", { state: { name: finalName } }); // 5) route
          }, DUR.ovOut));
        }, DUR.ovHold));
      }, DUR.ovIn));
    }, DUR.formOut));
  };

  const onSubmit = (e) => {
    if (e) e.preventDefault();
    const v = name.trim();
    if (!v) return;
    begin(v);
  };

  const showForm = phase === "form" || phase === "formOut";
  const isGone = !showForm;
  const showOverlay = phase === "ovIn" || phase === "ovHold" || phase === "ovOut";

  return (
    <main
      className="name-wrap"
    >
        <div className={`name-inner ${arrive ? "arrive" : "pre"} ${phase === "formOut" ? "leaving" : ""} ${isGone ? "gone" : ""}`} style={{pointerEvents: showForm ? 'auto' : 'none'}}>
          <h1 className="name-title">{greeting}</h1>

          <form className="name-form" onSubmit={onSubmit} autoComplete="off">
            <label className="sr-only" htmlFor="name">Votre prénom</label>
            <div className="input-bubble">
              <input
                id="name"
                ref={inputRef}
                placeholder="Ton prénom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
                aria-label="Ton prénom"
              />
              <button type="submit" className="send-btn" aria-label="Envoyer" title="Envoyer">
                <span
                  className="material-symbols-outlined"
                  style={{ color: name ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }}
                >
                  arrow_forward
                </span>
              </button>
            </div>
          </form>
        </div>

      {showOverlay && (
        <div
          className={
            "name-overlay " +
            (phase === "ovIn" ? "overlay-in" : phase === "ovHold" ? "overlay-hold" : "overlay-out")
          }
          aria-live="polite"
        >
          <p className="overlay-text">{overlayText}</p>
        </div>
      )}
    </main>
  );
}
