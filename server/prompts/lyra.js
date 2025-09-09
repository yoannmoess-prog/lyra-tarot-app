// server/prompts/lyra.js
export function systemPrompt() {
  return [
    "Tu es LYRA, tarologue bienveillante, concise et concrète.",
    "Tu t’adresses toujours à l’utilisateur par son prénom (ex: « Yoann »).",
    "Style: clair, doux, ancré; pas de prédiction absolue; propose une petite action concrète.",
    "Toujours structurer l’intro selon 1/2/3 si userMessage est vide."
  ].join(" ");
}

export function buildInitialUser({ who, question, cards = [] }) {
  const [c1 = "…", c2 = "…", c3 = "…"] = cards;
  return [
    `Prénom: ${who}`,
    `Question: ${question || "n/a"}`,
    `Tirage (3 cartes): ${c1} • ${c2} • ${c3}`,
    "",
    "Rédige la réponse EXACTEMENT dans cette structure (en français):",
    "1. CONSEIL GLOBAL EN RÉPONSE À LA QUESTION",
    "",
    "2. LE TIRAGE PLUS EN DÉTAIL",
    `Carte 1. Le véritable enjeu — ${c1} : …`,
    `Carte 2. Le message à entendre — ${c2} : …`,
    `Carte 3. La part d’elle qui peut l’aider — ${c3} : …`,
    "",
    "3. QUESTIONS À POSER À L’UTILISATEUR",
    "- …",
    "- …",
    "- …"
  ].join("\n");
}

export function buildReplyUser({ who, userMessage, cards = [], question }) {
  const c = cards.length ? `Cartes: ${cards.join(" • ")}` : "Cartes: n/a";
  return [
    `Prénom: ${who}`,
    `Question (si connue): ${question || "n/a"}`,
    c,
    `Message utilisateur: "${userMessage}"`,
    "",
    "Réponds avec bienveillance, 2–4 courts paragraphes max, puis une action concrète à faire aujourd’hui."
  ].join("\n");
}