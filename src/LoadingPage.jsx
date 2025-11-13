import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './LoadingPage.css';

const LoadingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { name, question } = location.state || { name: 'Utilisateur', question: '' };

  // Durée de chaque étape de l'animation ajustée à 1.5s
  const loadingSteps = [
    { text: 'Réflexion en cours...', duration: 1500 },
    { text: 'Choix du meilleur tirage...', duration: 1500 },
    { text: 'Préparation des cartes...', duration: 1500 },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [error, setError] = useState(null); // State for error message
  const sequenceStarted = React.useRef(false);

  useEffect(() => {
    // --- Diagnostic de l'URL de l'API en production ---
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    if (import.meta.env.PROD && !apiUrl) {
      setError("La configuration du serveur est manquante. L'URL de l'API n'est pas définie.");
      return; // Arrête l'exécution
    }

    if (!question) {
      console.warn("Aucune question trouvée, redirection vers la page de question.");
      navigate('/question');
      return;
    }
    // Si la séquence a déjà commencé, on ne fait rien pour éviter
    // de la relancer à chaque re-render causé par l'animation.
    if (sequenceStarted.current) {
      return;
    }
    sequenceStarted.current = true;

    // Promesse qui gère l'animation des étapes
    const animateSteps = async () => {
      for (let i = 0; i < loadingSteps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, loadingSteps[i].duration));
        setCompletedSteps(prev => [...prev, loadingSteps[i].text]);
      }
    };

    // Promesse qui appelle l'API pour déterminer le tirage, avec une logique de nouvelle tentative.
    const fetchSpreadWithRetry = async (retries = 3, delay = 2500) => {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      console.log(`[DIAGNOSTIC] VITE_API_BASE_URL reçue : "${apiUrl}"`);
      console.log(`[LoadingPage] Début de la tentative de récupération du tirage...`);

      for (let i = 0; i < retries; i++) {
        try {
          // Correction: L'URL doit être /api/spread, le proxy Vite gère le reste.
          const finalUrl = `${apiUrl}/api/spread`.replace(/([^:]\/)\/+/g, "$1");
          console.log(`[LoadingPage] Tentative d'appel API #${i + 1} à ${finalUrl}`);
          const response = await fetch(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
          });

          if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
              console.error(`[LoadingPage] Erreur client (${response.status}), annulation des tentatives.`);
              throw new Error(`Erreur client non récupérable: ${response.statusText}`);
            }
            throw new Error(`La réponse du serveur n'était pas OK: ${response.statusText} (status: ${response.status})`);
          }

          const data = await response.json();
          console.log(`[LoadingPage] Appel API réussi à la tentative #${i + 1}.`);
          return data.spreadId;

        } catch (error) {
          console.error(`[LoadingPage] Tentative #${i + 1} échouée:`, error.message);
          if (i < retries - 1) {
            console.log(`[LoadingPage] Prochaine tentative dans ${delay / 1000} secondes.`);
            await new Promise(res => setTimeout(res, delay));
          } else {
            console.error("Erreur critique : impossible de récupérer le tirage après plusieurs tentatives. Utilisation du tirage par défaut.");
            return 'spread-advice';
          }
        }
      }
    };

    // Exécute l'animation et l'appel API en parallèle
    // et attend que les deux soient terminés
    const runLoadingSequence = async () => {
      console.log("[LoadingPage] Démarrage de la séquence de chargement.");

      const fetchPromise = fetchSpreadWithRetry().then(result => {
        console.log("[LoadingPage] La promesse de fetch s'est résolue.");
        return result;
      });

      const animationPromise = animateSteps().then(() => {
        console.log("[LoadingPage] L'animation est terminée.");
      });

      console.log("[LoadingPage] En attente de la fin de l'API et de l'animation...");
      const [spreadId] = await Promise.all([
        fetchPromise,
        animationPromise
      ]);
      console.log(`[LoadingPage] Séquence terminée. Tirage sélectionné : ${spreadId}. Redirection...`);

      // Redirige vers la page de tirage correspondante APRÈS la fin de l'animation
      navigate(`/spread-${spreadId.replace('spread-', '')}`, { state: { name, question } });
    };

    runLoadingSequence();

  }, [question, name, navigate]);

  return (
    <div className="loading-container">
      {error ? (
        <div className="loading-error">
          <h2>Erreur de Configuration</h2>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="loading-header">
            <p>Très bien, {name}.</p>
            <p>Prépare-toi à tirer les cartes.</p>
          </div>
          <div className="loading-animation">
            <ul>
              {loadingSteps.map((step, index) => (
                <li key={index} className={completedSteps.includes(step.text) ? 'completed' : (index === currentStep ? 'active' : 'pending')}>
                  <span className="checkmark">✓</span>
                  <span className="text">{step.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default LoadingPage;
