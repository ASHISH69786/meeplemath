import { getCollection } from 'astro:content';
import type { Game } from './game-schema';

export const gameUrl = (slug: string) => `/${slug}-score-calculator/`;

export async function getGames(): Promise<Game[]> {
  const entries = await getCollection('games');
  return entries
    .map((e) => ({ ...e.data, slug: e.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Short text tile for a game card, e.g. "7 Wonders" → "7W", "Ticket to Ride" → "TtR". No logos or art. */
export function gameInitials(name: string) {
  const small = new Set(['to', 'of', 'the', 'and', 'a']);
  return name
    .split(/\s+/)
    .map((w) => (small.has(w.toLowerCase()) ? w[0].toLowerCase() : w[0].toUpperCase()))
    .join('')
    .slice(0, 3);
}
