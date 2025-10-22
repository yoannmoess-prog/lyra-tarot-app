// src/Page4.jsx — deck → 3 cartes (DebugBar retirée)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page4.css";

/* ---------------- Card Data Helpers ---------------- */
const FACE_MODULES = import.meta.glob("./assets/cards/*.webp", { eager: true });
const asUrl = (m) => (typeof m === "string" ? m : m?.default ?? null);
function buildFacePools() {
  const all = Object.keys(FACE_MODULES)
    .map((p) => {
      const src = asUrl(FACE_MODULES[p]);
      const name = p.split("/").pop() || "";
      return src ? { path: p, name, src } : null;
    })
    .filter(Boolean);
  return {
    majors: all.filter((f) => /^(0\d|1\d|2[0-1])_/.test(f.name)),
    minorsValues: all.filter((f) => /^[DEBC](0[1-9]|10)_/.test(f.name)),
    minorsCourt: all.filter((f) => /^[DEBC]1[1-4]_/.test(f.name)),
  };
}
const FACE_POOLS = buildFacePools();

const MAJOR_LABELS = {
  "00": "Le Mat", "01": "Le Bateleur", "02": "La Papesse", "03": "L’Impératrice", "04": "L’Empereur",
  "05": "Le Pape", "06": "L’Amoureux", "07": "Le Chariot", "08": "La Justice", "09": "L’Hermite",
  "10": "La Roue de Fortune", "11": "La Force", "12": "Le Pendu", "13": "L’Arcane Sans Nom",
  "14": "Tempérance", "15": "Le Diable", "16": "La Maison Dieu", "17": "L’Étoile", "18": "La Lune",
  "19": "Le Soleil", "20": "Le Jugement", "21": "Le Monde",
};
function labelFrom(fileName) {
  if (!fileName) return "";
  const maj = fileName.match(/^([0-2]\d)_/);
  if (maj) return MAJOR_LABELS[maj[1]] || fileName;
  const m = fileName.match(/^([DEBC])(0[1-9]|1[0-4])_/);
  if (!m) return fileName;
  const suit = { D: "Deniers", E: "Épées", B: "Bâtons", C: "Coupes" }[m[1]];
  const num = parseInt(m[2], 10);
  const prep = suit.startsWith("É") ? "d’" : "de ";
  if (num <= 10) return `${num === 1 ? "As" : num} ${prep}${suit}`;
  return `${{ 11: "Valet", 12: "Reine", 13: "Roi", 14: "Cavalier" }[num]} ${prep}${suit}`;
}
const pick = (arr) => (arr?.length ? arr[Math.floor(Math.random() * arr.length)] : null);

/* ---------------- Component ---------------- */
export default function Page4() {
  const { state } = useLocation();
  const nav = useNavigate();
  const name = state?.name || "voyageur";
  const question = state?.question || "";
  const [spreadType, setSpreadType] = useState("tirage-conseil"); // par défaut

  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [arrive, setArrive] = useState(false);
  const [boardFading, setBoardFading] = useState(false);
  const [shuffleActive, setShuffleActive] = useState(false);
  const [deckCount, setDeckCount] = useState(14);
  const [chosenSlots, setChosenSlots] = useState([]);
  const [chosenCards, setChosenCards] = useState([]);
  const [popIndex, setPopIndex] = useState(null);
  const pickingRef = useRef(false);
  const deckRef = useRef(null);
  const slotRefs = [useRef(null), useRef(null), useRef(null)];
  const [flight, setFlight] = useState(null);

  const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const DUR = useMemo(() => ({
    fly: prefersReduced ? 60 : 600,
    waitBeforeRedirect: prefersReduced ? 200 : 1000,
    boardFade: prefersReduced ? 300 : 2000,
  }), [prefersReduced]);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", handleResize);
    const pageLoadTimer = requestAnimationFrame(() => setTimeout(() => setPageLoaded(true), 80));
    const arriveTimer = requestAnimationFrame(() => {
      setArrive(true);
      setShuffleActive(true);
    });

    // Détecter le type de tirage
    if (question) {
      fetch("/api/spread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })
      .then(res => res.json())
      .then(data => {
        if (data.spreadId) {
          setSpreadType(data.spreadId);
          console.log("Spread type set to:", data.spreadId); // Pour le débogage
        }
      })
      .catch(err => console.error("Error detecting spread:", err));
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(pageLoadTimer);
      cancelAnimationFrame(arriveTimer);
    };
  }, [question]);

  const computeFlight = (targetIndex) => {
    const deckEl = deckRef.current;
    const slotEl = slotRefs[targetIndex]?.current;
    if (!deckEl || !slotEl) return null;
    const d = deckEl.getBoundingClientRect();
    const s = slotEl.getBoundingClientRect();
    const dx = s.left + s.width / 2 - (d.left + d.width / 2);
    const dy = s.top + s.height / 2 - (d.top + d.height / 2);
    const scale = s.width / d.width;
    return { key: Date.now(), left: d.left, top: d.top, dx, dy, scale, width: d.width, height: d.height };
  };

  const pickCardTo = (targetIndex) => {
    if (pickingRef.current || chosenSlots.length >= 3 || deckCount <= 0) return;
    const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
    if (!availableSlots.includes(targetIndex)) return;

    pickingRef.current = true;
    const fl = computeFlight(targetIndex);
    if (fl) setFlight(fl);

    setTimeout(() => {
      setDeckCount((n) => Math.max(0, n - 1));
      setPopIndex(targetIndex);
      setTimeout(() => setPopIndex(null), Math.min(450, DUR.fly + 50));

      // Choisir une carte en fonction du tirage
      const newCard = (() => {
        if (spreadType === "tirage-verite") {
          return pick(FACE_POOLS.majors);
        }
        // Logique pour tirage-conseil
        const slot = chosenSlots.length;
        if (slot === 0) return pick(FACE_POOLS.majors);
        if (slot === 1) return pick(FACE_POOLS.minorsValues);
        return pick(FACE_POOLS.minorsCourt);
      })();

      const newChosenCard = { src: newCard?.src, name: labelFrom(newCard?.name) };
      const updatedChosenCards = [...chosenCards, newChosenCard];
      setChosenCards(updatedChosenCards);

      setChosenSlots((prevSlots) => {
        const newSlots = [...prevSlots, targetIndex];
        if (newSlots.length === 3) {
          setShuffleActive(false);
          setTimeout(() => {
            setBoardFading(true);
            setTimeout(() => nav("/chat", { state: { name, question, cards: updatedChosenCards, spreadType, isNew: true } }), DUR.boardFade);
          }, DUR.waitBeforeRedirect);
        }
        return newSlots;
      });

      setFlight(null);
      pickingRef.current = false;
    }, DUR.fly);
  };

  const onClickDeck = () => {
    if (chosenSlots.length >= 3) return;
    const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
    pickCardTo(availableSlots[0]);
  };

  const animationClass = boardFading ? "fade-out-2s" : arrive ? "fade-in-soft" : "pre-fade";

  return (
    <div className={`page4-root ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}>
      <div className={`page4-container ${animationClass}`}>
        <div className="title-block">
          <div className="p4-fixed-title">{question}</div>
        </div>

        <div className={`board ${isLandscape ? "" : "col"}`}>
          <div className="deck-block">
            <div
              ref={deckRef}
              className={`deck-area ${shuffleActive ? "shuffling" : ""}`}
              onClick={onClickDeck}
              role="button"
              tabIndex={0}
              aria-label="Jeu de cartes : touchez pour piocher (séquentiel)"
            >
              {[...Array(deckCount)].map((_, i) => (
                <div key={`deck-${i}`} className="card card-back stack" style={{ zIndex: i }} />
              ))}
            </div>
          </div>
          <div className="chosen-rail">
            {[0, 1, 2].map((i) => (
              <div key={`slotwrap-${i}`} ref={slotRefs[i]} className="slot-wrap" onClick={() => pickCardTo(i)}>
                {chosenSlots.includes(i) ? (
                  <div className={`card card-back chosen ${i === popIndex ? "pop" : ""}`} />
                ) : (
                  <div className="card slot-ghost" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {flight && (
        <div
          key={flight.key}
          className="fly-phys"
          style={{
            left: `${flight.left}px`, top: `${flight.top}px`, width: `${flight.width}px`, height: `${flight.height}px`,
            "--dx": `${flight.dx}px`, "--dy": `${flight.dy}px`, "--scale": flight.scale,
            animationDuration: `${DUR.fly}ms`,
          }}
        >
          <div className="card card-back" />
        </div>
      )}
    </div>
  );
}