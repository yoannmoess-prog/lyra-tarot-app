// src/hooks/useSpreadPage.js
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TRUTH_ORDER } from "../utils/constants";

export function useSpreadPage(spreadType, pickCardLogic) {
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

  const pickCardTo = useCallback(
    (targetIndex) => {
      if (pickingRef.current || chosenSlots.length >= 3 || deckCount <= 0) return;
      const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
      if (!availableSlots.includes(targetIndex)) return;

      pickingRef.current = true;
      const fl = computeFlight(targetIndex);
      if (fl) setFlight(fl);

      // The state updates are now immediate
      setDeckCount((n) => Math.max(0, n - 1));
      setPopIndex(targetIndex);
      setTimeout(() => setPopIndex(null), Math.min(450, DUR.fly + 50));

      let newChosenCard;
      let isDuplicate;
      do {
        newChosenCard = pickCardLogic(chosenSlots.length);
        isDuplicate = chosenCards.some((card) => card.name === newChosenCard.name);
      } while (isDuplicate);

      const position =
        spreadType === "spread-truth"
          ? TRUTH_ORDER[chosenSlots.length]
          : ["A", "B", "C"][chosenSlots.length];
      const cardWithPosition = { ...newChosenCard, pos: position, slotIndex: targetIndex };

      const updatedChosenCards = [...chosenCards, cardWithPosition];
      setChosenCards(updatedChosenCards);

      setChosenSlots((prevSlots) => {
        const newSlots = [...prevSlots, targetIndex];
        if (newSlots.length === 3) {
          setShuffleActive(false);
          setTimeout(() => {
            setBoardFading(true);
            const chatPath = spreadType === "spread-advice" ? "/chat-advice" : "/chat-truth";
            setTimeout(
              () =>
                nav(chatPath, {
                  state: { name, question, cards: updatedChosenCards, spreadId: spreadType, isNew: true },
                }),
              DUR.boardFade
            );
          }, DUR.waitBeforeRedirect);
        }
        return newSlots;
      });

      // The timeout is only for cleaning up the animation and the lock
      setTimeout(() => {
        setFlight(null);
        pickingRef.current = false;
      }, DUR.fly);
    },
    [chosenSlots, deckCount, pickCardLogic, spreadType, DUR, nav, name, question, chosenCards]
  );

  const getNextSlot = useCallback(() => {
    const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
    if (availableSlots.length === 0) {
      return undefined;
    }

    if (spreadType === 'spread-truth') {
      const truthSlotOrder = [0, 2, 1]; // Ordre spécifique: A, C, B
      for (const slot of truthSlotOrder) {
        if (availableSlots.includes(slot)) {
          return slot;
        }
      }
    }

    return availableSlots[0]; // Pour 'spread-advice' ou en fallback
  }, [chosenSlots, spreadType]);

  const handleDragStart = (event) => {
    // On se contente de marquer le début du glissement.
    // Aucune carte n'est pré-sélectionnée ici.
    if (pickingRef.current || chosenSlots.length >= 3) return;
    setActiveId(event.active.id);
  };

  const handleDragEnd = useCallback(
    (event) => {
      setActiveId(null);
      const nextSlot = getNextSlot();
      if (nextSlot !== undefined) {
        pickCardTo(nextSlot);
      }
    },
    [getNextSlot, pickCardTo]
  );

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
