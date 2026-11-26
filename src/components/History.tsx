import { useEffect, useState } from 'preact/hooks';
import {
  clearSessions,
  deleteSession,
  importSessions,
  listSessions,
  playerStats,
  type SavedSession,
} from '../lib/db';
import { shareResults } from '../lib/share-image';
import { playerColor } from '../lib/colors';

export default function History({ games }: { games: { slug: string; name: string; url: string }[] }) {
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const reload = () => listSessions().then(setSessions, () => setError('Your browser is blocking storage, so history is unavailable.'));
  useEffect(() => {
    reload();
  }, []);

  if (error) return <p class="chunk p-5">{error}</p>;
  if (!sessions) return <p class="text-muted">Loading your games…</p>;
  if (!sessions.length)
    return (
      <div class="chunk p-6">
        <p class="font-semibold">No saved games yet.</p>
        <p class="mt-1 text-muted">
          Finish a game in any calculator and press <strong>Save game</strong>. It is stored on this device only.
        </p>
        <div class="mt-4">
          <ImportButton onDone={reload} />
        </div>
      </div>
    );

  const playedSlugs = [...new Set(sessions.map((s) => s.gameSlug))];
  const shown = filter === 'all' ? sessions : sessions.filter((s) => s.gameSlug === filter);
  const stats = playerStats(shown);
  const urlFor = (slug: string) => games.find((g) => g.slug === slug)?.url;

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `meeplemath-history-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
  };

  return (
    <div class="space-y-8">
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm font-semibold">
          Game
          <select
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            class="rounded-xl border-[2.5px] border-ink bg-surface px-3 py-2 font-semibold"
          >
            <option value="all">All games ({sessions.length})</option>
            {playedSlugs.map((slug) => (
              <option key={slug} value={slug}>
                {sessions.find((s) => s.gameSlug === slug)!.gameName} (
                {sessions.filter((s) => s.gameSlug === slug).length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <section>
        <h2 class="font-display text-2xl font-semibold">Player stats</h2>
        <div class="chunk mt-4 overflow-x-auto">
          <table class="w-full text-left tabular-nums">
            <thead class="bg-soft text-sm">
              <tr>
                {['Player', 'Games', 'Wins', 'Win rate', 'Best', 'Average'].map((h) => (
                  <th key={h} scope="col" class="border-b-2 border-soft px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((p) => (
                <tr key={p.name}>
                  <th scope="row" class="border-b-2 border-soft px-3 py-2 font-semibold">
                    {p.name}
                  </th>
                  <td class="border-b-2 border-soft px-3 py-2">{p.played}</td>
                  <td class="border-b-2 border-soft px-3 py-2">{p.wins}</td>
                  <td class="border-b-2 border-soft px-3 py-2">{Math.round((p.wins / p.played) * 100)}%</td>
                  <td class="border-b-2 border-soft px-3 py-2">{p.best}</td>
                  <td class="border-b-2 border-soft px-3 py-2">{p.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-sm text-muted">Players are matched by name, so use the same spelling each game.</p>
      </section>

      <section>
        <h2 class="font-display text-2xl font-semibold">Games played</h2>
        <ul class="mt-3 space-y-3">
          {shown.map((s) => {
            const ranked = [...s.players].sort((a, b) => a.rank - b.rank);
            const url = urlFor(s.gameSlug);
            return (
              <li key={s.id} class="chunk p-4">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    {url ? (
                      <a href={url} class="font-display text-xl font-semibold hover:text-accent">
                        {s.gameName}
                      </a>
                    ) : (
                      <span class="font-display text-xl font-semibold">{s.gameName}</span>
                    )}
                    <span class="ml-2 text-sm text-muted">
                      {new Date(s.playedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div class="flex gap-3 text-sm">
                    <button type="button" class="font-semibold text-muted hover:text-accent" onClick={() => shareResults(s)}>
                      Share
                    </button>
                    <button
                      type="button"
                      class="font-semibold text-muted hover:text-accent"
                      onClick={async () => {
                        if (!confirm('Delete this game from your history?')) return;
                        await deleteSession(s.id);
                        reload();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <ol class="mt-3 flex flex-wrap gap-2">
                  {ranked.map((p, i) => {
                    const c = playerColor(p.color ?? i);
                    return (
                      <li
                        key={i}
                        class={`flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-sm ${p.rank === 1 ? 'font-bold' : ''}`}
                        style={p.rank === 1 ? { background: 'var(--color-sun)' } : undefined}
                      >
                        <span class="h-3 w-3 rounded-full border-2 border-ink" style={{ background: c.bg }} />
                        {p.name} <span class="font-display font-bold tabular-nums">{p.total}</span>
                        {p.rank === 1 && '👑'}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      </section>

      <section class="chunk p-5">
        <h2 class="font-display text-xl font-semibold">Back up or move your history</h2>
        <p class="mt-1 text-sm text-muted">
          History lives only in this browser. Export a file to keep a backup or to move it to another device.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={exportAll} class="btn bg-surface py-2 text-base">
            Export
          </button>
          <ImportButton onDone={reload} />
          <button
            type="button"
            class="px-3 py-2 font-semibold text-muted hover:text-accent"
            onClick={async () => {
              if (!confirm('Delete every saved game on this device? This cannot be undone.')) return;
              await clearSessions();
              reload();
            }}
          >
            Delete all
          </button>
        </div>
      </section>
    </div>
  );
}

function ImportButton({ onDone }: { onDone: () => void }) {
  return (
    <label class="btn cursor-pointer bg-surface py-2 text-base">
      Import
      <input
        type="file"
        accept="application/json,.json"
        class="sr-only"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            const valid = Array.isArray(data) && data.every((s) => s && typeof s.id === 'string' && Array.isArray(s.players));
            if (!valid) throw new Error();
            await importSessions(data);
            onDone();
          } catch {
            alert('That file is not a MeepleMath history export.');
          }
        }}
      />
    </label>
  );
}
