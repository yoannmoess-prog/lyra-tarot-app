// src/hooks/useSpreadPage.js
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
  const [targetSlot, setTargetSlot] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const pointerDownRef = useRef(false);

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

  const pickCardTo = (targetIndex, options = {}) => {
    const { isDragEnd = false } = options;
    if (pickingRef.current || chosenSlots.length >= 3 || deckCount <= 0) return;
    const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
    if (!availableSlots.includes(targetIndex)) return;

    pickingRef.current = true;
    const animationDuration = isDragEnd ? 0 : DUR.fly;

    if (!isDragEnd) {
      const fl = computeFlight(targetIndex);
      if (fl) setFlight(fl);
    }

    setTimeout(() => {
      setDeckCount((n) => Math.max(0, n - 1));
      setPopIndex(targetIndex);
      setTimeout(() => setPopIndex(null), Math.min(450, DUR.fly + 50));

      let newChosenCard;
      let isDuplicate;
      do {
        newChosenCard = pickCardLogic(chosenSlots.length);
        isDuplicate = chosenCards.some(card => card.name === newChosenCard.name);
      } while (isDuplicate);

      const updatedChosenCards = [...chosenCards, newChosenCard];
      setChosenCards(updatedChosenCards);

      setChosenSlots((prevSlots) => {
        const newSlots = [...prevSlots, targetIndex];
        if (newSlots.length === 3) {
          setShuffleActive(false);
          setTimeout(() => {
            setBoardFading(true);
            const chatPath = spreadType === "spread-advice" ? "/chat-advice" : "/chat-truth";
            setTimeout(() => nav(chatPath, { state: { name, question, cards: updatedChosenCards, spreadId: spreadType, isNew: true } }), DUR.boardFade);
          }, DUR.waitBeforeRedirect);
        }
        return newSlots;
      });

      if (!isDragEnd) {
        setFlight(null);
      }
      pickingRef.current = false;
    }, animationDuration);
  };

  const getNextSlot = () => {
    const chosenCount = chosenSlots.length;
    if (spreadType === 'spread-truth') {
      if (chosenCount === 0) return 0; // A
      if (chosenCount === 1) return 2; // C
      if (chosenCount === 2) return 1; // B
    }
    // Default order for spread-advice
    const availableSlots = [0, 1, 2].filter((i) => !chosenSlots.includes(i));
    return availableSlots[0];
  };

  const onPointerDown = () => {
    pointerDownRef.current = true;
  };

  const onPointerUp = () => {
    if (!isDragging && pointerDownRef.current) {
      pickCardTo(getNextSlot());
    }
    pointerDownRef.current = false;
  };

  const handleDragStart = (event) => {
    if (pickingRef.current || chosenSlots.length >= 3) return;
    setIsDragging(true);
    setTargetSlot(getNextSlot());
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    setTargetSlot(null);
    setIsDragging(false);

    if (event.over && event.over.id === "rail") {
      pickCardTo(getNextSlot(), { isDragEnd: true });
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
    popIndex,
    pickingRef,
    deckRef,
    slotRefs,
    flight,
    activeId,
    targetSlot,
    DUR,
    pickCardTo,
    onPointerDown,
    onPointerUp,
    handleDragStart,
    handleDragEnd,
  };
}
