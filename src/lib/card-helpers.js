// src/lib/card-helpers.js
const FACE_MODULES = import.meta.glob("../../assets/cards/*.webp", { eager: true });
const asUrl = (m) => (typeof m === "string" ? m : m?.default ?? null);

export function idFromFileName(fileName) {
  if (!fileName) return null;
  const match = fileName.match(/^([^_]+)/);
  return match ? match[1] : null;
}

function buildFacePools() {
  const all = Object.keys(FACE_MODULES)
    .map((p) => {
      const src = asUrl(FACE_MODULES[p]);
      const fileName = p.split("/").pop() || "";
      const id = idFromFileName(fileName);
      if (!src || !id) return null;
      // Note: Le `name` est maintenant le nom lisible par l'humain, pas le nom de fichier
      return { path: p, fileName, src, id, name: labelFrom(fileName) };
    })
    .filter(Boolean);
  return {
    all,
    majors: all.filter((f) => /^(0\d|1\d|2[0-1])_/.test(f.fileName)),
    minorsValues: all.filter((f) => /^[DEBC](0[1-9]|10)_/.test(f.fileName)),
    minorsCourt: all.filter((f) => /^[DEBC]1[1-4]_/.test(f.fileName)),
  };
}
export const FACE_POOLS = buildFacePools();

export const MAJOR_LABELS = {
  "00": "Le Mat", "01": "Le Bateleur", "02": "La Papesse", "03": "L’Impératrice", "04": "L’Empereur",
  "05": "Le Pape", "06": "L’Amoureux", "07": "Le Chariot", "08": "La Justice", "09": "L’Hermite",
  "10": "La Roue de Fortune", "11": "La Force", "12": "Le Pendu", "13": "L’Arcane Sans Nom",
  "14": "Tempérance", "15": "Le Diable", "16": "La Maison Dieu", "17": "L’Étoile", "18": "La Lune",
  "19": "Le Soleil", "20": "Le Jugement", "21": "Le Monde",
};
export function labelFrom(fileName) {
  if (!fileName) return "";
  const maj = fileName.match(/^([0-2]\d)_/);
  if (maj) return MAJOR_LABELS[maj[1]] || fileName;
  const m = fileName.match(/^([DEBC])(0[1-9]|1[0-4])_/);
  if (!m) return fileName;
  const suit = { D: "Deniers", E: "Épées", B: "Bâtons", C: "Coupes" }[m[1]];
  const num = parseInt(m[2], 10);
  const prep = suit.startsWith("É") ? "d’" : "de ";
  if (num <= 10) return `${num === 1 ? "As" : num} ${prep}${suit}`;
  return `${{ 11: "Valet", 12: "Reine", 13: "Roi", 14: "Cavalier" }[num]} ${prep}${suit}`;
}
export const pick = (arr) => (arr?.length ? arr[Math.floor(Math.random() * arr.length)] : null);
