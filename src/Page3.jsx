// src/Page3.jsx — /question (validation + overlay refus si question incompréhensible)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page3.css";
import { postJson } from "./utils/net";

export default function Page3() {
  const { state } = useLocation();
  const name = (state?.name || "").trim();
  const nav = useNavigate();

  const taRef = useRef(null);
  const lastRefusalIdx = useRef(-1); // évite la même phrase de refus 2x de suite

  // "form" → "formOut" → "ovIn" → "ovHold" → "ovOut"
  const [phase, setPhase] = useState("form");
  const [arrive, setArrive] = useState(false);
  const [question, setQuestion] = useState("");
  const [checking, setChecking] = useState(false);

  const DUR = { formOut: 2000, ovIn: 2000, ovHold: 2000, ovOut: 2000 };

  // Helpers
  const firstNameNice = (s) => {
    const f = String(s || "").trim().split(/\s+/)[0] || "";
    if (!f) return "";
    return f[0].toLocaleUpperCase("fr-FR") + f.slice(1);
  };
  const nice = firstNameNice(name);

  // heuristique locale (fallback si /api/coach indispo)
  const looksInvalid = (s) => {
    const t = String(s || "").trim();
    if (t.length < 4) return true;
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) return true;            // pas de lettres
    if (/^[^A-Za-zÀ-ÖØ-öø-ÿ]+$/.test(t)) return true;          // que symboles/chiffres
    if (/(\p{L})\1{3,}/u.test(t)) return true;                 // même lettre répétée
    return false;
  };

  // Phrases d’ouverture (tutoiement)
  const greetings = useMemo(
    () => [
      (n) => `Ce voyage commence par une simple question. Quelle est la tienne${n ? `, ${n}` : ""} ?`,
      (n) => `Quelle question se murmure dans ton esprit${n ? `, ${n}` : ""} ?`,
      (n) => `${n ? `${n}, ` : ""}je suis à ton écoute. Quelle question t'habite aujourd’hui ?`,
      (n) => `${n ? `${n}, ` : ""}que cherches-tu à éclairer, aujourd’hui ?`,
      (n) => `${n ? `${n}, ` : ""}une question suffit pour embarquer dans un grand voyage. Quelle est la tienne ?`,
      (n) => `Je t'écoute${n ? `, ${n}` : ""}. Quelle question voudrais-tu poser aux arcanes ?`,
      (n) => `${n ? `${n}, ` : ""}que veux-tu demander aux cartes aujourd’hui ?`,
      (n) => `C’est à toi${n ? `, ${n}` : ""}. Quelle question te traverse en ce moment ?`,
      (n) => `${n ? `${n}, ` : ""}pose ta question. Le reste suivra.`,
      (n) => `Une simple question peut ouvrir de nouveaux horizons. Quelle est la tienne${n ? `, ${n}` : ""} ?`,
      (n) => `${n ? `${n}, ` : ""}quel mystère aimerais-tu éclaircir ?`,
    ],
    []
  );
  const [greeting] = useState(() => {
    const pick = greetings[Math.floor(Math.random() * greetings.length)];
    return pick(name);
  });

  // Phrases de transition avant /draw
  const transitions = useMemo(
    () => [
      (n) => `Très bien${n ? `, ${n}` : ""}. Voyons ce que les cartes ont à révéler.`,
      (n) => `Merci${n ? `, ${n}` : ""}. Faisons maintenant parler les cartes.`,
      (n) => `Merci${n ? `, ${n}` : ""}. Laissons maintenant les cartes répondre.`,
      (n) => `Merci${n ? `, ${n}` : ""}. Entrons ensemble dans le langage du Tarot.`,
      (n) => `Parfait${n ? `, ${n}` : ""}. Que les arcanes éclairent ta demande.`,
      (n) => `Merci${n ? `, ${n}` : ""}. Tournons-nous maintenant vers les cartes.`,
      (n) => `Bien${n ? `, ${n}` : ""}. Il est temps de laisser les symboles parler.`,
      (n) => `${n ? `${n}, ` : ""}ta demande a été entendue. Tirons maintenant les cartes.`,
      (n) => `Merci${n ? `, ${n}` : ""}. Voyons ce que les images murmurent en retour.`,
    ],
    []
  );
  const [overlayText, setOverlayText] = useState("");

  // Focus + fade-in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setArrive(true));
    const id = setTimeout(() => taRef.current?.focus(), 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(id); };
  }, []);

  // Orchestration
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const begin = (finalQuestion) => {
    if (phase !== "form") return;
    const pick = transitions[Math.floor(Math.random() * transitions.length)];
    setOverlayText(pick(name));
    setPhase("formOut");
    // overlay in → hold → out → route
    timers.current.push(setTimeout(() => {
      setPhase("ovIn");
      timers.current.push(setTimeout(() => {
        setPhase("ovHold");
        timers.current.push(setTimeout(() => {
          setPhase("ovOut");
          timers.current.push(setTimeout(() => {
            nav("/draw", { state: { name, question: finalQuestion } });
          }, DUR.ovOut));
        }, DUR.ovHold));
      }, DUR.ovIn));
    }, DUR.formOut));
  };

  const showRefusalOverlay = (msg) => {
    // même choré que la transition, puis on revient au formulaire
    setOverlayText(msg);
    setPhase("formOut");

    timers.current.push(setTimeout(() => {
      setPhase("ovIn");
      timers.current.push(setTimeout(() => {
        setPhase("ovHold");
        timers.current.push(setTimeout(() => {
          setPhase("ovOut");
          timers.current.push(setTimeout(() => {
            // ↓↓↓ le champ n’est vidé qu’au retour à l’écran, puis fade-in relancé
            setArrive(false);
            setQuestion("");
            setPhase("form");
            requestAnimationFrame(() => {
              setArrive(true);                 // force un nouveau fade-in du formulaire
              taRef.current?.focus();
            });
          }, DUR.ovOut));
        }, DUR.ovHold));
      }, DUR.ovIn));
    }, DUR.formOut));
  };

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    if (checking) return;                    // évite les doubles envois
    const q = question.trim();
    if (!q) return;

    setChecking(true);
    try {
      // Variantes de message (avec prénom optionnel)
      const refusalLines = [
        (n) => `Oups${n ? `, ${n}` : ""}… je ne saisis pas bien ta question. Peux-tu la reformuler ?`,
        (n) => `Je crois avoir manqué le sens${n ? `, ${n}` : ""}. Tu veux bien préciser ta question ?`,
        (n) => `Ta demande m’échappe un peu${n ? `, ${n}` : ""} — reformulons-la en quelques mots.`,
        (n) => `Je n’ai pas compris ta question${n ? `, ${n}` : ""}. Tu peux la redire autrement ?`,
        (n) => `Hmm${n ? `, ${n}` : ""}… je ne suis pas sûre de te suivre. Reformule en une phrase claire ?`,
        (n) => `Pour que je t’aide vraiment${n ? `, ${n}` : ""}, j’ai besoin d’une question plus précise. Tu reformules ?`,
      ];

      // 1) validation serveur
      let ok = false;
      try {
        const data = await postJson("/api/coach", { name: nice, question: q });
        ok = !!(data?.ok && (data.ok_to_draw || data.quality === "ok"));
      } catch {
        // 2) fallback local
        ok = !looksInvalid(q);
      }

      if (ok) {
        begin(q);
      } else {
        // choix aléatoire sans répéter la dernière phrase
        let idx;
        do {
          idx = Math.floor(Math.random() * refusalLines.length);
        } while (idx === lastRefusalIdx.current && refusalLines.length > 1);
        lastRefusalIdx.current = idx;

        const pick = refusalLines[idx];
        showRefusalOverlay(pick(nice)); // NE PAS vider ici ; c’est géré dans showRefusalOverlay
      }
    } finally {
      setChecking(false);
    }
  };

  const showForm = phase === "form" || phase === "formOut";
  const showOverlay = phase === "ovIn" || phase === "ovHold" || phase === "ovOut";

  return (
    <main className="question-wrap">
      {showForm && (
        <div className={`question-inner ${arrive ? "arrive" : "pre"} ${phase === "formOut" ? "leaving" : ""}`}>
          <h1 className="question-title">{greeting}</h1>

          <form className="question-form" onSubmit={onSubmit} autoComplete="off">
            <label className="sr-only" htmlFor="q">Ta question</label>
            <div className="input-bubble textarea">
              <textarea
                id="q"
                ref={taRef}
                placeholder="Pose ta question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  // évite les soucis avec claviers/IME
                  if (e.isComposing || e.nativeEvent.isComposing) return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                aria-label="Ta question"
              />
              <button
                type="submit"
                className="send-btn"
                aria-label="Envoyer"
                title="Envoyer"
                disabled={!question.trim() || checking}
                aria-busy={checking ? "true" : "false"}
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {showOverlay && (
        <div
          className={
            "question-overlay " +
            (phase === "ovIn" ? "overlay-in" : phase === "ovHold" ? "overlay-hold" : "overlay-out")
          }
          aria-live="polite"
        >
          <p className="overlay-text">{overlayText}</p>
        </div>
      )}
    </main>
  );
}