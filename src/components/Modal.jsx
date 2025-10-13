import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import './Modal.css';

const Modal = ({ children, onClose }) => {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  const handleOverlayClick = (e) => {
    // Ferme si on clique directement sur l'overlay, pas sur le contenu
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <button className="modal-close-btn" onClick={onClose} aria-label="Fermer la vue">
        <span className="ms-icon material-symbols-outlined">close</span>
      </button>
      <div className="modal-content">
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;