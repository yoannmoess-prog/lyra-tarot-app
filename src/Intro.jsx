// src/Intro.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Intro.css";
import logo from "./assets/logo.webp";
import arrow from "./assets/arrowtoright_01.png";
import bg from "./assets/background.jpg";

export default function Intro() {
  const nav = useNavigate();
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const mainRef = useRef(null);
  const startRef = useRef(null);

  const DUR = 2000;

  const go = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => nav("/name"), DUR);
  }, [leaving, nav]);

  // Fade-in + focus automatique du conteneur
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setEntered(true);
      mainRef.current?.focus(); // ✅ focus via ref
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Clavier : Enter ou Espace → go()
  useEffect(() => {
    const onKey = (e) => {
      if (!leaving) {
  e.preventDefault(); // pour éviter un scroll par erreur
  go();
}
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, leaving]);

  const begin = (x, y) => {
    startRef.current = { x, y, t: Date.now() };
  };
  const end = (x, y) => {
    const s = startRef.current;
    if (!s) return;
    const dx = x - s.x;
    const dy = Math.abs(y - s.y);
    const dt = Date.now() - s.t;
    if (dx < -35 && dy < 120 && dt < 900) go();
  };

  return (
    <main
      ref={mainRef} // ✅ ref ici
      className={`intro-root ${entered ? "enter" : ""} ${leaving ? "leaving" : ""}`}
      style={{ backgroundImage: `url(${bg})` }}
      onClick={go}
      onTouchStart={(e) => begin(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
      onTouchEnd={(e) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
      onPointerDown={(e) => begin(e.clientX, e.clientY)}
      onPointerUp={(e) => end(e.clientX, e.clientY)}
      aria-label="Écran d’introduction — touchez, cliquez ou balayez pour continuer"
      role="button"
      tabIndex={0}
    >
      <div className="intro-stack">
        <img className="intro-item logo" src={logo} alt="" aria-hidden="true" />
        <h1 className="intro-item title">LYRA</h1>
        <p className="intro-item tagline">La Voix du Tarot de Marseille</p>
        <img className="intro-item arrow pulse" src={arrow} alt="" aria-hidden="true" />
      </div>
    </main>
  );
}