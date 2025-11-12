// src/ChatAdvicePage.jsx — Page de conversation pour "spread-advice"
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import "../components/Modal.css";
import "../ChatPage.css";
import "../Page5.css"; // Ré-ajouté pour les styles des cartes
import { toast } from "../utils/net";
import "../toast.css";
import "../chat-ux.css";

import { streamLyra } from "../utils/streamLyra";
import { TRUTH_ORDER, ADVICE_ORDER } from "../utils/constants";

/* ---------------- Persistance conversation ---------------- */
// La clé de stockage est maintenant dynamique et dépend du spreadId
function getStorageKey(spreadId) {
  return `lyra:conv:${spreadId}`;
}
function loadConv(spreadId) {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(spreadId)) || "[]");
  } catch {
    return [];
  }
}
function saveConv(conv, spreadId) {
  try {
    localStorage.setItem(getStorageKey(spreadId), JSON.stringify(conv));
  } catch {}
}

/* ---------------- UX métriques simples ---------------- */
const UX_STATS_KEY = "lyra:uxstats";
function recordUserMsg(len) {
  try {
    const s = JSON.parse(localStorage.getItem(UX_STATS_KEY) || '{"count":0,"sum":0}');
    const next = { count: (s.count || 0) + 1, sum: (s.sum || 0) + len };
    localStorage.setItem(UX_STATS_KEY, JSON.stringify(next));
  } catch {}
}

/* ---------------- Helpers UI ---------------- */
function firstNameNice(s) {
  const first = String(s || "voyageur").trim().split(/\s+/)[0];
  if (!first) return "Voyageur";
  return first[0].toLocaleUpperCase("fr-FR") + first.slice(1);
}

function getRandomInitialThinkingTime() {
  return Math.floor(Math.random() * 2001) + 1000; // 1–3 sec
}

function getRandomThinkingTime() {
  return Math.floor(Math.random() * 1501) + 1500; // 1.5–3 sec
}

export function fitRail(container, { spreadId, cols = 3, minCard = 120 } = {}) {
  if (!container) return;

  const CARD_ASPECT_RATIO = 18 / 9.27; // Hauteur / Largeur

  const ro = new ResizeObserver(() => {
    const cs = getComputedStyle(container);
    const docEl = document.documentElement;
    const gap = parseFloat(cs.getPropertyValue("--gap")) || 16;
    const deck = parseFloat(docEl.getPropertyValue("--card-deck-w"));

    // --- Calcul basé sur la LARGEUR (existant) ---
    let c = cols;
    let widthBasedCardW = (container.clientWidth - gap * (c - 1)) / c;
    while (c > 1 && widthBasedCardW < minCard) {
      c--;
      widthBasedCardW = (container.clientWidth - gap * (c - 1)) / c;
    }

    // --- Calcul basé sur la HAUTEUR (nouveau) ---
    let heightBasedCardW = Infinity; // Pas de limite par défaut
    if (spreadId === 'spread-truth') {
      const headerH = parseFloat(docEl.getPropertyValue("--h")) || 64;
      const footerH = parseFloat(docEl.getPropertyValue("--f")) || 84;
      const railGap = parseFloat(docEl.getPropertyValue("--rail-gap")) || 160;
      const availableH = window.innerHeight - headerH - footerH - railGap;

      // La hauteur totale du rail-truth est de 1.5x la hauteur d'une carte + padding.
      // On calcule la hauteur max de la carte, puis on en déduit la largeur.
      const verticalPadding = 24; // Padding haut/bas du .chat-rail
      const maxCardH = (availableH - verticalPadding) / 1.5;
      heightBasedCardW = maxCardH / CARD_ASPECT_RATIO;
    }

    // --- Décision finale ---
    // On prend la plus petite des deux largeurs calculées.
    const finalCardW = Math.min(widthBasedCardW, heightBasedCardW, deck);

    container.style.setProperty("--cols", c);
    container.style.setProperty("--card-w", `${Math.floor(finalCardW)}px`);
  });
  ro.observe(container);
  return ro; // Retourne l'observateur pour pouvoir le déconnecter
}

/* ---------------- Component ---------------- */
// Le composant accepte maintenant `spreadId` en tant que prop
export default function ChatPage({ spreadId }) {
  const { state } = useLocation();
  const nav = useNavigate();
  const name = useMemo(() => (state?.name || "voyageur").trim(), [state?.name]);
  const niceName = useMemo(() => firstNameNice(name), [name]);
  const question = useMemo(() => (state?.question || "").trim(), [state?.question]);
  const cards = useMemo(() => state?.cards || [], [state?.cards]);

  const [pageLoaded, setPageLoaded] = useState(false);
  useEffect(() => {
    const timer = requestAnimationFrame(() => setTimeout(() => setPageLoaded(true), 80));
    return () => cancelAnimationFrame(timer);
  }, []);

  const [finalFlip, setFinalFlip] = useState([false, false, false]);
  const finalFaces = useMemo(() => cards.map((c) => c.src), [cards]);
  const finalNames = useMemo(() => cards.map((c) => c.name), [cards]);
  const [sealed, setSealed] = useState(false);

  const [chatVisible, setChatVisible] = useState(false);
  const [conv, setConv] = useState([]);
  const [youInputShown, setYouInputShown] = useState(false);
  const [youMessage, setYouMessage] = useState("");
  const [lyraTyping, setLyraTyping] = useState(false);
  const [zoomedCard, setZoomedCard] = useState(null);
  const [isSpreadModalOpen, setIsSpreadModalOpen] = useState(false);
  const [conversationState, setConversationState] = useState('introduction');
  const [isLayoutStable, setLayoutStable] = useState(false);

  const mainRef = useRef(null);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const typingRef = useRef(null);
  const footerRef = useRef(null);
  const railRef = useRef(null);
  const modalRailRef = useRef(null);

  // Rail de cartes responsive
  useEffect(() => {
    // On passe le spreadId pour que la fonction puisse appliquer la logique de hauteur si nécessaire
    const ro = fitRail(railRef.current, { spreadId });
    return () => ro?.disconnect();
  }, [spreadId]);

  // Rail de la modale responsive
  useEffect(() => {
    if (isSpreadModalOpen) {
      const ro = fitRail(modalRailRef.current, { spreadId });
      return () => ro?.disconnect();
    }
  }, [isSpreadModalOpen, spreadId]);

  // Auto-scroll logic
  useEffect(() => {
    // On cible systématiquement l'ancre, qui se trouve après le dernier message ou la bulle de frappe.
    const scrollAnchor = bodyRef.current?.querySelector('#scroll-anchor');
    if (scrollAnchor) {
      // On attend la prochaine peinture du navigateur pour s'assurer que tous les éléments
      // (y compris la bulle "typing") sont bien rendus avant de scroller.
      requestAnimationFrame(() => {
        scrollAnchor.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [conv.length, lyraTyping]);

  // On s'assure que le layout est stable avant tout premier rendu.
  // C'est la clé pour éviter le "saut" de la première bulle.
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setLayoutStable(true));
    });
  }, []);

  useEffect(() => {
    const isNewSession = state?.isNew;
    const savedConv = loadConv(spreadId);

    if (savedConv.length > 0 && !isNewSession) {
      setConv(savedConv);
      setFinalFlip([true, true, true]);
      setSealed(true);
      setChatVisible(true);
      setYouInputShown(true);
      // isLayoutStable est géré par son propre useLayoutEffect, pas besoin de le forcer ici.
      return;
    }

    setConv([]);
    saveConv([], spreadId);
    setFinalFlip([false, false, false]);
    setSealed(false);
    setChatVisible(false);
    setYouInputShown(false);
    setLyraTyping(false);

    // --- Séquence d'animation contrôlée en JS ---
    const timeouts = [];
    const cleanup = () => timeouts.forEach(clearTimeout);

    // Sélectionne le bon ordre de retournement en fonction du spreadId
    const flipOrder = spreadId === 'spread-truth' ? TRUTH_ORDER : ADVICE_ORDER;

    // 1. Délai initial avant le premier retournement
    timeouts.push(setTimeout(() => {
      // Utilise une boucle pour retourner les cartes dans l'ordre défini
      flipOrder.forEach((pos, index) => {
        timeouts.push(setTimeout(() => {
          const cardIndex = cards.findIndex(c => c.pos === pos);
          if (cardIndex !== -1) {
            setFinalFlip(flips => {
              const newFlips = [...flips];
              newFlips[cardIndex] = true;
              return newFlips;
            });
          }

          // Si c'est la dernière carte, sceller le rail et afficher le chat
          if (index === flipOrder.length - 1) {
            setSealed(true);
            timeouts.push(setTimeout(() => {
              setChatVisible(true);
            }, 500));
          }
        }, index * 500)); // Délai de 500ms entre chaque carte
      });
    }, 1000));

    return cleanup;
  }, [state?.isNew, cards, spreadId]);

  const showLyraStreamingResponse = async (payload, baseConv) => {
    setYouInputShown(false);
    setLyraTyping(true);
    const thinkingTime = baseConv.length > 0 ? getRandomThinkingTime() : getRandomInitialThinkingTime();
    await new Promise(resolve => setTimeout(resolve, thinkingTime));

    let fullText = "";
    try {
      const stream = streamLyra(payload);
      for await (const chunk of stream) {
        fullText += chunk;
      }

      if (fullText) {
        const lyraMessage = { id: Date.now(), role: "lyra", text: fullText };
        const nextConv = [...baseConv, lyraMessage];
        setLyraTyping(false);
        setConv(nextConv);
        saveConv(nextConv, spreadId);
        // Met à jour l'état de la conversation en fonction de l'étape actuelle
        if (conversationState === 'introduction') {
          setConversationState('awaiting_confirmation');
        } else if (conversationState === 'awaiting_confirmation') {
          setConversationState('interpreting_card_1');
        }
        // L'auto-scroll sera géré par un useEffect dédié.
      } else {
        setLyraTyping(false);
      }
    } catch (err) {
      console.error("Erreur de streaming:", err);
      toast("Désolé, une erreur est survenue. Veuillez réessayer.");
      setLyraTyping(false);
      setConv(baseConv);
      saveConv(baseConv, spreadId);
    } finally {
      setYouInputShown(true);
      if (lyraTyping && !fullText) {
        setLyraTyping(false);
      }
    }
  };

  useEffect(() => {
    // La conversation démarre seulement quand le layout est stable et que la conv est vide.
    if (!isLayoutStable || conv.length > 0) return;

    if (conversationState === 'introduction') {
      const cardNames = finalNames.filter(Boolean);
      const payload = { name: niceName, question, cards: cardNames, spreadId, userMessage: "", history: [] };
      showLyraStreamingResponse(payload, []);
    }
  }, [isLayoutStable, conv.length, niceName, question, finalNames, spreadId, conversationState]);

  const onYouSubmit = (e) => {
    if (e) e.preventDefault();
    const msg = youMessage.trim();
    if (!msg) return;

    recordUserMsg(msg.length);
    setYouMessage("");

    const userBubble = { id: Date.now(), role: "user", text: msg };
    const currentConv = [...conv, userBubble];
    setConv(currentConv);
    saveConv(currentConv, spreadId);

    // Note: l'appel à .focus() a été supprimé car il entrait en conflit
    // avec le défilement automatique vers la nouvelle bulle de chat.

    const history = conv.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const payload = { name: niceName, question, cards: finalNames.filter(Boolean), spreadId, userMessage: msg, history, conversationState };
    showLyraStreamingResponse(payload, currentConv);
  };

  // --- Helpers de rendu pour le rail de cartes ---
  const renderCard = (card, i, { isModal = false } = {}) => {
    if (!card) return null;
    const isFlipped = isModal || finalFlip[i];
    return (
      <div key={`final-${i}-${isModal ? 'modal' : 'main'}`} className="final-card-outer" data-pos={card.pos}>
        <div
          className={`final-card-flip${isFlipped ? " is-flipped" : ""}`}
          onClick={() => !isModal && isFlipped && setZoomedCard(i)}
          onKeyDown={(e) => !isModal && isFlipped && (e.key === "Enter" || e.key === " ") && setZoomedCard(i)}
          role="button"
          tabIndex={!isModal && isFlipped ? 0 : -1}
          aria-label={`Agrandir la carte : ${finalNames[i] || `Carte ${i + 1}`}`}
          style={{ cursor: !isModal && isFlipped ? "pointer" : "default" }}
        >
          <div className="final-face final-back" />
          <div className="final-face final-front">
            {finalFaces[i] ? (
              <img src={finalFaces[i]} alt={finalNames[i] || `Carte ${i + 1}`} />
            ) : (
              <div className="final-front-placeholder">Carte {i + 1}</div>
            )}
          </div>
        </div>
        <div className="final-caption" style={isModal ? { opacity: 1, transform: "none" } : {}}>
          {isFlipped ? finalNames[i] || `Carte ${i + 1}` : ""}
        </div>
      </div>
    );
  };

  const renderRailContent = ({ isModal = false } = {}) => {
    // Pour "spread-truth", on trie les cartes pour garantir un ordre A, B, C dans le DOM.
    // Cela permet au CSS de cibler de manière fiable la carte du milieu (B) avec `:nth-child(2)`.
    const cardsToRender = spreadId === 'spread-truth'
      ? [...cards].sort((a, b) => (a.pos || '').localeCompare(b.pos || ''))
      : cards;

    return cardsToRender.map((card) => {
      // On doit retrouver l'index original de la carte pour accéder aux données
      // qui conservent l'ordre initial (finalFlip, finalNames, etc.).
      const originalIndex = cards.findIndex(c => c.src === card.src && c.pos === card.pos);
      return renderCard(card, originalIndex, { isModal });
    });
  };

  return (
    <div className={`page-chat ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}>
      <header className="chat-header glass">
        <div className="p5-fixed-title" role="button" tabIndex="0">
          {question}
        </div>
        <div className="header-icon-container show">
          <button
            className="header-icon-btn"
            onClick={() => setIsSpreadModalOpen(true)}
            aria-label="Afficher le tirage de cartes"
            title="Afficher le tirage"
          >
            <span className="ms-icon material-symbols-outlined">playing_cards</span>
          </button>
        </div>
      </header>
      <main className="chat-main" ref={mainRef}>
        <section id="chat-body" className="chat-body" ref={bodyRef} aria-live="polite">
          {/* Le rail et les bulles sont maintenant dans le même conteneur scrollable */}
          <div className="chat-rail" id="chat-rail">
            <div ref={railRef} className={`final-rail appear-slow${sealed ? " sealed" : ""} ${spreadId === 'spread-truth' ? 'rail-truth' : 'rail-advice'}`}>
              {renderRailContent()}
            </div>
          </div>

          {chatVisible && (
            <div className="messages">
              {conv.map((m) =>
                m.role === "lyra" ? (
                  <div key={m.id} className="bubble lyra lyra-fadein">
                    <div className="who">LYRA</div>
                    <div className="msg">
                      {m.text.split("\n").map((line, i) => (
                        <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="bubble you you-fadein">
                    <div className="who">VOUS</div>
                    <div className="msg">
                      {m.text.split("\n").map((line, i) => (
                        <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>
                      ))}
                    </div>
                  </div>
                )
              )}
              {/* Le slot permanent pour la bulle "typing" */}
              <div id="bottom-slot">
                {lyraTyping ? (
                  <div
                    ref={typingRef}
                    className="bubble lyra typing"
                    aria-live="polite"
                    aria-label="Lyra est en train d’écrire"
                  >
                    <div className="dots" role="status" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                ) : (
                  <div className="bubble empty" />
                )}
              </div>
              {/* L'ancre pour le défilement est placée à la fin des messages */}
              <div id="scroll-anchor" />
            </div>
          )}
        </section>
      </main>
      <footer ref={footerRef} className={`chat-footer glass ${chatVisible ? " show" : ""}`}>
        <div className="you-block">
          <form onSubmit={onYouSubmit} className="you-form">
            <input
              ref={inputRef}
              className="you-input"
              placeholder={!youInputShown ? "Lyra est en train d'écrire..." : "Message à Lyra"}
              value={youMessage}
              onChange={(e) => setYouMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onYouSubmit();
                }
              }}
              disabled={!youInputShown}
            />
            <button type="submit" className="send-btn" aria-label="Envoyer" title="Envoyer" disabled={!youInputShown}>
              <span className="material-symbols-outlined" style={{ color: youMessage ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }}>
                arrow_forward
              </span>
            </button>
          </form>
        </div>
      </footer>

      {/* Modals are moved here, outside of the main layout flow, which is cleaner. */}
      {zoomedCard !== null && (
        <Modal onClose={() => setZoomedCard(null)}>
          <div className="zoomed-card-container">
            <img
              src={finalFaces[zoomedCard]}
              alt={finalNames[zoomedCard] || `Carte ${zoomedCard + 1}`}
              className="zoomed-card-img"
            />
          </div>
        </Modal>
      )}
      {isSpreadModalOpen && (
        <Modal onClose={() => setIsSpreadModalOpen(false)}>
          <div className="spread-modal-container">
            {/* Le rail dans la modale réutilise la même logique de rendu pour garantir la cohérence */}
            <div ref={modalRailRef} className={`final-rail sealed ${spreadId === 'spread-truth' ? 'rail-truth' : 'rail-advice'}`}>
              {renderRailContent({ isModal: true })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
