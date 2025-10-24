// src/utils/streamLyra.js
export async function* streamLyra(payload, onError) {
  // Correction : Utilise import.meta.env pour les variables d'environnement Vite.
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  try {
    const res = await fetch(`${API_BASE_URL}/api/lyra/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const errorPayload = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }));
      onError?.(new Error(errorPayload.message));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Traiter les messages complets dans le buffer
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const message = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 2);

        if (message.startsWith("data: ")) {
          const data = message.substring(6);
          try {
            // Le backend envoie directement la chaîne de caractères JSON-stringifiée
            const content = JSON.parse(data);
            if (typeof content === 'string') {
              yield content;
            }
          } catch (e) {
            console.warn("Erreur de parsing JSON dans le stream:", data, e);
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (e) {
    console.error("Erreur inattendue dans streamLyra:", e);
    onError?.(e);
  }
}