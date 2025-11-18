// src/hooks/useSpreadPage.js
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TRUTH_ORDER } from "../utils/constants";
import { FACE_POOLS, labelFrom, pick } from "../lib/card-helpers";

function internalPickCardLogic(chosenCards, spreadType, slotIndex) {
  const cardPool = (() => {
    if (spreadType === 'spread-truth') {
      return FACE_POOLS.majors;
    }
    // spread-advice logic
    if (slotIndex === 0) return FACE_POOLS.majors;
    if (slotIndex === 1) return FACE_POOLS.minorsValues;
    return FACE_POOLS.minorsCourt;
  })();

  // Filtrer pour n'avoir que les cartes pas encore piochées
  const availableCards = cardPool.filter(
    (card) => !chosenCards.some((chosen) => chosen.id === card.id)
  );

  const newCard = pick(availableCards);
  // Retourner l'objet carte complet pour avoir accès à l'id
  return newCard;
}

export function useSpreadPage(spreadType) {
  const { state } = useLocation();
  const nav = useNavigate();
  const name = state?.name || "voyageur";
  const question = state?.question || "";

  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [arrive, setArrive] = useState(false);
  const [boardFading, setBoardFading] = useState(false);
  const [shuffleActive, setShuffleActive] = useState(false);
  const [deckCount, setDeckCount] = useState(22);
  const [chosenSlots, setChosenSlots] = useState([]);
  const [chosenCards, setChosenCards] = useState([]);
  const [popIndex, setPopIndex] = useState(null);
  const pickingRef = useRef(false);
  const deckRef = useRef(null);
  const slotRefs = [useRef(null), useRef(null), useRef(null)];
  const [flight, setFlight] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const isDragging = activeId !== null;

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

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(pageLoadTimer);
      cancelAnimationFrame(arriveTimer);
    };
  }, []);

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

      // Logique de mise à jour d'état sécurisée pour éviter les "stale closures"
      setChosenCards(prevCards => {
        const newCard = internalPickCardLogic(prevCards, spreadType, prevCards.length);
        const position = spreadType === 'spread-truth' ? TRUTH_ORDER[prevCards.length] : ['A', 'B', 'C'][prevCards.length];
        const cardWithPosition = { ...newCard, pos: position, slotIndex: targetIndex };
        const updatedCards = [...prevCards, cardWithPosition];

        if (updatedCards.length === 3) {
          setShuffleActive(false);
          setTimeout(() => {
            setBoardFading(true);
            const chatPath = spreadType === "spread-advice" ? "/chat-advice" : "/chat-truth";
            setTimeout(() => nav(chatPath, { state: { name, question, cards: updatedCards, spreadId: spreadType, isNew: true } }), DUR.boardFade);
          }, DUR.waitBeforeRedirect);
        }
        return updatedCards;
      });

      setChosenSlots(prevSlots => [...prevSlots, targetIndex]);

      setFlight(null);
      pickingRef.current = false;
    }, DUR.fly);
  };

  const getNextSlot = () => {
    const chosenCount = chosenSlots.length;
    if (spreadType === 'spread-truth') {
      // Les slots sont 0 (A), 2 (C), 1 (B)
      const slotOrder = { 'A': 0, 'B': 1, 'C': 2 };
      const nextPos = TRUTH_ORDER[chosenCount];
      return slotOrder[nextPos];
    }
    // Ordre par défaut pour spread-advice
    const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
    return availableSlots[0];
  };

  const handleDragStart = (event) => {
    // On se contente de marquer le début du glissement.
    // Aucune carte n'est pré-sélectionnée ici.
    if (pickingRef.current || chosenSlots.length >= 3) return;
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    // Quelle que soit l'interaction (clic, glisser-déposer),
    // on déclenche la même action : piocher la prochaine carte.
    setActiveId(null);
    const nextSlot = getNextSlot();
    if (nextSlot !== undefined) {
      pickCardTo(nextSlot);
    }
  };

  return {
    name,
    question,
    isLandscape,
    pageLoaded,
    arrive,
    boardFading,
    shuffleActive,
    deckCount,
    chosenSlots,
    chosenCards,
    popIndex,
    pickingRef,
    deckRef,
    slotRefs,
    flight,
    activeId,
    isDragging,
    DUR,
    pickCardTo,
    handleDragStart,
    handleDragEnd,
  };
}
