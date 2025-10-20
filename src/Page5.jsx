// src/Page5.jsx — version finale sans DebugBar ni CTA secondaires
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Modal from "./components/Modal";
import "./components/Modal.css";
import "./Page5.css";
import background from "./assets/background.webp";
import { toast } from "./utils/net";
import "./toast.css";
import "./chat-ux.css";

import { streamLyra } from "./utils/streamLyra"; // Import de la fonction de streaming

/* ---------------- Persistance conversation ---------------- */
const STORAGE_KEY = "lyra:conv";
function loadConv() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveConv(conv) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conv));
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

function splitIntoBubbles(text, max = 3) {
  if (!text) return [""];
  const parts = String(text).split(/\r?\n\s*\r?\n+/);
  if (parts.length <= max) return parts;
  const head = parts.slice(0, max - 1);
  const tail = parts.slice(max - 1).join("\n\n");
  return [...head, tail];
}

function getRandomInitialThinkingTime() {
  return Math.floor(Math.random() * 1001) + 1000; // 1–2 sec
}

function getRandomThinkingTime() {
  return Math.floor(Math.random() * 1501) + 1500; // 1.5–3 sec
}

/* ---------------- Component ---------------- */
export default function Page5() {
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
  const [zoomedCard, setZoomedCard] = useState(null); // null ou index de la carte
  const [isSpreadVisible, setIsSpreadVisible] = useState(true);
  const [isSpreadModalOpen, setIsSpreadModalOpen] = useState(false);

  const endRef = useRef(null);
  const finalRailRef = useRef(null);
  const spreadRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSpreadVisible(entry.isIntersecting);
      },
      { threshold: 0.1 } // Se déclenche si 10% de l'élément est visible
    );

    const currentRef = spreadRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const handleTitleClick = () => {
    if (finalRailRef.current) {
      finalRailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToEnd = () => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  };

  /* ---------------- Animation des cartes ---------------- */
  useEffect(() => {
    const isNewSession = state?.isNew;
    const savedConv = loadConv();

    if (savedConv.length > 0 && !isNewSession) {
      setConv(savedConv);
      setFinalFlip([true, true, true]);
      setSealed(true);
      setChatVisible(true);
      setYouInputShown(true);
      return;
    }

    setConv([]);
    saveConv([]);
    setFinalFlip([false, false, false]);
    setSealed(false);
    setChatVisible(false);
    setYouInputShown(false);
    setLyraTyping(false);

    const t1 = setTimeout(() => setFinalFlip([true, false, false]), DUR.finalPauseBefore);
    const t2 = setTimeout(() => setFinalFlip([true, true, false]), DUR.finalPauseBefore + DUR.finalGap);
    const t3 = setTimeout(() => setFinalFlip([true, true, true]), DUR.finalPauseBefore + DUR.finalGap * 2);
    const t4 = setTimeout(() => setSealed(true), DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 120);
    const tChat = setTimeout(
      () => setChatVisible(true),
      DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 1000
    );

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tChat);
    };
  }, [DUR, state?.isNew]);

  /* ---------------- Logique de conversation ---------------- */
  const showLyraStreamingResponse = async (payload, baseConv) => {
    setYouInputShown(false);
    setLyraTyping(true);
    const thinkingTime = baseConv.length > 0 ? getRandomThinkingTime() : getRandomInitialThinkingTime();
    await new Promise(resolve => setTimeout(resolve, thinkingTime));

    let lyraMessage = null;
    let nextConv = [...baseConv];
    let textBuffer = "";
    let renderInterval = null;

    const stream = streamLyra(payload);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    reader.read().then(function processText({ done, value }) {
      if (done) {
        clearInterval(renderInterval);
        if (lyraMessage) {
          lyraMessage.text += textBuffer; // Vider le reste du buffer
          setConv([...nextConv]);
          saveConv(nextConv);
        }
        setYouInputShown(true);
        if (lyraTyping && !lyraMessage) setLyraTyping(false);
        return;
      }

      textBuffer += decoder.decode(value, { stream: true });

      if (!lyraMessage) {
        setLyraTyping(false);
        lyraMessage = { id: Date.now(), role: "lyra", text: "" };
        nextConv = [...baseConv, lyraMessage];
        setConv(nextConv);

        renderInterval = setInterval(() => {
          if (textBuffer.length > 0) {
            const charCount = Math.min(textBuffer.length, Math.floor(Math.random() * 3) + 2); // 2-4 chars
            const toRender = textBuffer.substring(0, charCount);
            textBuffer = textBuffer.substring(charCount);
            lyraMessage.text += toRender;
            setConv([...nextConv]);
            requestAnimationFrame(scrollToEnd);
          }
        }, 60); // Toutes les 60ms
      }

      reader.read().then(processText).catch(err => {
        console.error("Erreur de lecture du stream:", err);
        toast("Désolé, une erreur de lecture est survenue.");
        clearInterval(renderInterval);
        setLyraTyping(false);
        setConv(baseConv);
        saveConv(baseConv);
        setYouInputShown(true);
      });
    }).catch(err => {
      console.error("Erreur de streaming:", err);
      toast("Désolé, une erreur est survenue. Veuillez réessayer.");
      setLyraTyping(false);
      setConv(baseConv);
      saveConv(baseConv);
      setYouInputShown(true);
    });
  };

  /* ---------------- Première réponse IA ---------------- */
  useEffect(() => {
    if (!chatVisible || conv.length > 0) return;

    const fetchInitialLyraResponse = () => {
      const cardNames = finalNames.filter(Boolean);
      const payload = { name: niceName, question, cards: cardNames, userMessage: "", history: [] };
      showLyraStreamingResponse(payload, []);
    };

    fetchInitialLyraResponse();
  }, [chatVisible, conv.length, niceName, question, finalNames]);

  useEffect(() => {
    if (chatVisible) requestAnimationFrame(scrollToEnd);
  }, [chatVisible]);

  useEffect(() => {
    requestAnimationFrame(scrollToEnd);
  }, [conv.length, lyraTyping, youInputShown]);

  /* ---------------- Envoi message utilisateur ---------------- */
  const onYouSubmit = (e) => {
    if (e) e.preventDefault();
    const msg = youMessage.trim();
    if (!msg) return;

    recordUserMsg(msg.length);
    setYouMessage("");

    const userBubble = { id: Date.now(), role: "user", text: msg };
    const currentConv = [...conv, userBubble];
    setConv(currentConv);
    saveConv(currentConv);
    requestAnimationFrame(scrollToEnd);

    const history = conv.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const payload = { name: niceName, question, cards: finalNames.filter(Boolean), userMessage: msg, history };
    showLyraStreamingResponse(payload, currentConv);
  };

  /* ---------------- Render ---------------- */
  return (
    <div
      className={`page5-root ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}
      style={{ backgroundImage: `url(${background})` }}
    >
      <header className="page5-header">
        <div
          className="p5-fixed-title"
          onClick={handleTitleClick}
          role="button"
          tabIndex="0"
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTitleClick()}
          style={{ cursor: "pointer" }}
        >
          {question}
        </div>
        <div className={`header-icon-container ${!isSpreadVisible ? "show" : ""}`}>
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

      <main className="page5-main-scroll">
        <div className="final-stack">
          <section className="final-hero" ref={spreadRef}>
            <div className={`final-rail appear-slow${sealed ? " sealed" : ""}`} ref={finalRailRef}>
              {[0, 1, 2].map((i) => (
                <div key={`final-${i}`} className="final-card-outer">
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
                <div className="final-rail sealed">
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

          <section
            className={`chat-wrap${chatVisible ? " show" : ""}`}
            aria-live="polite"
          >
            {conv.map((m) =>
              m.role === "lyra" ? (
                <React.Fragment key={m.id}>
                  {splitIntoBubbles(m.text, 3).map((seg, idx) => (
                    <div key={`${m.id}-${idx}`} className={`bubble lyra${idx > 0 ? " stacked" : ""} lyra-fadein`}>
                      <div className="who">LYRA</div>
                      <div className="msg">
                        {seg.split("\n").map((line, i) => (
                          <p key={i} style={{ margin: "6px 0" }}>
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ) : (
                <div key={m.id} className="bubble you you-fadein">
                  <div className="who">VOUS</div>
                  <div className="msg">
                    {m.text.split("\n").map((line, i) => (
                      <p key={i} style={{ margin: "6px 0" }}>
                        {line || "\u00A0"}
                      </p>
                    ))}
                  </div>
                </div>
              )
            )}

            {lyraTyping && (
              <div className="bubble lyra typing" aria-live="polite" aria-label="Lyra est en train d’écrire">
                <div className="dots" role="status" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </section>
        </div>
      </main>

      <footer className={`page5-footer ${chatVisible ? " show" : ""}`}>
        <div className="you-block">
          <form onSubmit={onYouSubmit} className="you-form">
            <input
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
            <button
              type="submit"
              className="send-btn"
              aria-label="Envoyer"
              title="Envoyer"
              disabled={!youInputShown}
            >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: youMessage ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }}
                  >
                    arrow_forward
                  </span>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}