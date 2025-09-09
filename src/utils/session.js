// utils/session.js
export async function getSessionId() {
  const r = await fetch("/session");
  const j = await r.json().catch(() => ({}));
  return j.sessionId || "";
}