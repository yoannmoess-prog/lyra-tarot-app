// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Intro from "./Intro";
import Page2 from "./Page2";

// Ton flow historique
import Page3 from "./Page3";   // /question
import Page4 from "./Page4";   // /draw
import Page5 from "./Page5";   // /chat

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
        <Route path="/draw" element={<Page4 />} />
        <Route path="/chat" element={<Page5 />} />

        {/* Démo isolée */}
        <Route path="/spreads-demo" element={<SpreadsDemo />} />
      </Routes>
    </BrowserRouter>
  );
}