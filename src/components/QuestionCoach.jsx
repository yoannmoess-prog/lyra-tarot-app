// src/components/QuestionCoach.jsx
import React, { useMemo, useState } from "react";
import { postJson, toast } from "../utils/net.js";
import "./question-coach.css";

export default function QuestionCoach({ name, question, onUseSuggestion, onQualityChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState([]);
  const [sugs, setSugs] = useState([]);
  const [followup, setFollowup] = useState("");
  const [coachAsk, setCoachAsk] = useState(""); // réponse courte à la relance
  const [quality, setQuality] = useState("ok");
  const [okToDraw, setOkToDraw] = useState(true);

  // petit heuristique: auto-suggérer d'ouvrir le coach si très court ou trop long
  const autoHint = useMemo(() => {
    const len = (question || "").trim().length;
    return len > 0 && (len < 12 || len > 220);
  }, [question]);

  async function run(extra = "") {
    const q = (question || "").trim();
    if (!q) { toast("Écris d’abord une question ✍️"); return; }

    try {
      setLoading(true);
      const data = await postJson("/api/coach", { name, question: q, extra });
      if (!data?.ok) throw new Error("coach_error");

      setIssues(Array.isArray(data.issues) ? data.issues : []);
      setSugs(Array.isArray(data.suggestions) ? data.suggestions : []);
      setFollowup(typeof data.followup === "string" ? data.followup : "");
      setQuality(data.quality === "needs_clarify" ? "needs_clarify" : "ok");
      setOkToDraw(Boolean(data.ok_to_draw));

      onQualityChange?.(Boolean(data.ok_to_draw));
      setOpen(true);
    } catch (e) {
      console.error(e);
      toast("Impossible d’analyser la question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="coach-root">
      <div className="coach-row">
        <button
          type="button"
          className={`coach-btn ${autoHint ? "pulse" : ""}`}
          onClick={() => run()}
          disabled={loading}
          aria-expanded={open}
        >
          {loading ? "Analyse…" : "Besoin d’aide pour formuler ?"}
        </button>
        {quality === "needs_clarify" && (
          <span className="coach-chip warn" title="La question peut être clarifiée">à clarifier</span>
        )}
        {okToDraw && quality === "ok" && (question || "").trim() && (
          <span className="coach-chip ok" title="Question claire">ok</span>
        )}
      </div>

      {open && (
        <div className="coach-panel" role="region" aria-label="Aide à la formulation">
          {issues.length > 0 && (
            <div className="coach-block">
              <div className="coach-title">Ce que je perçois</div>
              <ul className="coach-list">
                {issues.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          )}

          {sugs.length > 0 && (
            <div className="coach-block">
              <div className="coach-title">Propositions</div>
              <div className="coach-sugs">
                {sugs.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="coach-sug"
                    onClick={() => onUseSuggestion?.(s)}
                    title="Remplacer ma question par cette proposition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {followup && (
            <div className="coach-block">
              <div className="coach-title">Une précision rapide ?</div>
              <div className="coach-follow">
                <div className="coach-follow-q">{followup}</div>
                <input
                  className="coach-input"
                  value={coachAsk}
                  onChange={(e) => setCoachAsk(e.target.value)}
                  placeholder="Ta réponse en une phrase"
                />
                <button
                  type="button"
                  className="coach-btn"
                  onClick={() => run(coachAsk)}
                  disabled={loading || !coachAsk.trim()}
                >
                  Affiner les propositions
                </button>
              </div>
            </div>
          )}

          <div className="coach-foot">
            <span className="hint">
              {okToDraw ? "Tu peux lancer le tirage dès que tu veux." : "Clarifions un peu avant de tirer les cartes."}
            </span>
            <button type="button" className="coach-close" onClick={() => setOpen(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}