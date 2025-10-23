// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Intro from "./Intro";
import Page2 from "./Page2";

// Ton flow historique
import Page3 from "./Page3";   // /question
import LoadingPage from "./LoadingPage"; // /loading
import SpreadAdvicePage from "./SpreadAdvicePage";
import SpreadTruthPage from "./SpreadTruthPage";
import ChatAdvicePage from "./ChatAdvicePage";
import ChatTruthPage from "./ChatTruthPage";

// Démo spreads en sandbox (optionnelle)
import SpreadsDemo from "./pages/SpreadsDemo";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/name" element={<Page2 />} />

        {/* Flow prod */}
        <Route path="/question" element={<Page3 />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/spread-advice" element={<SpreadAdvicePage />} />
        <Route path="/spread-truth" element={<SpreadTruthPage />} />
        <Route path="/chat-advice" element={<ChatAdvicePage />} />
        <Route path="/chat-truth" element={<ChatTruthPage />} />

        {/* Démo isolée */}
        <Route path="/spreads-demo" element={<SpreadsDemo />} />
      </Routes>
    </BrowserRouter>
  );
}