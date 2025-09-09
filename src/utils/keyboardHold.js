// src/utils/keyboardHold.js
let anchor = null;
let releaseId = null;

function ensureAnchor() {
  if (anchor) return anchor;
  anchor = document.createElement("input");
  anchor.type = "text";
  anchor.setAttribute("aria-hidden", "true");
  Object.assign(anchor.style, {
    position: "fixed",
    left: "-9999px",
    bottom: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(anchor);
  return anchor;
}

/** Garde le clavier ouvert pendant `ms` ms (one-shot, sans interval). */
export function holdKeyboardFor(ms = 2200) {
  const el = ensureAnchor();
  try { el.focus({ preventScroll: true }); } catch (err) {
  if (typeof window !== 'undefined' && window?.location) {
    // petit no-op/log côté client
    console.debug?.('keyboardHold noop', err);
  }
}
  if (releaseId) clearTimeout(releaseId);
  releaseId = setTimeout(dropKeyboard, ms);
}

/** Ferme explicitement le clavier (blur). */
export function dropKeyboard() {
  if (!anchor) return;
  try { anchor.blur(); } catch (err) {
  if (typeof window !== 'undefined' && window?.location) {
    // petit no-op/log côté client
    console.debug?.('keyboardHold noop', err);
  }
}
}