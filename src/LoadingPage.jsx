import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './LoadingPage.css';

const LoadingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { name, question } = location.state || { name: 'Utilisateur', question: '' };

  const loadingSteps = [
    { text: 'Réflexion en cours...', duration: 1500 },
    { text: 'Choix du meilleur tirage...', duration: 2000 },
    { text: 'Préparation des cartes...', duration: 1000 },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    if (!question) {
      // Si aucune question n'est fournie, on redirige vers la page de la question
      console.warn("Aucune question trouvée, redirection vers la page de question.");
      navigate('/question');
      return;
    }

    // Démarre l'animation des étapes
    const animateSteps = async () => {
      for (let i = 0; i < loadingSteps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, loadingSteps[i].duration));
        setCompletedSteps(prev => [...prev, loadingSteps[i].text]);
      }
    };

    // Appelle l'API pour déterminer le tirage
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
        const spreadId = data.spreadId;

        console.log(`Tirage sélectionné : ${spreadId}. Redirection...`);

        // Redirige vers la page de tirage correspondante
        // ex: /spread-advice ou /spread-truth
        navigate(`/spread-${spreadId.replace('spread-', '')}`, { state: { name, question } });

      } catch (error) {
        console.error("Erreur lors de la récupération du tirage :", error);
        // En cas d'erreur, on redirige vers le tirage par défaut
        navigate('/spread-advice', { state: { name, question } });
      }
    };

    animateSteps();
    fetchSpread();

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
