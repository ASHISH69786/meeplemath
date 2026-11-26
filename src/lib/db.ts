import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface SavedPlayer {
  name: string;
  /** index into PLAYER_COLORS */
  color?: number;
  total: number;
  rank: number;
  /** category label -> points, kept so old games still read correctly if the JSON changes */
  breakdown: Record<string, number>;
}

export interface SavedSession {
  id: string;
  gameSlug: string;
  gameName: string;
  playedAt: number;
  expansions: string[];
  players: SavedPlayer[];
}

interface MeepleDB extends DBSchema {
  sessions: { key: string; value: SavedSession; indexes: { 'by-game': string; 'by-date': number } };
}

let dbPromise: Promise<IDBPDatabase<MeepleDB>> | undefined;

function db() {
  dbPromise ??= openDB<MeepleDB>('meeplemath', 1, {
    upgrade(d) {
      const store = d.createObjectStore('sessions', { keyPath: 'id' });
      store.createIndex('by-game', 'gameSlug');
      store.createIndex('by-date', 'playedAt');
    },
  });
  return dbPromise;
}

export async function saveSession(s: SavedSession) {
  await (await db()).put('sessions', s);
}

export async function listSessions(): Promise<SavedSession[]> {
  const all = await (await db()).getAllFromIndex('sessions', 'by-date');
  return all.reverse();
}

export async function deleteSession(id: string) {
  await (await db()).delete('sessions', id);
}

export async function clearSessions() {
  await (await db()).clear('sessions');
}

export async function importSessions(list: SavedSession[]) {
  const tx = (await db()).transaction('sessions', 'readwrite');
  await Promise.all([...list.map((s) => tx.store.put(s)), tx.done]);
}

/** Player names used before, most recent first, for autocomplete. */
export async function knownPlayerNames(): Promise<string[]> {
  const names = new Set<string>();
  for (const s of await listSessions()) for (const p of s.players) names.add(p.name);
  return [...names];
}

export interface PlayerStats {
  name: string;
  played: number;
  wins: number;
  best: number;
  average: number;
}

export function playerStats(sessions: SavedSession[]): PlayerStats[] {
  const map = new Map<string, { played: number; wins: number; best: number; sum: number }>();
  for (const s of sessions) {
    for (const p of s.players) {
      const key = p.name.trim();
      const row = map.get(key) ?? { played: 0, wins: 0, best: -Infinity, sum: 0 };
      row.played++;
      if (p.rank === 1) row.wins++;
      row.best = Math.max(row.best, p.total);
      row.sum += p.total;
      map.set(key, row);
    }
  }
  return [...map.entries()]
    .map(([name, r]) => ({ name, played: r.played, wins: r.wins, best: r.best, average: r.sum / r.played }))
    .sort((a, b) => b.wins - a.wins || b.wins / b.played - a.wins / a.played);
}
