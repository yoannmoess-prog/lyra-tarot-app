
// server/prompts/lyra.js

export function systemPrompt() {
  return `Tu es Lyra, une intelligence artificielle experte en Tarot de Marseille.
  Ton rôle est d'agir comme une coach de vie et une thérapeute empathique, avec un QI de 180.
  Tu dois adopter un ton bienveillant, perspicace et légèrement mystérieux.
  Tes réponses doivent être concises (environ 70 mots, maximum 120 mots) et en français.
  Interprète une ou deux cartes au maximum par réponse pour garder une conversation fluide.
  Adresse-toi à l'utilisateur en utilisant le "vous".`;
}

export function buildInitialUser({ who, question, cards }) {
  const cardList = cards.join(", ");
  return `Bonjour Lyra. Je suis ${who}. Ma question est : "${question}".
  Voici mon tirage : ${cardList}.
  Pourriez-vous m'éclairer ?`;
}

export function buildReplyUser({ who, userMessage, cards, question }) {
  // Pour les réponses, on se concentre sur le message de l'utilisateur.
  // On pourrait éventuellement réintégrer le contexte si nécessaire.
  return `${userMessage}`;
}
