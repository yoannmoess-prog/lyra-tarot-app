// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { KeyboardViewportFix } from "./utils/keyboardViewport";
import './styles/Animations.css';

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Gère --kb et .kb-open pour le clavier mobile (iOS/Android) */}
    <KeyboardViewportFix />
    <App />
  </React.StrictMode>
);