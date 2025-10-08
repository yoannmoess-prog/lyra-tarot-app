// src/Page5.jsx — version finale sans DebugBar ni CTA secondaires
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page5.css";
import background from "./assets/background.jpg";
import { postJson, toast } from "./utils/net";
import "./toast.css";
import "./chat-ux.css";

/* ---------------- Backend helpers ---------------- */
async function fetchLyra({ name, question, cards, userMessage, history }) {
  try {
    const data = await postJson(
      "/api/lyra",
      { name, question, cards, userMessage, history },
      { tries: 3, base: 300, timeout: 25000 }
    );
    if (!data?.ok) throw new Error("lyra_error");
    return data;
  } catch (err) {
    toast("Lyra a du mal à répondre (réessais épuisés).");
    throw err;
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

function getRandomThinkingTime() {
  return Math.floor(Math.random() * 4001) + 4000; // 4–8 sec
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

  const endRef = useRef(null);
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

  // Helper pour afficher la réponse de Lyra séquentiellement, bulle par bulle
  const showLyraResponseSequentially = async (responseText, baseConv) => {
    const bubbles = splitIntoBubbles(responseText, 3);
    if (bubbles.length === 0) {
      setYouInputShown(true);
      return;
    }

    const lyraMessageId = Date.now();
    let accumulatedText = "";
    let tempConv = [...baseConv];

    for (let i = 0; i < bubbles.length; i++) {
      accumulatedText += (i > 0 ? "\n\n" : "") + bubbles[i];
      const lyraMessage = { id: lyraMessageId, role: "lyra", text: accumulatedText };

      // Remplacer le message précédent de Lyra ou l'ajouter pour la première fois
      const existingIndex = tempConv.findIndex((m) => m.id === lyraMessageId);
      if (existingIndex > -1) {
        tempConv[existingIndex] = lyraMessage;
      } else {
        tempConv.push(lyraMessage);
      }

      setConv([...tempConv]);
        requestAnimationFrame(scrollToEnd);

      if (i < bubbles.length - 1) {
        setLyraTyping(true);
        await new Promise((r) => setTimeout(r, getRandomThinkingTime())); // 3-5 sec delay
        setLyraTyping(false);
      }
      }

    // Sauvegarde finale avec le texte complet
    saveConv(tempConv);
    setYouInputShown(true);
    requestAnimationFrame(scrollToEnd);
    };

  /* ---------------- Première réponse IA ---------------- */
  useEffect(() => {
    if (!chatVisible || conv.length > 0) return;

    const fetchInitialLyraResponse = async () => {
      setLyraTyping(true);
      // Délai initial de 3-5s
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 2001) + 3000));

      const cardNames = finalNames.filter(Boolean);
      const history = [];

      try {
        const data = await fetchLyra({ name: niceName, question, cards: cardNames, userMessage: "", history });
        const responseText = data.text || "Je ressens une interférence... Pouvez-vous patienter un instant ?";
        setLyraTyping(false);
        await showLyraResponseSequentially(responseText, []);
      } catch (err) {
        console.error(err);
        setLyraTyping(false);
        setYouInputShown(true);
      }
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
    const newConv = [...conv, userBubble];
    setConv(newConv);
    saveConv(newConv); // Sauvegarde temporaire du message utilisateur
    requestAnimationFrame(scrollToEnd);

    const handleResponse = async () => {
      setYouInputShown(false);

      const cardNames = finalNames.filter(Boolean);
      const history = newConv.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      try {
        // On n'attend plus ici, la fonction helper gère les pauses
        const data = await fetchLyra({ name: niceName, question, cards: cardNames, userMessage: msg, history });
        const responseText = data.text || "Désolée, ma concentration a été perturbée. Pouvez-vous reformuler ?";
        await showLyraResponseSequentially(responseText, newConv);
      } catch {
        setLyraTyping(false);
        setYouInputShown(true);
      }
    };

    handleResponse();
    };

  /* ---------------- Render ---------------- */
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
                <div className="final-caption">{finalFlip[i] ? finalNames[i] || `Carte ${i + 1}` : ""}</div>
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
              <div className="who">LYRA</div>
              <div className="dots" role="status" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </section>
      </main>

      <div ref={endRef} className={`you-block${youInputShown ? " show" : ""}`}>
        <div className="bubble you input">
          <div className="who">VOUS</div>
          <div className="msg">
            <form onSubmit={onYouSubmit} className="you-form">
              <input
                className="you-input"
                placeholder="Message à Lyra"
                value={youMessage}
                onChange={(e) => setYouMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onYouSubmit();
                  }
                }}
              />
              <button type="submit" className="send-btn" aria-label="Envoyer" title="Envoyer">
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
          </div>
        </div>

        {/* CTA unique : nouveau tirage */}
        <div className="cta-block single">
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
    </div>
  );
}