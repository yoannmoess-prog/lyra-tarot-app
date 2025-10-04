// src/lib/deck.ts
import type { Card, Deck, Suit } from "@/lib/draw";

const SUIT_MAP: Record<string, Suit> = {
  B: "bâtons",
  C: "coupes",
  D: "deniers",
  E: "épées",
};

function labelFromFilename(raw: string) {
  return raw.replace(/_/g, " ").replace(/\.[^.]+$/, "");
}

export function buildDeckFromAssets(): Deck {
  // Vite charge toutes les images présentes dans /src/assets/cards
  const images = import.meta.glob("/src/assets/cards/*.jpg", {
    eager: true,
    import: "default",
  }) as Record<string, string>;

  const deck: Deck = [];

  for (const [path, url] of Object.entries(images)) {
    const file = path.split("/").pop()!;

    // --- MAJEURS : "00_LeMat.jpg" .. "21_LeMonde.jpg"
    let m = file.match(/^(\d{2})_([^\.]+)\.jpg$/i);
    if (m) {
      const num = parseInt(m[1], 10); // 00..21
      deck.push({
        id: `maj_${m[1]}`,
        kind: "major",
        number: num,
        label: labelFromFilename(m[2]),
        imageUrl: url,
      });
      continue;
    }

    // --- MINEURS : "B01_Asdebaton.jpg" ... "E14_Cavalierdepees.jpg"
    m = file.match(/^([BCDE])(\d{2})_([^\.]+)\.jpg$/i);
    if (m) {
      const suit = SUIT_MAP[m[1].toUpperCase()];
      const n = parseInt(m[2], 10);
      let rank: Card["rank"];

      if (n === 1) rank = "As";
      else if (n >= 2 && n <= 10) rank = n as Card["rank"];
      else if (n === 11) rank = "Valet";
      else if (n === 12) rank = "Reyne"; // normalise "Reine" → "Reyne"
      else if (n === 13) rank = "Roy";   // normalise "Roi"   → "Roy"
      else if (n === 14) rank = "Cavalier";
      else continue;

      deck.push({
        id: `${suit}_${String(n).padStart(2, "0")}`,
        kind: "minor",
        suit,
        rank,
        label: labelFromFilename(m[3]),
        imageUrl: url,
      });
      continue;
    }
  }

  return deck;
}