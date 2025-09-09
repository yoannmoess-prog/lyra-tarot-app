// src/utils/streamLyra.js
export async function streamLyra(payload, onText, onDone, onError) {
  const res = await fetch("/api/lyra/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    onError?.(new Error("HTTP " + res.status));
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  const pushLines = (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trimEnd();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[OPEN]") continue;
      if (data === "[DONE]") { onDone?.(); return "done"; }
      // chaque 'data: ...' contient une portion de texte prêt à afficher
      onText?.(data);
    }
    return null;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { onDone?.(); break; }
      const chunk = dec.decode(value, { stream: true });
      const end = pushLines(chunk);
      if (end === "done") break;
    }
  } catch (e) {
    onError?.(e);
  }
}