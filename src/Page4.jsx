// src/Page4.jsx — deck → final 3 cartes → chat (fil persistant + 1er msg IA + UX J8)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page4.css";
import background from "./assets/background.jpg";
import { postJson, toast } from "./utils/net";
import "./toast.css";
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

// Streaming SSE (serveur /api/lyra/stream) — conserve les \n envoyés par le serveur
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
      const line = buf.slice(0, nl);  // ne pas .trim()
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

function splitIntoBubbles(text, max = 3) {
  if (!text) return [""];
  const parts = String(text).split(/\r?\n\s*\r?\n+/); // coupe sur lignes vides
  if (parts.length <= max) return parts;
  const head = parts.slice(0, max - 1);
  const tail = parts.slice(max - 1).join("\n\n");     // compresse le reste
  return [...head, tail];
}

/* ---------------- Chargement faces ---------------- */
const FACE_MODULES = import.meta.glob("./assets/cards/*.{png,jpg,jpeg,webp}", { eager: true });
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
  "00": "Le Mat", "01": "Le Bateleur", "02": "La Papesse", "03": "L’impératrice", "04": "L’Empereur", "05": "Le Pape", "06": "L’Amoureux", "07": "Le Chariot", "08": "La Justice", "09": "L’Hermite", "10": "La Roue de Fortune", "11": "La Force", "12": "Le Pendu", "13": "L’Arcane Sans Nom", "14": "Tempérance", "15": "Le Diable", "16": "La Maison Dieu", "17": "L’Étoile", "18": "La Lune", "19": "Le Soleil", "20": "Le Jugement", "21": "Le Monde",
};
function labelFrom(fileName) {
  const maj = fileName.match(/^([0-2]\d)_/);
  if (maj) return MAJOR_LABELS[maj[1]] || fileName;
  const m = fileName.match(/^([DEBC])(0[1-9]|1[0-4])_/);
  if (!m) return fileName;
  const suit = { D: "Deniers", E: "Épées", B: "Baton", C: "Coupe" }[m[1]];
  const num = parseInt(m[2], 10);
  const prep = suit.startsWith("É") ? "d’" : "de ";
  if (num <= 10) return `${num === 1 ? "As" : num} ${prep}${suit}`;
  return `${{ 11: "Valet", 12: "Reine", 13: "Roi", 14: "Cavalier" }[num]} ${prep}${suit}`;
}
const pick = (arr) => (arr?.length ? arr[Math.floor(Math.random() * arr.length)] : null);

/* ---------------- Component ---------------- */
export default function Page4() {
  const { state } = useLocation();
  const nav = useNavigate();
  const name = (state?.name || "voyageur").trim();
  const niceName = useMemo(() => firstNameNice(name), [name]);
  const question = (state?.question || "").trim();
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const DUR = useMemo(() => ({
    fly: prefersReduced ? 60 : 600,
    boardFade: prefersReduced ? 300 : 1500,
    finalPauseBefore: prefersReduced ? 200 : 500,
    finalGap: prefersReduced ? 300 : 800,
    flipAnim: prefersReduced ? 200 : 620,
  }), [prefersReduced]);

  /* --------- Phases & Animations --------- */
  const [phase, setPhase] = useState("deck");
  const [isExiting, setIsExiting] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [showRail, setShowRail] = useState(false);

  // Staggered entry animation
  useEffect(() => {
    const t1 = setTimeout(() => setShowTitle(true), 200);
    const t2 = setTimeout(() => setShowInstructions(true), 700);
    const t3 = setTimeout(() => {
      setShowDeck(true);
      setShuffleActive(true);
    }, 1200);
    const t4 = setTimeout(() => setShowRail(true), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  /* --------- Tirage Logic --------- */
  const [shuffleActive, setShuffleActive] = useState(false);
  const [deckCount, setDeckCount] = useState(14);
  const [chosen, setChosen] = useState([]);
  const [popIndex, setPopIndex] = useState(null);
  const pickingRef = useRef(false);
  const deckRef = useRef(null);
  const slotRefs = [useRef(null), useRef(null), useRef(null)];
  const [flight, setFlight] = useState(null);

  const computeFlight = (targetIndex) => {
    const deckEl = deckRef.current;
    const slotEl = slotRefs[targetIndex]?.current;
    if (!deckEl || !slotEl) return null;
    const d = deckEl.getBoundingClientRect();
    const s = slotEl.getBoundingClientRect();
    const deckCenterX = d.left + d.width / 2;
    const deckCenterY = d.top + d.height / 2;
    const slotCenterX = s.left + s.width / 2;
    const slotCenterY = s.top + s.height / 2;
    const dx = slotCenterX - deckCenterX;
    const dy = slotCenterY - deckCenterY;
    const scale = s.width / d.width;
    return { key: Date.now(), left: d.left, top: d.top, dx, dy, scale, width: d.width, height: d.height };
  };

  const pickCardTo = (targetIndex) => {
    if (phase !== "deck" || pickingRef.current || chosen.length >= 3 || deckCount <= 0) return;
    if (![0, 1, 2].filter(i => !chosen.includes(i)).includes(targetIndex)) return;
    pickingRef.current = true;
    const fl = computeFlight(targetIndex);
    if (fl) setFlight(fl);
    setTimeout(() => {
      setDeckCount((n) => Math.max(0, n - 1));
      setChosen((p) => {
        const next = [...p, targetIndex];
        setPopIndex(targetIndex);
        setTimeout(() => setPopIndex(null), Math.min(450, DUR.fly + 50));
        if (next.length === 3) {
          setTimeout(() => {
            setShuffleActive(false);
            setIsExiting(true);
            setTimeout(() => setPhase("finished"), DUR.boardFade);
          }, 600);
        }
        return next;
      });
      setFlight(null);
      pickingRef.current = false;
    }, DUR.fly);
  };

  /* --------- Final (faces + chat) --------- */
  const [finalFlip, setFinalFlip] = useState([false, false, false]);
  const [finalFaces, setFinalFaces] = useState([null, null, null]);
  const [finalNames, setFinalNames] = useState(["", "", ""]);
  const [sealed, setSealed] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [conv, setConv] = useState([]);
  const [youInputShown, setYouInputShown] = useState(false);
  const [youMessage, setYouMessage] = useState("");
  const [lyraTyping, setLyraTyping] = useState(false);
  const [replyTyping, setReplyTyping] = useState("");
  const endRef = useRef(null);
  const streamAbortRef = useRef(null);

  const scrollToEnd = () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

  useEffect(() => {
    if (phase !== "finished") return;
    setConv([]); setYouInputShown(false); setLyraTyping(false); setReplyTyping("");
    const t1 = setTimeout(() => { const c = pick(FACE_POOLS.majors); setFinalFaces(p => [c?.src || null, p[1], p[2]]); setFinalNames(p => [c ? labelFrom(c.name) : "", p[1], p[2]]); setFinalFlip(p => [true, p[1], p[2]]); }, DUR.finalPauseBefore);
    const t2 = setTimeout(() => { const c = pick(FACE_POOLS.minorsValues); setFinalFaces(p => [p[0], c?.src || null, p[2]]); setFinalNames(p => [p[0], c ? labelFrom(c.name) : "", p[2]]); setFinalFlip(p => [true, true, p[2]]); }, DUR.finalPauseBefore + DUR.finalGap);
    const t3 = setTimeout(() => { const c = pick(FACE_POOLS.minorsCourt); setFinalFaces(p => [p[0], p[1], c?.src || null]); setFinalNames(p => [p[0], p[1], c ? labelFrom(c.name) : ""]); setFinalFlip(p => [true, true, true]); }, DUR.finalPauseBefore + DUR.finalGap * 2);
    const t4 = setTimeout(() => setSealed(true), DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 120);
    const tChat = setTimeout(() => setChatVisible(true), DUR.finalPauseBefore + DUR.finalGap * 2 + DUR.flipAnim + 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(tChat); };
  }, [phase, DUR]);

  useEffect(() => {
    if (!chatVisible) return;
    (async () => {
      setLyraTyping(true); setYouInputShown(false);
      const cards = finalNames.filter(Boolean);
      const history = conv.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      let streamed = false, streamedText = "";
      try {
        streamAbortRef.current?.abort?.();
        streamAbortRef.current = new AbortController();
        for await (const chunk of fetchLyraStream({ name: niceName, question, cards, userMessage: "", history, signal: streamAbortRef.current.signal })) {
          if (!streamed) { streamed = true; setLyraTyping(false); }
          streamedText += chunk;
          setReplyTyping(p => p + chunk);
          requestAnimationFrame(scrollToEnd);
        }
      } catch {} finally { streamAbortRef.current = null; }
      if (streamed) {
        const text = streamedText.trim();
        setReplyTyping("");
        setConv(p => { const next = [...p, { id: Date.now(), role: "lyra", text }]; saveConv(next); return next; });
        setYouInputShown(true);
        requestAnimationFrame(scrollToEnd);
        return;
      }
      const t0 = Date.now();
      let text = "";
      try { text = await fetchLyra({ name: niceName, question, cards, userMessage: "", history }); } catch { text = "Je réfléchis… (réponse momentanément indisponible)."; }
      const wait = Math.max(0, 1500 + (text.length * 20) - (Date.now() - t0));
      setTimeout(() => {
        setLyraTyping(false);
        setConv(p => { const next = [...p, { id: Date.now(), role: "lyra", text }]; saveConv(next); return next; });
        setYouInputShown(true);
        requestAnimationFrame(scrollToEnd);
      }, wait);
    })();
  }, [chatVisible, finalNames, niceName, question, conv]);

  useEffect(() => { if (chatVisible) requestAnimationFrame(scrollToEnd); }, [chatVisible]);
  useEffect(() => { requestAnimationFrame(scrollToEnd); }, [conv.length, lyraTyping, replyTyping, youInputShown]);
  useEffect(() => { const saved = loadConv(); if (saved.length) setConv(saved); }, []);

  const onYouSubmit = async (e) => {
    if (e) e.preventDefault();
    const msg = youMessage.trim();
    if (!msg) return;
    recordUserMsg(msg.length);
    const userBubble = { id: Date.now(), role: "user", text: msg };
    setConv(p => { const next = [...p, userBubble]; saveConv(next); return next; });
    requestAnimationFrame(scrollToEnd);
    setYouMessage(""); setYouInputShown(false); setLyraTyping(true);
    requestAnimationFrame(scrollToEnd);
    const cards = finalNames.filter(Boolean);
    const history = [...conv, userBubble].map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    let streamed = false, streamedText = "";
    try {
      streamAbortRef.current?.abort?.();
      streamAbortRef.current = new AbortController();
      for await (const chunk of fetchLyraStream({ name: niceName, question, cards, userMessage: msg, history, signal: streamAbortRef.current.signal })) {
        if (!streamed) { streamed = true; setLyraTyping(false); }
        streamedText += chunk;
        setReplyTyping(p => p + chunk);
        requestAnimationFrame(scrollToEnd);
      }
    } catch { toast("Connexion instable — passage au mode non-stream."); } finally { streamAbortRef.current = null; }
    if (streamed) {
      const text = streamedText;
      setReplyTyping("");
      setConv(p => { const next = [...p, { id: Date.now() + 1, role: "lyra", text }]; saveConv(next); return next; });
      setYouInputShown(true);
      requestAnimationFrame(scrollToEnd);
      return;
    }
    const t0 = Date.now();
    let text = "";
    try { text = await fetchLyra({ name: niceName, question, cards, userMessage: msg, history }); } catch { text = "Je réfléchis… (réponse momentanément indisponible)."; }
    const wait = Math.max(0, 1500 + (text.length * 20) - (Date.now() - t0));
    setTimeout(() => {
      setLyraTyping(false);
      setConv(conv => { const next = [...conv, { id: Date.now() + 1, role: "lyra", text }]; saveConv(next); return next; });
      setYouInputShown(true);
      requestAnimationFrame(scrollToEnd);
    }, wait);
  };

  return (
    <div className="page4-root" style={{ backgroundImage: `url(${background})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className={`p4-fixed-title ${showTitle ? "is-visible" : ""}`}>{question}</div>
      {phase === "finished" ? (
        <main className="final-stack">
          <section className="final-hero">
            <div className={`final-rail appear-slow${sealed ? " sealed" : ""}`}>
              {[0, 1, 2].map(i => (
                <div key={`final-${i}`} className="final-card-wrap">
                  <div className="final-card-outer">
                    <div className={`final-card-flip${finalFlip[i] ? " is-flipped" : ""}`}>
                      <div className="final-face final-back" />
                      <div className="final-face final-front">
                        {finalFaces[i] ? <img src={finalFaces[i]} alt={finalNames[i] || `Carte ${i + 1}`} /> : <div className="final-front-placeholder">Carte {i + 1}</div>}
                      </div>
                    </div>
                  </div>
                  <div className={`final-caption${finalFlip[i] ? " is-visible" : ""}`}>{finalNames[i] || `Carte ${i + 1}`}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="chat-wrap show" aria-live="polite" onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
            {conv.map(m => {
              if (m.role === "lyra") {
                const segments = splitIntoBubbles(m.text, 3);
                return (
                  <React.Fragment key={m.id}>
                    {segments.map((seg, idx) => (
                      <div key={`${m.id}-${idx}`} className={`bubble lyra${idx > 0 ? " stacked" : ""} lyra-fadein`}>
                        <div className="who">LYRA</div>
                        <div className="msg">{seg.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>)}</div>
                      </div>
                    ))}
                  </React.Fragment>
                );
              }
              return (
                <div key={m.id} className="bubble you">
                  <div className="who">VOUS</div>
                  <div className="msg">{m.text.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>)}</div>
                </div>
              );
            })}
            {lyraTyping && <div className="bubble lyra typing" aria-live="polite" aria-label="Lyra est en train d’écrire"><div className="who">LYRA</div><div className="dots" role="status" aria-hidden="true"><span /><span /><span /></div></div>}
            {replyTyping && !lyraTyping && <> {splitIntoBubbles(replyTyping, 3).map((seg, idx) => (<div key={`stream-${idx}`} className={`bubble lyra${idx > 0 ? " stacked" : ""} lyra-fadein`} style={{ animation: "fadeInSoft 800ms" }}><div className="who">LYRA</div><div className="msg">{seg.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0" }}>{line || "\u00A0"}</p>)}</div></div>))} </>}
          </section>
        </main>
      ) : (
        <div className="page4-wrap">
          <div className={`p4-fixed-instructions ${showInstructions ? "is-visible" : ""} ${isExiting ? "is-exiting" : ""}`}>
            <div className="p4-instruction">Continue de te concentrer sur ta demande, et pioche 3 cartes.</div>
          </div>
          <div className={`board-shell ${isExiting ? "is-exiting" : ""}`}>
            <div className={`board${isLandscape ? "" : " col"}`}>
              <div className={`deck-block ${showDeck ? "is-visible" : ""}`}>
                <div ref={deckRef} className={`deck-area${shuffleActive ? " shuffling" : ""}`} onClick={() => pickCardTo(availableSlots[0] ?? 0)} role="button" tabIndex={0} aria-label="Jeu de cartes : touchez pour piocher (séquentiel)">
                  {[...Array(deckCount)].map((_, i) => <div key={`deck-${i}`} className="card card-back stack" style={{ zIndex: i }} />)}
                </div>
              </div>
              <div className={`chosen-rail ${showRail ? "is-visible" : ""}`}>
                {[0, 1, 2].map(i => {
                  const isChosen = chosen.includes(i);
                  const isPopped = i === popIndex;
                  return (
                    <div key={`slotwrap-${i}`} ref={slotRefs[i]} className="slot-wrap">
                      {isChosen ? <div className={`card card-back chosen${isPopped ? " pop" : ""}`} /> : <div className="card slot-ghost" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`you-block${youInputShown ? " show" : ""}`}>
        <div className="bubble you input">
          <div className="who">VOUS</div>
          <div className="msg">
            <form onSubmit={onYouSubmit} className="you-form">
              <input className="you-input" placeholder="Message à Lyra" value={youMessage} onChange={e => setYouMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onYouSubmit(); } }} />
              <button type="submit" className="send-btn" aria-label="Envoyer" title="Envoyer"><span className="material-symbols-outlined">send</span></button>
            </form>
          </div>
        </div>
        <button type="button" className="newdraw-btn" onClick={() => { localStorage.removeItem("lyra:conv"); nav("/question", { state: { name } }); }}>Je souhaite réaliser un nouveau tirage</button>
      </div>
      <div ref={endRef} aria-hidden="true" />
      {flight && <div key={flight.key} className="fly-phys" style={{ left: `${flight.left}px`, top: `${flight.top}px`, width: `${flight.width}px`, height: `${flight.height}px`, "--dx": `${flight.dx}px`, "--dy": `${flight.dy}px`, "--scale": flight.scale, animationDuration: `${DUR.fly}ms`, }}><div className="card card-back" /></div>}
    </div>
  );
}