// src/lib/draw.ts
export type Suit = "coupes" | "épées" | "bâtons" | "deniers";

export type RankNumeric = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type RankCourt = "Valet" | "Reyne" | "Roy" | "Cavalier";
export type RankLabel = "As" | RankCourt | RankNumeric;

export type Card = {
  id: string;                    // ex: "maj_00", "deniers_04", "coupes_valet"
  kind: "major" | "minor";
  number?: number;               // 0..21 (majors)
  suit?: Suit;
  rank?: RankLabel;
  label?: string;
  imageUrl?: string;             // ajouté pour l'UI
};
export type Deck = Card[];

function normalizeCourt(rank?: string) {
  if (!rank) return rank;
  if (rank === "Reine") return "Reyne";
  if (rank === "Roi")   return "Roy";
  return rank;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// positionCfg = spreads.yaml > spreads.<id>.positions[i]
export function eligibleCardsForPosition(deck: Deck, positionCfg: any): Card[] {
  const { draw } = positionCfg;
  const pool = draw?.pool; // "majors" | "minors"
  const allow = draw?.allow ?? {};

  const majors = deck.filter(c => c.kind === "major");
  const minors = deck.filter(c => c.kind === "minor");

  if (pool === "majors") {
    let out = majors;
    if (allow.numeric_range) {
      const [min, max] = allow.numeric_range as [number, number];
      out = out.filter(c => typeof c.number === "number" && c.number >= min && c.number <= max);
    }
    return out;
  }

  if (pool === "minors") {
    let out = minors;

    const ranksNumeric = allow.ranks_numeric as number[] | undefined;
    const ranksLabels  = allow.ranks_labels  as string[] | undefined;
    const courts       = (allow.courts as string[] | undefined)?.map(normalizeCourt);

    // Valeurs (As–10)
    if (ranksNumeric || ranksLabels) {
      out = out.filter(c => {
        if (typeof c.rank === "number") return ranksNumeric?.includes(c.rank) ?? false;
        if (typeof c.rank === "string") return ranksLabels?.includes(c.rank) ?? false;
        return false;
      });
    }

    // Figures (Valet/Reyne/Roy/Cavalier)
    if (courts) {
      out = out.filter(c => typeof c.rank === "string" && courts.includes(normalizeCourt(c.rank)));
    }

    return out;
  }

  return deck; // fallback
}

export function drawSpread(deck: Deck, spreadCfg: any) {
  const positions = spreadCfg.positions as any[];
  const result: Record<string, Card> = {};
  const used = new Set<string>();

  for (const pos of positions) {
    const pool = eligibleCardsForPosition(deck, pos).filter(c => !used.has(c.id));
    if (pool.length === 0) throw new Error(`Aucune carte éligible pour ${pos.key}`);
    const card = pickRandom(pool);
    result[pos.key] = card;
    used.add(card.id);
  }
  return result;
}