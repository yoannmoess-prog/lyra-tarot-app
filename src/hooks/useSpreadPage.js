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
  const dragStartTime = useRef(0);
  const deckRef = useRef(null);
  const slotRefs = [useRef(null), useRef(null), useRef(null)];
  const [flight, setFlight] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const [targetSlot, setTargetSlot] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);
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

  const computeFlight = (targetIndex, fromRect) => {
    const deckEl = deckRef.current;
    const slotEl = slotRefs[targetIndex]?.current;
    if (!slotEl) return null;

    const from = fromRect || deckEl.getBoundingClientRect();
    const to = slotEl.getBoundingClientRect();

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / from.width;

    return {
      key: Date.now(),
      left: from.left,
      top: from.top,
      dx,
      dy,
      scale,
      width: from.width,
      height: from.height,
    };
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

      setFlight(null);
      pickingRef.current = false;
    }, DUR.fly);
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

  const placeCardInSlot = (cardToPlace, slotIndex) => {
    setDeckCount((n) => Math.max(0, n - 1));
    setPopIndex(slotIndex);
    setTimeout(() => setPopIndex(null), Math.min(450, DUR.fly + 50));

    const updatedChosenCards = [...chosenCards, cardToPlace];
    setChosenCards(updatedChosenCards);

    setChosenSlots((prevSlots) => {
      const newSlots = [...prevSlots, slotIndex];
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
    pickingRef.current = false;
  };

  const handleDragStart = (event) => {
    if (pickingRef.current || chosenSlots.length >= 3) return;
    dragStartTime.current = Date.now();
    let newChosenCard;
    let isDuplicate;
    do {
      newChosenCard = pickCardLogic(chosenSlots.length);
      isDuplicate = chosenCards.some((card) => card.name === newChosenCard.name);
    } while (isDuplicate);
    setDraggedCard(newChosenCard);
    setTargetSlot(getNextSlot());
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    setTargetSlot(null);
    const nextSlot = getNextSlot();

    if (nextSlot === undefined || !draggedCard) {
      setDraggedCard(null);
      setActiveId(null);
      return;
    }

    const dragDuration = Date.now() - dragStartTime.current;
    const dragDistance = Math.sqrt(event.delta.x ** 2 + event.delta.y ** 2);
    const isClick = dragDuration < 250 && dragDistance < 10;

    pickingRef.current = true;

    const fromRect = isClick ? null : event.active.rect.current.translated;
    const fl = computeFlight(nextSlot, fromRect);

    // Pour éviter le conflit d'animation, nous désactivons immédiatement
    // le glisser-déposer de dnd-kit AVANT de lancer notre animation.
    setActiveId(null);
    setDraggedCard(null);

    if (fl) setFlight(fl);

    setTimeout(() => {
      placeCardInSlot(draggedCard, nextSlot);
      setFlight(null);
    }, DUR.fly);
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
    draggedCard,
    isDragging,
    dropAnimationCompleted,
    DUR,
    pickCardTo,
    handleDragStart,
    handleDragEnd,
  };
}
