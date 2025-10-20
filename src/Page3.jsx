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
  const [checking, setChecking] = useState(false);
  const [arrive, setArrive] = useState(false);
  const [transition, setTransition] = useState(null);
  const inputRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setArrive(true), 40);
    // Focus sur l'input dès l'arrivée
    inputRef.current?.focus();
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = useCallback(() => {
    if (checking) return;
    const q = question.trim();
    if (!q || looksInvalid(q)) return;

    setChecking(true);
    setArrive(false);

    // Lancement de la transition visuelle
    setTimeout(() => {
      setTransition("Très bien. Voyons ce que les cartes ont à révéler...");
      overlayRef.current?.classList.add("overlay-in");
    }, 300);

    // 🔁 NAVIGATION VERS /draw IMMÉDIATE (non bloquante)
    setTimeout(() => {
      navigate("/draw", { state: { name, question: q } });
    }, 2600); // On garde les 2.6s d'animation comme avant

    // 🔄 Appel à l’IA en arrière-plan (sans bloquer le front)
    fetch("/api/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    }).catch((err) => {
      console.error("Erreur IA : ", err); // ← utile en dev
      // TODO : gérer un fallback plus tard si besoin
    });
  }, [checking, question, navigate, name]);

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

  return (
    <div
      className="question-wrap fp-wrap"
      style={{
        backgroundImage: `url(${background})`,
      }}
    >
      <form
        className={`question-inner ${arrive ? "arrive" : "pre"} ${!arrive && checking ? "leaving" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="question-title">
          {randomIntro}
        </div>

        <div className="q-shuffle is-on">
          {[...Array(5)].map((_, i) => (
            <div
              className="card"
              key={i}
              style={{
                "--rot": `${-14 + i * 7}deg`,
                "--shift": `${-20 + i * 10}%`
              }}
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
          <button
            type="submit"
            className="send-btn"
            aria-label="Envoyer la question"
          >
            <span
              className="material-symbols-outlined"
              style={{ color: question ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }}
            >
              arrow_forward
            </span>
          </button>
        </div>

        {/* <div className="question-examples">
          {randomExamples.map((ex, i) => (
            <button
              key={i}
              type="button"
              className="question-example"
              onClick={() => handleClickExample(ex)}
            >
              {ex}
            </button>
          ))}
        </div> */}
      </form>

      <div ref={overlayRef} className="question-overlay">
        {transition && <div className="overlay-text">{transition}</div>}
      </div>
    </div>
  );
}

export default Page3;
