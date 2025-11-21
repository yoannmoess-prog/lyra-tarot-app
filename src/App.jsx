// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Intro from "./Intro.jsx";
import Page2 from "./Page2.jsx";

// Ton flow historique
import Page3 from "./Page3.jsx";   // /question
import LoadingPage from "./LoadingPage.jsx"; // /loading
import SpreadAdvicePage from "./SpreadAdvicePage.jsx";
import SpreadTruthPage from "./SpreadTruthPage.jsx";
import ChatAdvicePage from "./ChatAdvicePage.jsx";
import ChatTruthPage from "./ChatTruthPage.jsx";

// Démo spreads en sandbox (optionnelle)
import SpreadsDemo from "./pages/SpreadsDemo.jsx";

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