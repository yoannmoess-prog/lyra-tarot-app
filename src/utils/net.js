// src/utils/net.js

/** Affiche un toast simple en haut de l'écran */
export function toast(msg, dur = 3500) {
  try {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 50);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 500);
    }, dur);
  } catch {
    // ignore
  }
}

/** POST JSON avec retries et timeout */
export async function postJson(url, body, opts = {}) {
  const { tries = 1, base = 200, signal, timeout = 8000 } = opts;
  for (let i = 0; i < tries; i++) {
    try {
      const ac = new AbortController();
      const id = setTimeout(() => ac.abort(), timeout);
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: signal || ac.signal,
      });
      clearTimeout(id);
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        throw new Error(`http_${r.status}` + (errText ? `_${errText}` : ""));
      }
      return await r.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((res) => setTimeout(res, base * (i + 1)));
    }
  }
}