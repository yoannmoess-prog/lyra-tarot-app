// scripts/md2jsonl.mjs
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import removeMd from "remove-markdown";

const ROOT = process.argv[2] || "fiches";
const OUTFILE = process.argv[3] || "build/rag/index.jsonl";
const DRY = process.argv.includes("--dry");

// Config chunking (approx. 120–300 tokens => ~500–1200 chars)
const CHUNK_MIN_CHARS = Number(process.env.CHUNK_MIN_CHARS || 500);
const CHUNK_MAX_CHARS = Number(process.env.CHUNK_MAX_CHARS || 1200);

function slugify(s = "") {
  return String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && /\.md$/i.test(e.name)) out.push(p);
  }
  return out;
}

function splitSections(md) {
  // Découpe par titres ## / ### ; conserve ordre
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = { title: "body", content: [] };

  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(.*)$/);
    if (m) {
      if (current.content.length) sections.push(current);
      current = { title: slugify(m[1]).slice(0, 60) || "section", content: [] };
    } else {
      current.content.push(line);
    }
  }
  if (current.content.length) sections.push(current);
  return sections.map(s => ({ section: s.title, text: s.content.join("\n").trim() }));
}

function chunkByLength(txt) {
  // Merge de paragraphes jusqu’à CHUNK_MAX_CHARS ; redécoupe longueurs par phrases si besoin.
  const paras = txt.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
  const chunks = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const p of paras) {
    if ((buf + "\n\n" + p).length <= CHUNK_MAX_CHARS) {
      buf = buf ? buf + "\n\n" + p : p;
    } else {
      if (buf.length >= CHUNK_MIN_CHARS) {
        flush();
        buf = p;
      } else {
        // Trop long: découpe par phrases
        const sentences = p.split(/(?<=[\.\!\?\…])\s+/).map(s => s.trim()).filter(Boolean);
        for (const s of sentences) {
          if ((buf + " " + s).length <= CHUNK_MAX_CHARS) {
            buf = buf ? buf + " " + s : s;
          } else {
            flush();
            buf = s;
          }
        }
      }
    }
  }
  flush();
  return chunks;
}

function baseIdFromFM(fm, filePath) {
  const t = fm.type || inferType(filePath);
  const key = fm.card_id || fm.id || slugify(fm.title || path.basename(filePath, ".md"));
  return `${t}:${key}`;
}

function inferType(p) {
  if (p.includes("/cartes/") || /carte-/.test(p)) return "carte";
  if (p.includes("/themes/") || /theme-/.test(p)) return "theme";
  if (p.includes("/auteurs/") || /auteur-/.test(p)) return "auteur";
  if (p.includes("/spreads/") || /spread-/.test(p)) return "spread";
  return "note";
}

function ensureArray(a) { return Array.isArray(a) ? a : (a ? [a] : []); }

async function processFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const { data: fm, content } = matter(raw);

  const sections = splitSections(content);
  const baseId = baseIdFromFM(fm, filePath);
  const sourceIds = ensureArray(fm.sources).map((s) => (typeof s === "string" ? s : s?.id)).filter(Boolean);

  const meta = {
    type: fm.type || inferType(filePath),
    card_id: fm.card_id || undefined,
    id: fm.id || undefined,
    title: fm.title || undefined,
    section: undefined, // rempli plus bas
    source_ids: sourceIds.length ? sourceIds : undefined,
    tags: ensureArray(fm.tags).filter(Boolean),
  };

  const out = [];
  for (const sec of sections) {
    const plain = removeMd(sec.text).replace(/\s+\n/g, "\n").trim();
    if (!plain) continue;

    const chunks = chunkByLength(plain);
    chunks.forEach((ck, i) => {
      const obj = {
        id: `${baseId}:${sec.section}:${i + 1}`,
        text: ck,
        meta: { ...meta, section: sec.section }
      };
      out.push(obj);
    });
  }
  return out;
}

async function main() {
  const files = await walk(ROOT);
  if (!DRY) {
    await fs.mkdir(path.dirname(OUTFILE), { recursive: true });
    await fs.writeFile(OUTFILE, "", "utf8"); // reset
  }
  let count = 0;

  for (const f of files) {
    const rows = await processFile(f);
    if (!DRY) {
      const lines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
      await fs.appendFile(OUTFILE, lines, "utf8");
    }
    count += rows.length;
    console.log(`• ${path.relative(process.cwd(), f)} → ${rows.length} chunks`);
  }

  console.log(DRY ? `(dry) total chunks: ${count}` : `OK → ${OUTFILE} (${count} chunks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});