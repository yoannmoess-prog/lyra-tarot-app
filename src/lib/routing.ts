// src/lib/routing.ts
type SpreadsCfg = any;

const strip = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function countMatches(text: string, terms: string[] | undefined) {
  const t = strip(text);
  let n = 0;
  for (const term of terms ?? []) {
    const pat = new RegExp(`\\b${esc(strip(term))}\\b`, "i");
    if (pat.test(t)) n += 1;
  }
  return n;
}

export function chooseSpreadIdFromConfig(question: string, cfg: SpreadsCfg): string {
  const routing: any = cfg?.routing ?? {};
  const spreadsMap: Record<string, any> = routing.spreads ?? {};
  const weights: any = routing.heuristics?.weights ?? {};
  const lex: any = routing.heuristics?.lexicon ?? {};
  const horizon: any = routing.heuristics?.horizon ?? {};

  const conseil = (spreadsMap.conseil?.id as string) || "conseil3";
  const heros   = (spreadsMap.heros?.id as string)   || "heros3";

  // Find default spread safely (avoid 'unknown' in TS)
  const spreadsArr = Object.values(spreadsMap) as any[];
  const defEntry = spreadsArr.find((s) => s && s.default);
  const defaultId: string = (defEntry?.id as string) || "conseil3";

  const q = String(question || "");

  // lexical scores
  const sc_words =
    (countMatches(q, lex.conseil) || 0) * (weights.conseil_word ?? 2);
  const sh_words =
    (countMatches(q, lex.heros) || 0) * (weights.heros_word ?? 2);

  // horizon (short → conseil, long → heros)
  const sc_hor =
    (countMatches(q, horizon.short_terms) || 0) * (weights.short_horizon_conseil ?? 1);
  const sh_hor =
    (countMatches(q, horizon.long_terms) || 0) * (weights.long_horizon_heros ?? 1);

  const score_conseil = sc_words + sc_hor;
  const score_heros   = sh_words + sh_hor;

  const delta = (weights.delta_threshold ?? routing.decision?.delta_threshold ?? 2);

  // explicit rule
  const explicit_heros = countMatches(q, lex.heros) > 0;

  if (explicit_heros) return heros;
  if (score_heros - score_conseil >= delta) return heros;
  if (score_conseil - score_heros >= delta) return conseil;

  return defaultId;
}