// src/components/DebugBar.jsx
import React, { useEffect, useState } from "react";
import { getSessionId } from "../utils/session";

export default function DebugBar() {
  const [sid, setSid] = useState("");
  const [copied, setCopied] = useState(false);
  const [ux, setUx] = useState({ count: 0, avg: 0 });

  useEffect(() => {
    getSessionId().then(setSid).catch(() => {});
    const refresh = () => {
      try {
        const s = JSON.parse(localStorage.getItem("lyra:uxstats") || '{"count":0,"sum":0}');
        const avg = s.count ? Math.round((s.sum / s.count) * 10) / 10 : 0;
        setUx({ count: s.count || 0, avg });
      } catch { setUx({ count: 0, avg: 0 }); }
    };
    refresh();
    const int = setInterval(refresh, 1500);
    return () => clearInterval(int);
  }, []);

  if (!sid) return null;

  return (
    <div className="debugbar">
      <button
        className="debugbar-btn"
        onClick={async () => {
          await navigator.clipboard.writeText(sid);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        title="Copier l’ID de session"
      >
        Copier ID session
      </button>
      <span className="debugbar-info">
        VOUS: {ux.count} msg · {ux.avg} car. moy.
      </span>
      {copied && <span className="debugbar-toast">Copié !</span>}
    </div>
  );
}