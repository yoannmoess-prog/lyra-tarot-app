
// src/utils/net.js

/**
 * Affiche une notification "toast" en bas de l'écran.
 * @param {string} message Le message à afficher.
 * @param {number} duration La durée d'affichage en millisecondes.
 */
export function toast(message, duration = 4000) {
  // Crée l'élément de toast
  const toastElement = document.createElement("div");
  toastElement.className = "toast-notification show"; // La classe 'show' déclenche l'animation d'entrée
  toastElement.textContent = message;

  // Ajoute l'élément au corps du document
  document.body.appendChild(toastElement);

  // Supprime le toast après la durée spécifiée
  setTimeout(() => {
    toastElement.classList.remove("show");
    // Attend la fin de l'animation de sortie avant de supprimer l'élément du DOM
    setTimeout(() => {
      document.body.removeChild(toastElement);
    }, 500); // Doit correspondre à la durée de la transition dans toast.css
  }, duration);
}
