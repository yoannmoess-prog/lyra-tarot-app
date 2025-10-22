import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page3.css";
import background from "./assets/background.webp";

const questionIntros = [
  "Quelle est ta question du jour ?",
  "Dis-moi ce qui t’interroge en ce moment.",
  "Quelle question t’habite aujourd'hui ?",
  "Quel est ton doute, ton élan, ta quête ?",
  "Sur quoi aimerais-tu avoir plus de clarté ?",
  "Quelle est ta préoccupation du moment ?",
  "Que veux-tu vraiment savoir aujourd’hui ?"
];

const ALL_EXAMPLES = [
  "Comment faire avancer mon projet ?",
  "Un conseil pour ma journée qui commence ?",
  "Comment retrouver un meilleur équilibre ?",
  "Quelle est ma meilleure ressource pour aujourd'hui ?",
  "Quel est le message profond que je refuse d’entendre ?",
  "Sur quoi dois-je lâcher prise en ce moment ?",
  "Comment puis-je m’aligner davantage avec mes valeurs ?",
  "Que dois-je transformer pour avancer ?",
  "Comment mieux vivre cette transition ?",
  "Où en suis-je dans mon cheminement intérieur ?",
  "Qu’est-ce que je fuis sans m’en rendre compte ?",
  "Comment nourrir mes élans créatifs ?",
  "Quelle est la prochaine étape juste pour moi ?",
  "Que m’apprend cette épreuve ?",
  "Quel est le message de mon corps ?",
  "Quelle peur inconsciente m’empêche d’avancer ?",
  "Qu’est-ce que je refuse encore de voir en moi ?",
  "Comment faire ce choix ?",
  "Comment puis-je m’unifier davantage intérieurement ?",
  "Que puis-je apprendre de cette relation ?",
  "Comment m’ouvrir à un lien plus vrai, plus nourrissant ?",
  "Quelle est la dynamique invisible entre moi et cette personne ?",
  "Quelle est l’émotion que je tente d’éviter dans cette situation ?",
  "Comment puis-je m’apaiser sans me fuir ?",
  "Comment traverser ma situation actuelle ?",
  "Où en suis-je dans ma vocation profonde ?",
  "Quelle est ma posture intérieure au travail ?",
  "Quelle fonction cachée a cette habitude dans ma vie ?",
  "Quelle est la vraie blessure derrière ce comportement répétitif ?",
  "Quelle image de moi-même suis-je en train de défendre ?",
  "Comment puis-je rompre avec ce schéma ?",
  "Qu’est-ce qui me retient dans ce choix ?",
  "Quelle est l’option alignée avec ma vérité ?",
  "Si je m’écoutais vraiment, que choisirais-je ?",
  "Quelle illusion influence ma prise de décision ?",
  "Que me dit ma voix intérieure que je n’ose pas entendre ?",
  "Quelle est la croyance inconsciente qui limite ma liberté ?",
  "Que puis-je faire pour me reconnecter à plus grand que moi ?",
  "Quelle est la dimension sacrée de ce que je vis ?",
  "Quel est le message de mon âme aujourd’hui ?",
  "Quelle est cette mémoire du corps qui se réveille ?",
  "Quelle part inconsciente de moi-même est à l’œuvre dans ce comportement ?",
  "Quelle est la posture juste dans cette situation ?",
  "Quelle est la petite action juste à poser maintenant ?",
  "Qu’est-ce qui me ferait du bien même un peu ?",
  "Que suis-je invité à laisser derrière moi ?",
  "Quelle image intérieure peut m’accompagner aujourd’hui ?"
];

function looksInvalid(input) {
  const q = input.trim();
  if (q.length < 8) return true;
  if (!q.includes(" ")) return true;
  if (!/[a-zA-Z]/.test(q)) return true;
  if (/^(oui|non|ok|test)$/i.test(q)) return true;
  return false;
}

function Page3() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const name = state?.name;
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState("form"); // "form", "formOut", "ov1In", "ov1Hold", "ov1Out", "ov2In", "ov2Hold", "ov2Out"
  const [overlayText, setOverlayText] = useState("");
  const inputRef = useRef(null);
  const timers = useRef([]);

  const DUR = { formOut: 1000, ovIn: 1000, ovHold: 1500, ovOut: 1000 };

  useEffect(() => {
    const timer = requestAnimationFrame(() => setPhase("form"));
    inputRef.current?.focus();
    return () => {
      cancelAnimationFrame(timer);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const onSubmit = useCallback(() => {
    if (phase !== "form") return;
    const q = question.trim();
    if (!q || looksInvalid(q)) return;

    setPhase("formOut");

    timers.current.push(setTimeout(() => {
      // Délai "background vide"
      timers.current.push(setTimeout(() => {
        setOverlayText(`Très bien, ${name}.`);
        setPhase("ov1In");
        timers.current.push(setTimeout(() => {
          setPhase("ov1Hold");
          timers.current.push(setTimeout(() => {
            setPhase("ov1Out");
            timers.current.push(setTimeout(() => {
              setOverlayText("Prépare-toi à tirer les cartes.");
              setPhase("ov2In");
              timers.current.push(setTimeout(() => {
                setPhase("ov2Hold");
                timers.current.push(setTimeout(() => {
                  setPhase("ov2Out");
                  timers.current.push(setTimeout(() => {
                    navigate("/draw", { state: { name, question: q } });
                  }, DUR.ovOut));
                }, DUR.ovHold));
              }, DUR.ovIn));
            }, 500)); // Délai entre les phrases
          }, DUR.ovOut));
        }, DUR.ovHold));
      }, 500)); // 500ms de "background vide"
    }, DUR.formOut));
  }, [phase, question, navigate, name]);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onSubmit]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [question]);

  const handleClickExample = (q) => {
    setQuestion(q);
    inputRef.current?.focus();
  };

  const randomIntro = useMemo(() => {
    return questionIntros[Math.floor(Math.random() * questionIntros.length)];
  }, []);

  const randomExamples = useMemo(() => {
    const shuffled = [...ALL_EXAMPLES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
  }, []);

  const showForm = phase === "form" || phase === "formOut";
  const showOverlay = phase.startsWith("ov");

  let overlayClass = "";
  if (phase === "ov1In" || phase === "ov1Hold" || phase === "ov2In" || phase === "ov2Hold") {
    overlayClass = "overlay-in";
  } else if (phase === "ov1Out" || phase === "ov2Out") {
    overlayClass = "overlay-out";
  }


  return (
    <div className="question-wrap fp-wrap">
      {showForm && (
        <form
          className={`question-inner ${phase === "form" ? "arrive" : "pre"} ${phase === "formOut" ? "leaving" : ""}`}
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        >
          <div className="question-title">{randomIntro}</div>
          <div className="q-shuffle is-on">
            {[...Array(5)].map((_, i) => (
              <div
                className="card"
                key={i}
                style={{ "--rot": `${-14 + i * 7}deg`, "--shift": `${-20 + i * 10}%` }}
              />
            ))}
          </div>
          <div className="input-bubble textarea">
            <textarea
              ref={inputRef}
              rows="1"
              placeholder="Écris ta question ici..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button type="submit" className="send-btn" aria-label="Envoyer la question">
              <span className="material-symbols-outlined" style={{ color: question ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }}>
                arrow_forward
              </span>
            </button>
          </div>
        </form>
      )}

      {showOverlay && (
        <div className={`question-overlay ${overlayClass}`}>
          <div className="overlay-text">{overlayText}</div>
        </div>
      )}
    </div>
  );
}

export default Page3;
