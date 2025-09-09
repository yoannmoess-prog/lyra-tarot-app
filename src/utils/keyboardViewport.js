// src/utils/keyboardViewport.js
import { useEffect, useRef, useState } from "react";

/**
 * Mesure l'inset bas quand le clavier apparaît (via VisualViewport si dispo),
 * met à jour la variable CSS --kb et ajoute la classe .kb-open sur <html>.
 * Retourne la hauteur clavier en px.
 */
export function useKeyboardViewport() {
  const [inset, setInset] = useState(0);
  const baseInnerH = useRef(typeof window !== "undefined" ? window.innerHeight : 0);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (val) => {
      const v = Math.max(0, Math.round(val));
      setInset(v);
      root.style.setProperty("--kb", v + "px");
      root.classList.toggle("kb-open", v > 0);
    };

    const vv = window.visualViewport;

    // Handler VisualViewport (iOS/Android modernes)
    const onVV = () => {
      const ih = window.innerHeight;
      const insetBottom = ih - vv.height - vv.offsetTop; // peut être négatif: clamp à 0
      apply(insetBottom);
    };

    // Fallback simple (anciens navigateurs)
    const onWin = () => {
      const delta = baseInnerH.current - window.innerHeight;
      apply(delta);
    };

    if (vv && "height" in vv) {
      vv.addEventListener("resize", onVV);
      vv.addEventListener("scroll", onVV);
      onVV(); // init
      return () => {
        vv.removeEventListener("resize", onVV);
        vv.removeEventListener("scroll", onVV);
        root.style.removeProperty("--kb");
        root.classList.remove("kb-open");
      };
    } else {
      window.addEventListener("resize", onWin);
      onWin(); // init
      return () => {
        window.removeEventListener("resize", onWin);
        root.style.removeProperty("--kb");
        root.classList.remove("kb-open");
      };
    }
  }, []);

  return inset;
}

/**
 * Fait défiler le champ focusé au centre de l’écran (après l’anim du clavier).
 * À utiliser sur le conteneur d’un formulaire.
 */
export function useAutoScrollOnFocus(containerRef, { delay = 250, block = "center" } = {}) {
  useEffect(() => {
    const root = containerRef?.current || document;
    const onFocus = (e) => {
      const el = e.target;
      if (!el || !(el instanceof HTMLElement)) return;
      // petit délai pour laisser le clavier s'ouvrir
      setTimeout(() => {
        try {
          el.scrollIntoView({ block, behavior: "smooth" });
        } catch {
          // vieux navigateurs : fallback
          el.scrollIntoView();
        }
      }, delay);
    };
    root.addEventListener("focusin", onFocus);
    return () => root.removeEventListener("focusin", onFocus);
  }, [containerRef, delay, block]);
}

/**
 * Composant utilitaire à monter une fois (ex: dans App) pour activer --kb et .kb-open.
 */
export function KeyboardViewportFix() {
  useKeyboardViewport();
  return null;
}