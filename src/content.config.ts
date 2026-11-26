import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { gameSchema } from './lib/game-schema';

// One JSON file per game in src/content/games/. The filename is the slug.
const games = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/games' }),
  schema: gameSchema,
});

export const collections = { games };
