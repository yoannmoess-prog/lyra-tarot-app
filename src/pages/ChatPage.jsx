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
  return Math.floor(Math.random() * 1001) + 1000; // 1–2 sec
}

function getRandomThinkingTime() {
  return Math.floor(Math.random() * 1501) + 1500; // 1.5–3 sec
}

export function fitRail(container, { cols = 3, minCard = 120 } = {}) {
  if (!container) return;
  const ro = new ResizeObserver(() => {
    const cs = getComputedStyle(container);
    const gap = parseFloat(cs.getPropertyValue("--gap")) || 16;
    const deck = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-deck-w"));
    let c = cols;
    let perCol = (container.clientWidth - gap * (c - 1)) / c;
    while (c > 1 && perCol < minCard) { c--; perCol = (container.clientWidth - gap * (c - 1)) / c; }
    const cardW = Math.min(perCol, deck);
    container.style.setProperty("--cols", c);
    container.style.setProperty("--card-w", `${Math.floor(cardW)}px`);
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

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const DUR = useMemo(
    () => ({
      finalPauseBefore: prefersReduced ? 200 : 1000,
      finalGap: prefersReduced ? 300 : 1500,
      flipAnim: prefersReduced ? 200 : 620,
    }),
    [prefersReduced]
  );

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

  const mainRef = useRef(null);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const typingRef = useRef(null);
  const footerRef = useRef(null);
  const railRef = useRef(null);

  // Rail de cartes responsive
  useEffect(() => {
    const ro = fitRail(railRef.current);
    return () => ro?.disconnect();
  }, []);

  // Mesure dynamique du footer
  useLayoutEffect(() => {
    const apply = () => {
      const h = footerRef.current?.offsetHeight || 84;
      document.documentElement.style.setProperty("--f", `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    if (footerRef.current) ro.observe(footerRef.current);
    window.addEventListener("resize", apply);
    return () => { ro.disconnect(); window.removeEventListener("resize", apply); };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    const target = typingRef.current || bodyRef.current?.lastElementChild || bodyRef.current;
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [conv.length, lyraTyping]);

  useEffect(() => {
    const isNewSession = state?.isNew;
    const savedConv = loadConv(spreadId);

    if (savedConv.length > 0 && !isNewSession) {
      setConv(savedConv);
      setFinalFlip([true, true, true]);
      setSealed(true);
      setChatVisible(true);
      setYouInputShown(true);
      return;
    }

    setConv([]);
    saveConv([], spreadId);
    setFinalFlip([false, false, false]);
    setSealed(false);
    setChatVisible(false);
    setYouInputShown(false);
    setLyraTyping(false);

    // Déterminer l'ordre de retournement
    const flipOrder = spreadId === 'spread-truth'
      ? ['A', 'C', 'B']
      : ['A', 'B', 'C'];

    const cardPositions = cards.map(c => c.pos);
    const timeouts = [];

    flipOrder.forEach((pos, index) => {
      const cardIndex = cardPositions.indexOf(pos);
      if (cardIndex !== -1) {
        const timeout = setTimeout(() => {
          setFinalFlip(prev => {
            const newState = [...prev];
            newState[cardIndex] = true;
            return newState;
          });
        }, DUR.finalPauseBefore + DUR.finalGap * index);
        timeouts.push(timeout);
      }
    });

    const t4 = setTimeout(() => setSealed(true), DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 120);
    const tChat = setTimeout(
      () => setChatVisible(true),
      DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 1000
    );

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(t4);
      clearTimeout(tChat);
    };
  }, [DUR, state?.isNew, cards, spreadId]);

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
    if (!chatVisible || conv.length > 0) return;

    if (conversationState === 'introduction') {
      const cardNames = finalNames.filter(Boolean);
      const payload = { name: niceName, question, cards: cardNames, spreadId, userMessage: "", history: [] };
      showLyraStreamingResponse(payload, []);
    }
  }, [chatVisible, conv.length, niceName, question, finalNames, spreadId, conversationState]);

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

    setTimeout(() => {
      // L'auto-scroll est géré par ailleurs
      inputRef.current?.focus();
    }, 100);

    const history = conv.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const payload = { name: niceName, question, cards: finalNames.filter(Boolean), spreadId, userMessage: msg, history, conversationState };
    showLyraStreamingResponse(payload, currentConv);
  };

  return (
    <div className={`page-chat ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}>
      <header className="chat-header">
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
        <section className="chat-rail" id="chat-rail">
          <div ref={railRef} className={`final-rail appear-slow${sealed ? " sealed" : ""} ${spreadId === 'spread-truth' ? 'rail-truth' : 'rail-advice'}`}>
            {cards.map((card, i) => (
              <div key={`final-${i}`} className="final-card-outer" data-pos={card.pos}>
                <div
                  className={`final-card-flip${finalFlip[i] ? " is-flipped" : ""}`}
                  onClick={() => finalFlip[i] && setZoomedCard(i)}
                  onKeyDown={(e) => finalFlip[i] && (e.key === "Enter" || e.key === " ") && setZoomedCard(i)}
                  role="button"
                  tabIndex={finalFlip[i] ? 0 : -1}
                  aria-label={`Agrandir la carte : ${finalNames[i] || `Carte ${i + 1}`}`}
                  style={{ cursor: finalFlip[i] ? "pointer" : "default" }}
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
                <div className="final-caption">{finalFlip[i] ? finalNames[i] || `Carte ${i + 1}` : ""}</div>
              </div>
            ))}
          </div>
        </section>

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
              <div className={`final-rail sealed ${spreadId === 'spread-truth' ? 'rail-truth' : 'rail-advice'}`}>
                {[0, 1, 2].map((i) => (
                  <div key={`modal-final-${i}`} className="final-card-outer">
                    <div className="final-card-flip is-flipped">
                      <div className="final-face final-back" />
                      <div className="final-face final-front">
                        {finalFaces[i] ? (
                          <img src={finalFaces[i]} alt={finalNames[i] || `Carte ${i + 1}`} />
                        ) : (
                          <div className="final-front-placeholder">Carte {i + 1}</div>
                        )}
                      </div>
                    </div>
                    <div className="final-caption" style={{ opacity: 1, transform: "none" }}>
                      {finalNames[i] || `Carte ${i + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}

        {chatVisible && (
          <section className="chat-body" id="chat-body" ref={bodyRef} aria-live="polite">
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
            {lyraTyping && (
              <div ref={typingRef} className="bubble lyra typing" aria-live="polite" aria-label="Lyra est en train d’écrire">
                <div className="dots" role="status" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      <footer ref={footerRef} className={`chat-footer ${chatVisible ? " show" : ""}`}>
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
    </div>
  );
}
