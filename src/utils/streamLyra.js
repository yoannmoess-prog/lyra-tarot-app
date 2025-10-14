// src/utils/streamLyra.js
export async function* streamLyra(payload, onError) {
  try {
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

    const processLine = (line) => {
      if (!line.startsWith("data:")) return { done: false };
      const data = line.slice(5).trim();
      if (data === "[OPEN]") return { done: false };
      if (data === "[DONE]") return { done: true };
      try {
        const parsed = JSON.parse(data);
        if (parsed.ok === false) {
          onError?.(new Error(parsed.error?.message || "Erreur inconnue du stream"));
          return { done: true };
        }
        if (parsed.content) {
          return { done: false, value: parsed.content };
        }
      } catch (e) {
        console.warn("Erreur de parsing JSON dans le stream:", data);
      }
      return { done: false };
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trimEnd();
        buf = buf.slice(idx + 1);
        const result = processLine(line);
        if (result.done) return;
        if (result.value) yield result.value;
      }
    }
  } catch (e) {
    onError?.(e);
  }
}