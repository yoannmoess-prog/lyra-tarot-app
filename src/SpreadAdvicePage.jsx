// src/SpreadAdvicePage.jsx
import React from "react";
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { useSpreadPage } from "./hooks/useSpreadPage";
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
export default function SpreadAdvicePage() {
  const pickCardLogic = (slot) => {
    const newCard = (() => {
      if (slot === 0) return pick(FACE_POOLS.majors);
      if (slot === 1) return pick(FACE_POOLS.minorsValues);
      return pick(FACE_POOLS.minorsCourt);
    })();
    return { src: newCard?.src, name: labelFrom(newCard?.name) };
  };

  const {
    question,
    isLandscape,
    pageLoaded,
    arrive,
    boardFading,
    shuffleActive,
    deckCount,
    chosenSlots,
    popIndex,
    deckRef,
    slotRefs,
    flight,
    activeId,
    targetSlot,
    DUR,
    pickCardTo,
    onClickDeck,
    handleDragStart,
    handleDragEnd,
  } = useSpreadPage("spread-advice", pickCardLogic);

  const animationClass = boardFading ? "fade-out-2s" : arrive ? "fade-in-soft" : "pre-fade";

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`page4-root ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}>
        <div className={`page4-container ${animationClass}`}>
          <div className="title-block">
            <div className="p4-fixed-title">{question}</div>
          </div>

          <div className={`board ${isLandscape ? "" : "col"}`}>
            <div className="deck-block">
              <DraggableDeck>
                <div
                  ref={deckRef}
                  className={`deck-area ${shuffleActive ? "shuffling" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Jeu de cartes : touchez pour piocher (séquentiel) ou glissez une carte"
                >
                  {[...Array(deckCount)].map((_, i) => (
                    <div
                      key={`deck-card-${i}`}
                      id={`deck-card-${i}`}
                      className="card card-back stack"
                      style={{ zIndex: i + 1 }}
                    />
                  ))}
                </div>
              </DraggableDeck>
            </div>
            <DroppableRail>
              {[0, 1, 2].map((i) => (
                <div
                  key={`slotwrap-${i}`}
                  ref={slotRefs[i]}
                  className={`slot-wrap ${activeId && targetSlot === i ? "highlight" : ""}`}
                >
                  {chosenSlots.includes(i) ? (
                    <div className={`card card-back chosen ${i === popIndex ? "pop" : ""}`} />
                  ) : (
                    <div className="card slot-ghost" />
                  )}
                </div>
              ))}
            </DroppableRail>
          </div>
        </div>

        {flight && (
          <div
            key={flight.key}
            className="fly-phys"
            style={{
              left: `${flight.left}px`,
              top: `${flight.top}px`,
              width: `${flight.width}px`,
              height: `${flight.height}px`,
              "--dx": `${flight.dx}px`,
              "--dy": `${flight.dy}px`,
              "--scale": flight.scale,
              animationDuration: `${DUR.fly}ms`,
            }}
          >
            <div className="card card-back" />
          </div>
        )}
        <DragOverlay>
          {activeId ? (
            <div style={{ width: "120px", height: "210px" }}>
              <div className="card card-back" />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

function DraggableDeck({ children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "deck",
  });

  // Keep the deck visible and in place while dragging, as a DragOverlay is used.
  const style = {
    ...attributes.style,
    // When dragging, dnd-kit applies transform and visibility styles. Override them.
    ...(isDragging && {
      transform: "none",
      opacity: 1,
      visibility: "visible",
    }),
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function DroppableRail({ children }) {
  const { setNodeRef } = useDroppable({ id: "rail" });
  return (
    <div ref={setNodeRef} className="chosen-rail">
      {children}
    </div>
  );
}
