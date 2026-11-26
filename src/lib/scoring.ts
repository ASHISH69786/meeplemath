import type { Category, Game } from './game-schema';

/** Every category stores its inputs as a number array (one entry per field). */
export type Values = Record<string, number[]>;

export function fieldCount(cat: Category): number {
  if (cat.type === 'counts') return cat.items.length;
  if (cat.type === 'sets') return cat.symbols.length;
  if (cat.type === 'tiered') return cat.fields.length + 1;
  return 1;
}

export function scoreCategory(cat: Category, vals: number[] | undefined): number {
  const v = (i: number) => (vals && Number.isFinite(vals[i]) ? vals[i] : 0);
  switch (cat.type) {
    case 'number': {
      const raw = v(0);
      const n = cat.divisor ? Math.floor(raw / cat.divisor) : raw;
      return n * cat.multiplier;
    }
    case 'bonus':
      return v(0) ? cat.points : 0;
    case 'counts':
      return cat.items.reduce((sum, item, i) => sum + v(i) * item.points, 0);
    case 'sets': {
      const counts = cat.symbols.map((_, i) => Math.max(0, v(i)));
      const squares = counts.reduce((s, c) => s + c * c, 0);
      return squares + Math.min(...counts) * cat.perSetBonus;
    }
    case 'table': {
      const n = v(0);
      let pts = cat.steps[0].points;
      for (const s of cat.steps) if (n >= s.min) pts = s.points;
      return pts;
    }
    case 'tiered': {
      const t = tierIndex(cat, v(0));
      return cat.fields.reduce((sum, f, i) => sum + Math.floor(Math.max(0, v(i + 1)) / f.per) * (f.points[t] ?? 0), 0);
    }
  }
}

/** Categories in play for the chosen expansions, in score-pad order. */
export function activeCategories(game: Game, expansionIds: string[]): Category[] {
  const active = game.expansions.filter((e) => expansionIds.includes(e.id));
  const removed = new Set(active.flatMap((e) => e.removes));
  return [...game.categories, ...active.flatMap((e) => e.categories)].filter(
    (c) => !removed.has(c.id),
  );
}

export function total(cats: Category[], values: Values): number {
  return cats.reduce((sum, c) => sum + scoreCategory(c, values[c.id]), 0);
}

/** [{index, total, rank}] sorted best first. Tied totals share a rank (1, 1, 3). */
export function rank(totals: number[]) {
  const sorted = totals.map((t, index) => ({ index, total: t })).sort((a, b) => b.total - a.total);
  return sorted.map((row) => ({ ...row, rank: sorted.findIndex((r) => r.total === row.total) + 1 }));
}

export function tierIndex(cat: Extract<Category, { type: 'tiered' }>, value: number): number {
  const i = cat.tiers.findIndex((t) => value >= t.min && value <= t.max);
  if (i !== -1) return i;
  return value > cat.tiers[cat.tiers.length - 1].max ? cat.tiers.length - 1 : 0;
}
