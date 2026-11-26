import { z } from 'astro/zod';

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  help: z.string().optional(),
};

/** Player types a number. points = floor(value / divisor) * multiplier */
const numberCategory = z.object({
  ...base,
  type: z.literal('number'),
  multiplier: z.number().default(1),
  divisor: z.number().int().positive().optional(),
  allowNegative: z.boolean().default(false),
  unit: z.string().optional(),
});

/** A yes/no bonus worth fixed points. exclusive = only one player can hold it. */
const bonusCategory = z.object({
  ...base,
  type: z.literal('bonus'),
  points: z.number(),
  exclusive: z.boolean().default(false),
});

/** Player enters how many of each item they have; each item has a fixed value. */
const countsCategory = z.object({
  ...base,
  type: z.literal('counts'),
  items: z.array(z.object({ label: z.string(), points: z.number() })).min(1),
});

/** Set collection: each symbol scores count², plus a bonus per complete set. */
const setsCategory = z.object({
  ...base,
  type: z.literal('sets'),
  symbols: z.array(z.string()).min(2),
  perSetBonus: z.number(),
});

/** Lookup table: points for the highest step whose `min` is ≤ the count (e.g. Agricola's farm table). */
const tableCategory = z.object({
  ...base,
  type: z.literal('table'),
  unit: z.string().optional(),
  steps: z.array(z.object({ min: z.number().int(), points: z.number() })).min(2),
});

/**
 * One input picks a tier (e.g. Scythe popularity), which sets the value of every other field.
 * points = Σ floor(count / per) × field.points[tier]
 */
const tieredCategory = z.object({
  ...base,
  type: z.literal('tiered'),
  tierLabel: z.string(),
  tiers: z.array(z.object({ min: z.number().int(), max: z.number().int(), label: z.string() })).min(2),
  fields: z
    .array(z.object({ label: z.string(), points: z.array(z.number()), per: z.number().int().positive().default(1) }))
    .min(1),
});

export const categorySchema = z.discriminatedUnion('type', [
  numberCategory,
  bonusCategory,
  countsCategory,
  setsCategory,
  tableCategory,
  tieredCategory,
]);

export const gameSchema = z.object({
  name: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string().max(170),
  players: z.object({ min: z.number().int().min(1), max: z.number().int().max(12) }),
  intro: z.string(),
  categories: z.array(categorySchema).min(1),
  expansions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        categories: z.array(categorySchema).default([]),
        /** category ids this expansion takes out of the game */
        removes: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  tiebreaker: z.string(),
  rules: z.array(z.object({ heading: z.string(), body: z.array(z.string()).min(1) })),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
});

export type Category = z.infer<typeof categorySchema>;
export type GameData = z.infer<typeof gameSchema>;
/** What the calculator island receives: game data plus its slug. */
export type Game = GameData & { slug: string };
