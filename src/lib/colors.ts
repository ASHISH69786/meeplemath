/** Player colours: bright "meeple" colours. `ink` is the text colour that reads on top of each. */
export const PLAYER_COLORS = [
  { name: 'red', bg: '#ef4444', ink: '#ffffff' },
  { name: 'blue', bg: '#3b82f6', ink: '#ffffff' },
  { name: 'green', bg: '#22c55e', ink: '#14532d' },
  { name: 'yellow', bg: '#facc15', ink: '#422006' },
  { name: 'purple', bg: '#a855f7', ink: '#ffffff' },
  { name: 'orange', bg: '#fb923c', ink: '#431407' },
  { name: 'teal', bg: '#14b8a6', ink: '#ffffff' },
  { name: 'pink', bg: '#ec4899', ink: '#ffffff' },
] as const;

export const playerColor = (i: number) => PLAYER_COLORS[((i % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];

/** Colours for game tiles on the home page, picked by position. */
export const TILE_COLORS = ['#ff6b4a', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#14b8a6', '#ec4899', '#fb923c'];
