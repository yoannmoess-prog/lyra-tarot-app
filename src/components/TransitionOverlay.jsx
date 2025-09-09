// src/components/TransitionOverlay.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./TransitionOverlay.css";

/**
 * Props :
 *  - open: boolean
 *  - lines: string[] (phrases candidates)
 *  - name?: string (pour interpolation)
 *  - durations?: {blankBefore?:number, show?:number, blankAfter?:number}
 *  - onDone?: () => void
 */
export default function TransitionOverlay({
  open,
  lines = [],
  name = "",
  durations = { blankBefore: 500, show: 2000, blankAfter: 500 },
  onDone,
}) {
  const [phase, setPhase] = useState(open ? "blankBefore" : "closed");

  useEffect(() => {
    if (!open) { setPhase("closed"); return; }
    setPhase("blankBefore");
  }, [open]);

  useEffect(() => {
    if (phase === "closed") return;
    let t1, t2;
    if (phase === "blankBefore") {
      t1 = setTimeout(() => setPhase("show"), durations.blankBefore ?? 500);
    } else if (phase === "show") {
      t2 = setTimeout(() => setPhase("blankAfter"), durations.show ?? 2000);
    } else if (phase === "blankAfter") {
      const t = setTimeout(() => {
        setPhase("closed");
        onDone?.();
      }, durations.blankAfter ?? 500);
      return () => clearTimeout(t);
    }
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, durations, onDone]);

  const text = useMemo(() => {
    if (!lines.length) return "";
    const pick = lines[Math.floor(Math.random() * lines.length)];
    return pick.replace(/\(Nom de l’utilisateur\)|\{name\}|\$NAME/gi, name || "");
  }, [lines, name]);

  if (!open && phase === "closed") return null;

  return (
    <div className={`to-root ${phase}`} role="status" aria-live="polite">
      <div className="to-center">
        {phase === "show" ? <p className="to-line">{text}</p> : null}
      </div>
    </div>
  );
}