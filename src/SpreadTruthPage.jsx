// src/SpreadTruthPage.jsx
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
  return fileName;
}
const pick = (arr) => (arr?.length ? arr[Math.floor(Math.random() * arr.length)] : null);

/* ---------------- Component ---------------- */
export default function SpreadTruthPage() {
  const pickCardLogic = () => {
    const newCard = pick(FACE_POOLS.majors);
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
    draggedCard,
    isDragging,
    DUR,
    pickCardTo,
    handleDragStart,
    handleDragEnd,
  } = useSpreadPage("spread-truth", pickCardLogic);

  const animationClass = boardFading ? "fade-out-2s" : arrive ? "fade-in-soft" : "pre-fade";
  const containerStyle = isDragging ? { transform: "none" } : {};

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} dropAnimation={null}>
      <div className={`page4-root ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}>
        <div className={`page4-container ${animationClass}`} style={containerStyle}>
          <div className="title-block">
            <div className="p4-fixed-title">{question}</div>
          </div>

          <div className={`board ${isLandscape ? "" : "col"}`}>
            <div className="deck-block">
              <DraggableHandle />
              <div
                ref={deckRef}
                className={`deck-area ${shuffleActive ? "shuffling" : ""}`}
              >
                {[...Array(activeId ? deckCount - 1 : deckCount)].map((_, i) => (
                  <div
                    key={`deck-card-${i}`}
                    className="card card-back stack"
                    style={{ zIndex: i + 1 }}
                  />
                ))}
              </div>
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

function DraggableHandle() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "deck-handle",
  });

  // Pour corriger le bug de l'aperçu, nous rendons la poignée invisible
  // pendant le glisser-déposer. Cela permet au DragOverlay de fonctionner
  // correctement sans être affecté par le `transform` de l'élément d'origine.
  const style = {
    visibility: isDragging ? 'hidden' : 'visible',
  };

  return (
    <div
      id="deck-handle"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="draggable-handle"
      role="button"
      aria-label="Touchez ou glissez pour piocher une carte"
    />
  );
}

function DroppableRail({ children }) {
  const { setNodeRef } = useDroppable({ id: "rail" });
  return <div ref={setNodeRef} className="chosen-rail">{children}</div>;
}
