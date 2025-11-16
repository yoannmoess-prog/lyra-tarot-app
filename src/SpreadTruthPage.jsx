// src/SpreadTruthPage.jsx
import React from "react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useSpreadPage } from "./hooks/useSpreadPage";
import "./Page4.css";

/* ---------------- Component ---------------- */
export default function SpreadTruthPage() {
  const {
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
    deckRef,
    slotRefs,
    flight,
    activeId,
    DUR,
    handleDragStart,
    handleDragEnd,
  } = useSpreadPage("spread-truth", null);

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
                  className={`slot-wrap`}
                >
                  {(() => {
                    const cardData = chosenCards.find(c => c.slotIndex === i);
                    return cardData?.src ? (
                      <img src={cardData.src} alt={cardData.name} className={`card chosen ${i === popIndex ? "pop" : ""}`} />
                    ) : (
                      <div className="card slot-ghost" />
                    );
                  })()}
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
      </div>
    </DndContext>
  );
}

function DraggableHandle() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "deck-handle",
  });

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
  return <div ref={setNodeRef} className="chosen-rail rail-truth">{children}</div>;
}
