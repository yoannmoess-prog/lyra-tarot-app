/**
*
* scripts/normalize-minors.js
* Normalise le front-matter YAML des arcanes mineurs :
* - subcategory: "deniers" | "coupes" | "epees" | "batons"
* - tags: ["marseille", "element:<terre|eau|air|feu>", "serie:<...>"]
*
* Usage:
*
* node scripts/normalize-minors.js [--root ./cards] [--dry-run]
* Dépendances:
* npm i gray-matter js-yaml glob
*/
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { glob } from "glob";
const args = process.argv.slice(2);
const getArg = (flag, def=null) => {
const i = args.indexOf(flag);
return i >= 0 ? args[i+1] || true : def;
};
const ROOT = getArg("--root", "./cards");
const DRY = args.includes("--dry-run");
const EXTS = [".md", ".mdx"];
// ---------- Helpers
const norm = (s) =>
(s || "")
.toString()
.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
.toLowerCase();
function matchSerie(str) {
if (/\bdenier(s)?\b/.test(str)) return "deniers";
if (/\bcoupe(s)?\b/.test(str)) return "coupes";
if (/\bepee(s)?\b/.test(str) || /\bep[ée]e(s)?\b/.test(str)) return "epees";
if (/\bbaton(s)?\b/.test(str) || /\bbat[ôo]n(s)?\b/.test(str)) return "batons";
return null;
}
function detectSerie({ title, filePath, fmSubcat, fmTags }) {
const subs = [fmSubcat, ...(Array.isArray(fmTags) ? fmTags : [])]
.filter(Boolean)
.map(String)
.map(norm)
.join(" ");
const fromFM = matchSerie(subs);
if (fromFM) return fromFM;
const base = norm(title) + " " + norm(path.basename(filePath, path.extname(filePath)));
const fromName = matchSerie(base);
if (fromName) return fromName;
const dir = norm(path.dirname(filePath));
const fromDir = matchSerie(dir);
if (fromDir) return fromDir;
return null;
}
function elementForSerie(serie) {
switch (serie) {
case "deniers": return "terre";
case "coupes": return "eau";
case "epees": return "air";
case "batons": return "feu";
default: return null;
}
}
function upsertTags(existingTags, toAdd) {
const set = new Set((existingTags || []).map(String));
for (const t of toAdd) set.add(String(t));
return Array.from(set);
}
function isMinorArcana(fm) {
return norm(fm?.category) === "arcane mineur";
}
// ---------- Main
(async () => {
const filePattern = getArg("--pattern", "**/*");
const patterns = EXTS.map(ext => path.join(ROOT, `${filePattern}${ext}`));
const files = (await Promise.all(patterns.map(p => glob(p)))).flat();
let changed = 0, skipped = 0, missingSerie = 0;
for (const file of files) {
const raw = await fs.readFile(file, "utf8");
const fm = matter(raw);
if (!isMinorArcana(fm.data)) {
skipped++;
continue;
}
const serie = detectSerie({
title: fm.data?.title,
filePath: file,
fmSubcat: fm.data?.subcategory,
fmTags: fm.data?.tags
});
if (!serie) {
missingSerie++;
console.warn(`■■ Série introuvable → ${file}`);
continue;
}
const element = elementForSerie(serie);
fm.data.subcategory = serie;
const canonical = [
"marseille",
`element:${element}`,
`serie:${serie}`
];
fm.data.tags = upsertTags(Array.isArray(fm.data.tags) ? fm.data.tags : [], canonical);
const newContent = matter.stringify(fm.content, fm.data);
if (newContent !== raw) {
changed++;
if (DRY) {
console.log(`[dry-run] ${path.relative(process.cwd(), file)} → subcategory=${serie}`);
} else {
const bak = file + ".bak";
await fs.writeFile(bak, raw, "utf8");
await fs.writeFile(file, newContent, "utf8");
console.log(`■ MAJ: ${path.relative(process.cwd(), file)} (backup: ${path.basename(bak)})`);
}
}
}
console.log("\n— Résumé —");
console.log(`Modifiés : ${changed}`);
console.log(`Série introuvable: ${missingSerie}`);
if (DRY) console.log("Mode dry-run (aucune écriture).");
})();
