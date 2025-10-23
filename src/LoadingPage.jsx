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

  useEffect(() => {
    if (!question) {
      console.warn("Aucune question trouvée, redirection vers la page de question.");
      navigate('/question');
      return;
    }

    // Promesse qui gère l'animation des étapes
    const animateSteps = async () => {
      for (let i = 0; i < loadingSteps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, loadingSteps[i].duration));
        setCompletedSteps(prev => [...prev, loadingSteps[i].text]);
      }
    };

    // Promesse qui appelle l'API pour déterminer le tirage
    const fetchSpread = async () => {
      try {
        const response = await fetch('/api/spread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        if (!response.ok) {
          throw new Error('La réponse du serveur n\'était pas OK');
        }
        const data = await response.json();
        return data.spreadId; // Retourne l'ID du tirage
      } catch (error) {
        console.error("Erreur lors de la récupération du tirage :", error);
        return 'spread-advice'; // Retourne le tirage par défaut en cas d'erreur
      }
    };

    // Exécute l'animation et l'appel API en parallèle
    // et attend que les deux soient terminés
    const runLoadingSequence = async () => {
      const [spreadId] = await Promise.all([
        fetchSpread(),
        animateSteps()
      ]);

      console.log(`Animation terminée. Tirage sélectionné : ${spreadId}. Redirection...`);

      // Redirige vers la page de tirage correspondante APRÈS la fin de l'animation
      navigate(`/spread-${spreadId.replace('spread-', '')}`, { state: { name, question } });
    };

    runLoadingSequence();

  }, [question, name, navigate]);

  return (
    <div className="loading-container">
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
    </div>
  );
};

export default LoadingPage;
