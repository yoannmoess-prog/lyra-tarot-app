// src/Page5.jsx — final 3 cartes → chat
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page5.css";
import background from "./assets/background.jpg";
import { postJson, toast } from "./utils/net";
import "./toast.css";
import DebugBar from "./components/DebugBar";
import "./debugbar.css";
import "./chat-ux.css";

/* ---------------- Backend helpers ---------------- */
async function fetchLyra({ name, question, cards, userMessage, history }) {
  try {
    const data = await postJson("/api/lyra",
      { name, question, cards, userMessage, history },
      { tries: 3, base: 300, timeout: 15000 }
    );
    if (!data?.ok) throw new Error("lyra_error");
    return data.text || "";
  } catch (err) {
    toast("Lyra a du mal à répondre (réessais épuisés).");
    throw err;
  }
}

async function* fetchLyraStream({ name, question, cards, userMessage, history, signal }) {
  const r = await fetch("/api/lyra/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
    body: JSON.stringify({ name, question, cards, userMessage, history }),
    signal,
  });
  if (!r.ok || !r.body) throw new Error("no_stream");

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl); // ne pas .trim()
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;

      const data = line.slice(6);     // enlève "data: "
      if (data === "[DONE]") return;
      if (data === "[OPEN]") continue; // <<— nouveau : on ignore le ping lisible

      // event vide = vraie nouvelle ligne (sert à déclencher la séparation live)
      if (data === "") { yield "\n"; continue; }

      yield data;
    }
  }
}

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
    const next = { count: (s.count||0)+1, sum: (s.sum||0)+len };
    localStorage.setItem(UX_STATS_KEY, JSON.stringify(next));
  } catch {}
}

/* ---------------- Helpers UI ---------------- */
function firstNameNice(s) {
  const first = String(s || "voyageur").trim().split(/\s+/)[0];
  if (!first) return "Voyageur";
  return first[0].toLocaleUpperCase("fr-FR") + first.slice(1);
}
function typewrite(text, setText, onTick, onDone, speed = 22) {
  setText("");
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    setText(text.slice(0, i));
    onTick?.();
    if (i >= text.length) {
      clearInterval(id);
      onDone?.();
    }
  }, speed);
  return () => clearInterval(id);
}

function splitIntoBubbles(text, max = 3) {
  if (!text) return [""];
  const parts = String(text).split(/\r?\n\s*\r?\n+/);
  if (parts.length <= max) return parts;
  const head = parts.slice(0, max - 1);
  const tail = parts.slice(max - 1).join("\n\n");
  return [...head, tail];
}

/* ---------------- Component ---------------- */
export default function Page5() {
  const { state } = useLocation();
  const nav = useNavigate();
  // On mémoïze les props qui viennent du state de la navigation pour éviter des re-render inutiles
  const name = useMemo(() => (state?.name || "voyageur").trim(), [state?.name]);
  const niceName = useMemo(() => firstNameNice(name), [name]);
  const question = useMemo(() => (state?.question || "").trim(), [state?.question]);
  const cards = useMemo(() => state?.cards || [], [state?.cards]);

  const [pageLoaded, setPageLoaded] = useState(false);
  useEffect(() => {
    const timer = requestAnimationFrame(() => setTimeout(() => setPageLoaded(true), 80));
    return () => cancelAnimationFrame(timer);
  }, []);

  const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const DUR = useMemo(() => ({
    finalPauseBefore: prefersReduced ? 200 : 1000,
    finalGap: prefersReduced ? 300 : 1500,
    flipAnim: prefersReduced ? 200 : 620,
  }), [prefersReduced]);

  const [finalFlip, setFinalFlip] = useState([false, false, false]);
  const finalFaces = useMemo(() => cards.map(c => c.src), [cards]);
  const finalNames = useMemo(() => cards.map(c => c.name), [cards]);
  const [sealed, setSealed] = useState(false);

  const [chatVisible, setChatVisible] = useState(false);
  const [conv, setConv] = useState([]);
  const [youInputShown, setYouInputShown] = useState(false);
  const [youMessage, setYouMessage] = useState("");
  const [lyraTyping, setLyraTyping] = useState(false);
  const [replyTyping, setReplyTyping] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);

  const endRef = useRef(null);
  const streamAbortRef = useRef(null);

  const scrollToEnd = () => {
    endRef.current
      ? endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
      : window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

  // Effet #1: Gère la reprise de session ou le lancement de l'animation pour une nouvelle session.
  useEffect(() => {
    const isNewSession = state?.isNew;
    const savedConv = loadConv();

    // Si une conversation est sauvegardée et que ce n'est pas une nouvelle session, on la charge.
    if (savedConv.length > 0 && !isNewSession) {
      setConv(savedConv);
      setFinalFlip([true, true, true]);
      setSealed(true);
      setChatVisible(true);
      setYouInputShown(true);
      return; // On ne fait rien d'autre.
    }

    // Logique pour une NOUVELLE session : on réinitialise tout et on lance les animations.
    setConv([]);
    saveConv([]);
    setFinalFlip([false, false, false]); // Important de réinitialiser l'état des cartes
    setSealed(false);
    setChatVisible(false);
    setYouInputShown(false);
    setLyraTyping(false);
    setReplyTyping("");

    // Animation des cartes, qui ne sera plus jamais ré-exécutée.
    const t1 = setTimeout(() => setFinalFlip([true, false, false]), DUR.finalPauseBefore);
    const t2 = setTimeout(() => setFinalFlip([true, true, false]), DUR.finalPauseBefore + DUR.finalGap);
    const t3 = setTimeout(() => setFinalFlip([true, true, true]), DUR.finalPauseBefore + DUR.finalGap * 2);
    const t4 = setTimeout(() => setSealed(true), DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 120);
    const tChat = setTimeout(() => setChatVisible(true), DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 1000);

    return () => {
      // Nettoyage des timers si le composant est démonté pendant l'animation.
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(tChat);
    };
  }, [DUR, state?.isNew]); // Dépendances minimales pour ne s'exécuter qu'une fois par session.


  // Effet #2: Gère la récupération de la réponse initiale de Lyra quand le chat devient visible.
  useEffect(() => {
    // Ne s'active que si le chat est visible ET qu'il n'y a pas encore de messages (cas d'une nouvelle session).
    if (!chatVisible || conv.length > 0) {
      return;
    }

    const fetchInitialLyraResponse = async () => {
      setLyraTyping(true);
      await new Promise(resolve => setTimeout(resolve, 3500)); // Simule la réflexion

      const cardNames = finalNames.filter(Boolean);
      const history = []; // L'historique est vide pour la première requête

      let streamed = false, streamedText = "";
      try {
        streamAbortRef.current?.abort();
        streamAbortRef.current = new AbortController();

        for await (const chunk of fetchLyraStream({
          name: niceName, question, cards: cardNames, userMessage: "", history,
          signal: streamAbortRef.current.signal
        })) {
          if (!streamed) {
            streamed = true;
            setLyraTyping(false);
          }
          streamedText += chunk;
          setReplyTyping(current => current + chunk);
          requestAnimationFrame(scrollToEnd);
        }
      } catch {
        // Fallback en cas d'échec du stream
      } finally {
        streamAbortRef.current = null;
      }

      if (streamed) {
        const text = streamedText.trim();
        setReplyTyping("");
        setConv(prev => {
          const next = [...prev, { id: Date.now(), role: "lyra", text }];
          saveConv(next);
          return next;
        });
        setSuggestedQuestions(["Peux-tu approfondir ce point ?", "Quel est le conseil principal ?"]);
        setYouInputShown(true);
        requestAnimationFrame(scrollToEnd);
        return;
      }

      // Fallback au fetch non-streamé
      let text = "";
      try {
        text = await fetchLyra({ name: niceName, question, cards: cardNames, userMessage: "", history });
      } catch {
        text = "Je réfléchis… (réponse momentanément indisponible).";
      }

      setLyraTyping(false);
      typewrite(text, setReplyTyping, () => requestAnimationFrame(scrollToEnd), () => {
        setReplyTyping("");
        setConv(prev => {
          const next = [...prev, { id: Date.now(), role: "lyra", text }];
          saveConv(next);
          return next;
        });
        setSuggestedQuestions(["Peux-tu approfondir ce point ?", "Quel est le conseil principal ?"]);
        setYouInputShown(true);
        requestAnimationFrame(scrollToEnd);
      }, 22);
    };

    fetchInitialLyraResponse();

    return () => {
      streamAbortRef.current?.abort();
    };
  }, [chatVisible, conv.length, niceName, question, finalNames]); // Dépendances pour la requête.

  // Effets pour le défilement automatique
  useEffect(() => {
    if (chatVisible) requestAnimationFrame(scrollToEnd);
  }, [chatVisible]);

  useEffect(() => {
    requestAnimationFrame(scrollToEnd);
  }, [conv.length, lyraTyping, replyTyping, youInputShown]);

  const onYouSubmit = (e) => {
    if (e) e.preventDefault();
    const msg = youMessage.trim();
    if (!msg) return;

    recordUserMsg(msg.length);
    setYouMessage(""); // Clear input field immediately

    const userBubble = { id: Date.now(), role: "user", text: msg };

    setConv(currentConv => {
      const nextConv = [...currentConv, userBubble];
      saveConv(nextConv);

      // --- Start of async logic, now guaranteed to have the correct state ---
      const handleResponse = async () => {
        setYouInputShown(false);
        setLyraTyping(true);
        requestAnimationFrame(scrollToEnd);

        const cardNames = finalNames.filter(Boolean);
        const history = nextConv.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

        let streamed = false, streamedText = "";
        try {
          streamAbortRef.current?.abort?.();
          streamAbortRef.current = new AbortController();

          for await (const chunk of fetchLyraStream({
            name: niceName, question, cards: cardNames, userMessage: msg, history,
            signal: streamAbortRef.current.signal
          })) {
            if (!streamed) {
              streamed = true;
              setLyraTyping(false);
            }
            streamedText += chunk;
            setReplyTyping((current) => current + chunk);
            requestAnimationFrame(scrollToEnd);
          }
        } catch {
          toast("Connexion instable — passage au mode non-stream.");
        } finally {
          streamAbortRef.current = null;
        }

        if (streamed) {
          const text = streamedText;
          setReplyTyping("");
          setConv((prev) => {
            const next = [...prev, { id: Date.now() + 1, role: "lyra", text }];
            saveConv(next);
            return next;
          });
          setSuggestedQuestions(["Peux-tu développer ce dernier point ?", "Comment puis-je appliquer ce conseil ?"]);
          setYouInputShown(true);
          requestAnimationFrame(scrollToEnd);
          return;
        }

        const MIN_DOTS = 2000;
        const t0 = Date.now();
        let text = "";
        try {
          text = await fetchLyra({ name: niceName, question, cards: cardNames, userMessage: msg, history });
        } catch {
          text = "Je réfléchis… (réponse momentanément indisponible).";
        }
        const wait = Math.max(0, MIN_DOTS - (Date.now() - t0));

        setTimeout(() => {
          setLyraTyping(false);
          typewrite(text, setReplyTyping, () => requestAnimationFrame(scrollToEnd), () => {
            setReplyTyping("");
            setConv((prev) => {
              const next = [...prev, { id: Date.now() + 1, role: "lyra", text }];
              saveConv(next);
              return next;
            });
            setSuggestedQuestions(["Peux-tu développer ce dernier point ?", "Comment puis-je appliquer ce conseil ?"]);
            setYouInputShown(true);
            requestAnimationFrame(scrollToEnd);
          }, 22);
        }, wait);
      };

      handleResponse();
      // --- End of async logic ---

      return nextConv;
    });

    requestAnimationFrame(scrollToEnd);
  };

  return (
    <div
      className={`page5-root ${pageLoaded ? "fade-in-soft" : "pre-fade"}`}
      style={{ backgroundImage: `url(${background})` }}
    >
      <main className="final-stack">
        <div className="title-block">
          <div className="p4-fixed-title">{question}</div>
        </div>
        <section className="final-hero">
          <div className={`final-rail appear-slow${sealed ? " sealed" : ""}`}>
            {[0, 1, 2].map((i) => (
              <div key={`final-${i}`} className="final-card-outer">
                <div className={`final-card-flip${finalFlip[i] ? " is-flipped" : ""}`}>
                  <div className="final-face final-back" />
                  <div className="final-face final-front">
                    {finalFaces[i] ? (
                      <img src={finalFaces[i]} alt={finalNames[i] || `Carte ${i + 1}`} />
                    ) : (
                      <div className="final-front-placeholder">Carte {i + 1}</div>
                    )}
                  </div>
                </div>
                <div className="final-caption">{finalFlip[i] ? (finalNames[i] || `Carte ${i + 1}`) : ""}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          className={`chat-wrap${chatVisible ? " show" : ""}`}
          aria-live="polite"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {conv.map((m) => {
            if (m.role === "lyra") {
              const segments = splitIntoBubbles(m.text, 3);
              return (
                <React.Fragment key={m.id}>
                  {segments.map((seg, idx) => (
                    <div key={`${m.id}-${idx}`} className={`bubble lyra${idx > 0 ? " stacked" : ""} lyra-fadein`}>
                      <div className="who">LYRA</div>
                      <div className="msg">
                        {seg.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>)}
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              );
            }
            return (
              <div key={m.id} className="bubble you">
                <div className="who">VOUS</div>
                <div className="msg">
                  {m.text.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>)}
                </div>
              </div>
            );
          })}

          {lyraTyping && (
            <div className="bubble lyra typing" aria-live="polite" aria-label="Lyra est en train d’écrire">
              <div className="who">LYRA</div>
              <div className="dots" role="status" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}

          {replyTyping && !lyraTyping && (
            <>
              {splitIntoBubbles(replyTyping, 3).map((seg, idx) => (
                <div
                  key={`stream-${idx}`}
                  className={`bubble lyra${idx > 0 ? " stacked" : ""} lyra-fadein`}
                  style={{ animation: "fadeInSoft 800ms" }}
                >
                  <div className="who">LYRA</div>
                  <div className="msg">
                    {seg.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>)}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      </main>

      <div className={`you-block${youInputShown ? " show" : ""}`}>
        <div className="bubble you input">
          <div className="who">VOUS</div>
          <div className="msg">
            <form onSubmit={onYouSubmit} className="you-form">
              <input
                className="you-input"
                placeholder="Message à Lyra"
                value={youMessage}
                onChange={(e) => setYouMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onYouSubmit(); } }}
              />
              <button type="submit" className="send-btn" aria-label="Envoyer" title="Envoyer">
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
          </div>
        </div>
        <div className="cta-block">
          {suggestedQuestions.map((q, i) => (
            <button key={i} type="button" className="cta-btn" onClick={() => setYouMessage(q)}>
              {q}
            </button>
          ))}
          <button
            type="button"
            className="newdraw-btn"
            onClick={() => {
              localStorage.removeItem("lyra:conv");
              nav("/question", { state: { name } });
            }}
          >
            Je souhaite réaliser un nouveau tirage
          </button>
        </div>
      </div>

      <div ref={endRef} aria-hidden="true" />
      <DebugBar />
    </div>
  );
}