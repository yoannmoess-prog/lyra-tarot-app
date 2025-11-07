// src/utils/streamLyra.js
import { toast } from "./net";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function* streamLyra(payload) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/lyra/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("[streamLyra] Erreur réseau:", error);
    toast("Erreur réseau. Impossible de contacter le serveur.");
    return; // Termine le générateur
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error(
      `[streamLyra] Erreur de l'API: ${response.status} ${response.statusText}`,
      errorBody
    );
    toast(
      `Une erreur est survenue côté serveur (${response.status}). Veuillez réessayer.`
    );
    return; // Termine le générateur en cas de réponse non-OK
  }

  if (!response.body) {
    console.error("[streamLyra] La réponse ne contient pas de corps de flux.");
    toast("La réponse du serveur est invalide.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop(); // Garde la dernière ligne potentiellement incomplète

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const jsonString = line.substring(6);
            if (jsonString) {
              const chunk = JSON.parse(jsonString);
              yield chunk;
            }
          } catch (e) {
            console.error("[streamLyra] Erreur de parsing du chunk SSE:", e, "Chunk:", line);
          }
        }
      }
    }
  } catch (error) {
    console.error("[streamLyra] Erreur pendant la lecture du flux:", error);
    toast("Une erreur est survenue lors de la réception de la réponse.");
  } finally {
    reader.releaseLock();
  }
}