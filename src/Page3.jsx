import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Page3.css";

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
  "Comment mon projet pourrait avancer ?",
  "Que puis-je comprendre de cette relation ?",
  "Quel conseil pourrais-je recevoir pour ma journée qui commence ?",
  "Comment retrouver un meilleur équilibre ?",
  "Quelles sont mes ressources aujourd’hui ?",
  "Quel est le message profond que je refuse d’entendre ?",
  "Sur quoi dois-je lâcher prise en ce moment ?",
  "Comment puis-je m’aligner davantage avec mes valeurs ?",
  "Que dois-je transformer pour avancer ?",
  "Comment mieux vivre cette transition ?",
  "Où en suis-je dans mon cheminement intérieur ?",
  "Quel potentiel puis-je activer maintenant ?",
  "Qu’est-ce que je fuis sans m’en rendre compte ?",
  "Comment nourrir mes élans créatifs ?",
  "Quelle est la prochaine étape juste pour moi ?",
  "Que m’apprend cette épreuve ?",
  "Sur quoi gagnerais-je à porter davantage d’attention ?",
  "Comment puis-je m’ouvrir à plus de confiance ?",
  "Quel est le message de mon corps ?",
  "Que puis-je apprendre de ce conflit ?"
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
    <div className="question-wrap fp-wrap">
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
            placeholder="Écris ta question ici..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            type="submit"
            className="send-btn"
            aria-label="Envoyer la question"
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>

        <div className="question-examples">
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
        </div>
      </form>

      <div ref={overlayRef} className="question-overlay">
        {transition && <div className="overlay-text">{transition}</div>}
      </div>
    </div>
  );
}

export default Page3;