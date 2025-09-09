// Exponentiel + jitter
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const backoff = (attempt, base = 300) =>
  Math.round(base * Math.pow(2, attempt - 1) + Math.random() * 120);

// POST JSON avec retries (3) + timeout par tentative
export async function postJson(url, body, { tries = 3, base = 300, timeout = 15000 } = {}) {
  let lastErr;
  for (let a = 1; a <= tries; a++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (r.ok) return r.json();
      // On ne retry que sur 429/5xx
      if (![429, 500, 502, 503, 504].includes(r.status)) {
        throw new Error(`http_${r.status}`);
      }
      lastErr = new Error(`retryable_${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (a < tries) await sleep(backoff(a, base));
  }
  throw lastErr;
}

// Toast minimaliste
export function toast(msg, { type = "error" } = {}) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3000);
}