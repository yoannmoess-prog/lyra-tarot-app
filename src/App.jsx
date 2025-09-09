// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LegalFooter from "./components/LegalFooter";

import Intro from "./Intro";
import Page2 from "./Page2";
import Page3 from "./Page3";
import Page4 from "./Page4";

// (optionnel) démo du streaming si tu veux l'activer plus tard :
// import LyraStreamDemo from "./components/LyraStreamDemo";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/name" element={<Page2 />} />
        <Route path="/question" element={<Page3 />} />
        <Route path="/draw" element={<Page4 />} />
        {/* <Route path="/demo/stream" element={<LyraStreamDemo />} /> */}
      </Routes>
      <LegalFooter />
    </BrowserRouter>
  );
}