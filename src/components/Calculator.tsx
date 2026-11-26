import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Category, Game } from '../lib/game-schema';
import { activeCategories, fieldCount, rank, scoreCategory, tierIndex, total, type Values } from '../lib/scoring';
import { knownPlayerNames, saveSession, type SavedSession } from '../lib/db';
import { shareResults } from '../lib/share-image';
import { PLAYER_COLORS, playerColor } from '../lib/colors';

interface Player {
  id: string;
  name: string;
  color: number;
}

interface Draft {
  players: Player[];
  expansions: string[];
  values: Record<string, Values>;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function freshDraft(game: Game): Draft {
  const n = Math.max(game.players.min, Math.min(2, game.players.max));
  return {
    players: Array.from({ length: n }, (_, i) => ({ id: uid(), name: `Player ${i + 1}`, color: i })),
    expansions: [],
    values: {},
  };
}

const firstFreeColor = (players: Player[]) => {
  const used = new Set(players.map((p) => p.color));
  const free = PLAYER_COLORS.findIndex((_, i) => !used.has(i));
  return free === -1 ? players.length : free;
};

export default function Calculator({ game }: { game: Game }) {
  const storageKey = `mm:draft:${game.slug}`;
  const [draft, setDraft] = useState<Draft>(() => freshDraft(game));
  const [activeId, setActiveId] = useState<string>(() => draft.players[0].id);
  const [restored, setRestored] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const panelRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // Restore an in-progress game so a refresh at the table loses nothing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (Array.isArray(d.players) && d.players.length) {
          d.players = d.players.map((p, i) => ({ ...p, color: p.color ?? i }));
          setDraft(d);
          setActiveId(d.players[0].id);
        }
      }
    } catch {
      /* corrupted draft: start fresh */
    }
    setRestored(true);
    knownPlayerNames().then(setNames, () => {});
  }, []);

  useEffect(() => {
    if (restored) localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, restored]);

  const cats = useMemo(() => activeCategories(game, draft.expansions), [game, draft.expansions]);
  const totals = draft.players.map((p) => total(cats, draft.values[p.id] ?? {}));
  const ranking = rank(totals);
  // Something was actually typed (Agricola starts negative, so a non-zero total is not enough).
  const anyScore = Object.values(draft.values).some((pv) => Object.values(pv).some((arr) => arr.some((v) => Number.isFinite(v) && v !== 0)));
  const leaders = ranking.filter((r) => r.rank === 1);
  const isLeader = (i: number) => anyScore && ranking.find((r) => r.index === i)!.rank === 1;

  const activeIndex = Math.max(0, draft.players.findIndex((p) => p.id === activeId));
  const active = draft.players[activeIndex];
  const color = playerColor(active.color);
  const nextPlayer = draft.players[activeIndex + 1];
  const prevPlayer = draft.players[activeIndex - 1];

  const update = (fn: (d: Draft) => Draft) => {
    setStatus('idle');
    setDraft((d) => fn(structuredClone(d)));
  };

  const setValue = (pid: string, cat: Category, field: number, value: number) =>
    update((d) => {
      if (cat.type === 'bonus' && cat.exclusive && value) {
        for (const p of d.players) if (d.values[p.id]?.[cat.id]) d.values[p.id][cat.id] = [0];
      }
      const pv = (d.values[pid] ??= {});
      const arr = (pv[cat.id] ??= Array(fieldCount(cat)).fill(NaN));
      arr[field] = value;
      return d;
    });

  const toggleExpansion = (id: string) =>
    update((d) => {
      d.expansions = d.expansions.includes(id) ? d.expansions.filter((e) => e !== id) : [...d.expansions, id];
      return d;
    });

  const addPlayer = () => {
    const p = { id: uid(), name: `Player ${draft.players.length + 1}`, color: firstFreeColor(draft.players) };
    update((d) => {
      d.players.push(p);
      return d;
    });
    setActiveId(p.id);
  };

  const removePlayer = (id: string) => {
    const name = draft.players.find((p) => p.id === id)?.name;
    if (!confirm(`Remove ${name} and their scores?`)) return;
    const idx = draft.players.findIndex((p) => p.id === id);
    update((d) => {
      d.players = d.players.filter((p) => p.id !== id);
      delete d.values[id];
      return d;
    });
    const remaining = draft.players.filter((p) => p.id !== id);
    setActiveId(remaining[Math.max(0, idx - 1)].id);
  };

  const rename = (id: string, name: string) =>
    update((d) => {
      d.players.find((p) => p.id === id)!.name = name;
      return d;
    });

  const newGame = () => {
    if (anyScore && !confirm('Clear all scores and start a new game? Player names are kept.')) return;
    update((d) => ({ ...d, values: {} }));
    setActiveId(draft.players[0].id);
  };

  const goTo = (id: string) => {
    setActiveId(id);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toSession = (): SavedSession => {
    // Leave out players nobody typed anything for, so spare players don't pollute stats.
    const playing = draft.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => Object.values(draft.values[p.id] ?? {}).some((arr) => arr.some((v) => Number.isFinite(v))));
    const ranks = rank(playing.map(({ i }) => totals[i]));
    return {
      id: uid() + Date.now().toString(36),
      gameSlug: game.slug,
      gameName: game.name,
      playedAt: Date.now(),
      expansions: draft.expansions,
      players: playing.map(({ p, i }, j) => ({
        name: p.name.trim() || `Player ${i + 1}`,
        color: p.color,
        total: totals[i],
        rank: ranks.find((r) => r.index === j)!.rank,
        breakdown: Object.fromEntries(cats.map((c) => [c.label, scoreCategory(c, draft.values[p.id]?.[c.id])])),
      })),
    };
  };

  const save = async () => {
    try {
      await saveSession(toSession());
      setStatus('saved');
      knownPlayerNames().then(setNames, () => {});
    } catch {
      setStatus('error');
    }
  };

  /** Name of the other player currently holding an exclusive bonus, if any. */
  const heldBy = (cat: Category) =>
    draft.players.find((p) => p.id !== active.id && draft.values[p.id]?.[cat.id]?.[0])?.name;

  return (
    <div class="mx-auto max-w-3xl space-y-6">
      {game.expansions.length > 0 && (
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-1 font-display text-lg font-semibold">Expansions:</span>
          {game.expansions.map((e) => {
            const on = draft.expansions.includes(e.id);
            return (
              <label
                key={e.id}
                title={e.description}
                class="pill cursor-pointer select-none py-1.5 transition hover:-translate-y-0.5"
                style={on ? { background: 'var(--color-sun)' } : undefined}
              >
                <input type="checkbox" class="sr-only" checked={on} onChange={() => toggleExpansion(e.id)} />
                <span aria-hidden="true">{on ? '✓' : '+'}</span>
                {e.name}
              </label>
            );
          })}
        </div>
      )}

      {/* Scoreboard: each chip is also the tab for that player */}
      <div class="sticky top-0 z-20 -mx-4 border-b-2 border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur">
        <div role="tablist" aria-label="Players" class="flex gap-2 overflow-x-auto px-0.5 pt-0.5 pb-1.5">
          {draft.players.map((p, i) => {
            const c = playerColor(p.color);
            const selected = p.id === active.id;
            return (
              <button
                key={p.id}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls="mm-player-panel"
                onClick={() => setActiveId(p.id)}
                class={`flex shrink-0 items-center gap-2 rounded-2xl border-[2.5px] border-ink px-3 py-1.5 text-left transition ${
                  selected ? 'shadow-[3px_3px_0_var(--color-ink)]' : 'bg-surface opacity-80 hover:opacity-100'
                }`}
                style={selected ? { background: c.bg, color: c.ink } : undefined}
              >
                {!selected && <span class="h-3.5 w-3.5 rounded-full border-2 border-ink" style={{ background: c.bg }} />}
                <span class="max-w-28 truncate text-sm font-semibold">{p.name || `Player ${i + 1}`}</span>
                <span class="font-display text-xl font-bold tabular-nums">{totals[i]}</span>
                {isLeader(i) && <span aria-label="leading">👑</span>}
              </button>
            );
          })}
          {draft.players.length < game.players.max && (
            <button
              type="button"
              onClick={addPlayer}
              class="shrink-0 rounded-2xl border-[2.5px] border-dashed border-ink/50 px-3 py-1.5 text-sm font-semibold text-muted hover:border-ink hover:text-ink"
            >
              + Add player
            </button>
          )}
        </div>
      </div>

      <section
        ref={panelRef}
        id="mm-player-panel"
        role="tabpanel"
        aria-label={`${active.name} scores`}
        class="chunk scroll-mt-24 overflow-hidden"
      >
        <header class="flex items-center gap-3 border-b-[2.5px] border-ink p-4" style={{ background: color.bg, color: color.ink }}>
          <div class="min-w-0 flex-1">
            <label for="mm-player-name" class="text-xs font-bold uppercase tracking-wider opacity-80">
              Player {activeIndex + 1} of {draft.players.length}
            </label>
            <input
              id="mm-player-name"
              class="block w-full min-w-0 rounded-lg border-2 border-transparent bg-transparent px-1 font-display text-2xl font-semibold placeholder:text-current placeholder:opacity-60 hover:border-current/40 focus:border-current focus:outline-none"
              value={active.name}
              placeholder={`Player ${activeIndex + 1}`}
              list="mm-player-names"
              onFocus={(e) => e.currentTarget.select()}
              onInput={(e) => rename(active.id, e.currentTarget.value)}
            />
          </div>
          <div class="text-right">
            <div class="text-xs font-bold uppercase tracking-wider opacity-80">Total</div>
            <div class="font-display text-4xl font-bold tabular-nums leading-none">{totals[activeIndex]}</div>
          </div>
        </header>

        <ul>
          {cats.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              values={draft.values[active.id]?.[cat.id]}
              heldBy={cat.type === 'bonus' && cat.exclusive ? heldBy(cat) : undefined}
              onChange={(field, v) => setValue(active.id, cat, field, v)}
            />
          ))}
        </ul>

        <footer class="flex flex-wrap items-center gap-3 border-t-[2.5px] border-ink bg-soft p-4">
          {prevPlayer && (
            <button type="button" class="font-semibold text-muted hover:text-ink" onClick={() => goTo(prevPlayer.id)}>
              ← {prevPlayer.name}
            </button>
          )}
          {draft.players.length > 1 && (
            <button type="button" class="text-sm font-semibold text-muted underline hover:text-accent" onClick={() => removePlayer(active.id)}>
              Remove player
            </button>
          )}
          <span class="flex-1" />
          {nextPlayer ? (
            <button
              type="button"
              class="btn"
              style={{ background: playerColor(nextPlayer.color).bg, color: playerColor(nextPlayer.color).ink }}
              onClick={() => goTo(nextPlayer.id)}
            >
              Next: {nextPlayer.name} →
            </button>
          ) : (
            <button
              type="button"
              class="btn bg-sun"
              onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              See results ↓
            </button>
          )}
        </footer>
      </section>

      <datalist id="mm-player-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <section ref={resultsRef} aria-live="polite" class="chunk scroll-mt-24 p-5 sm:p-6">
        <h2 class="font-display text-3xl font-semibold">Results</h2>
        {anyScore ? (
          <>
            <ol class="mt-4 space-y-2.5">
              {ranking.map((r) => {
                const p = draft.players[r.index];
                const c = playerColor(p.color);
                const first = r.rank === 1;
                return (
                  <li
                    key={p.id}
                    class={`flex items-center gap-3 rounded-2xl border-[2.5px] border-ink px-3 py-2.5 ${first ? 'shadow-[3px_3px_0_var(--color-ink)]' : ''}`}
                    style={first ? { background: 'var(--color-sun)' } : undefined}
                  >
                    <span
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink font-display text-lg font-bold"
                      style={{ background: c.bg, color: c.ink }}
                    >
                      {r.rank}
                    </span>
                    <span class={`flex-1 truncate text-lg ${first ? 'font-bold' : 'font-medium'}`}>
                      {p.name} {first && '👑'}
                    </span>
                    <span class="font-display text-2xl font-bold tabular-nums">{r.total}</span>
                  </li>
                );
              })}
            </ol>
            {leaders.length > 1 && (
              <p class="mt-4 rounded-2xl border-2 border-dashed border-ink/40 p-3 text-sm">
                <strong>It's a tie!</strong> {game.tiebreaker}
              </p>
            )}
          </>
        ) : (
          <p class="mt-2 text-muted">Enter some scores and the ranking shows up here.</p>
        )}
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!anyScore || status === 'saved'}
            class="btn bg-accent text-on-accent"
          >
            {status === 'saved' ? 'Saved ✓' : 'Save game'}
          </button>
          <button type="button" onClick={() => shareResults(toSession())} disabled={!anyScore} class="btn bg-surface">
            Share image
          </button>
          <button type="button" onClick={newGame} class="px-3 font-semibold text-muted hover:text-ink">
            New game
          </button>
        </div>
        {status === 'saved' && (
          <p class="mt-4 text-sm">
            Saved on this device.{' '}
            <a class="font-semibold text-accent underline" href="/history/">
              See your history and stats →
            </a>
          </p>
        )}
        {status === 'error' && (
          <p class="mt-4 text-sm font-semibold text-accent">
            Could not save. Your browser may be blocking storage (private mode?).
          </p>
        )}
      </section>
    </div>
  );
}

interface RowProps {
  cat: Category;
  values: number[] | undefined;
  heldBy?: string;
  onChange: (field: number, value: number) => void;
}

function CategoryRow({ cat, values, heldBy, onChange }: RowProps) {
  const [showHelp, setShowHelp] = useState(false);
  const val = (i: number) => values?.[i];
  const pts = scoreCategory(cat, values);
  const rowCls = 'border-b-2 border-soft px-4 py-3.5 last:border-b-0';

  const label = (extra?: string) => (
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-baseline gap-x-2">
        <span class="font-display text-lg font-semibold leading-tight">{cat.label}</span>
        {extra && <span class="rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-muted">{extra}</span>}
        {cat.help && (
          <button
            type="button"
            class="h-6 w-6 rounded-full border-2 border-ink/30 text-xs font-bold text-muted hover:border-ink sm:hidden"
            aria-expanded={showHelp}
            aria-label={`How to score ${cat.label}`}
            onClick={() => setShowHelp(!showHelp)}
          >
            ?
          </button>
        )}
      </div>
      {cat.help && <p class={`mt-0.5 text-sm leading-snug text-muted ${showHelp ? '' : 'hidden'} sm:block`}>{cat.help}</p>}
    </div>
  );

  if (cat.type === 'bonus') {
    const on = !!val(0);
    return (
      <li class={`${rowCls} flex items-center gap-4`}>
        {label(`${cat.points} pts`)}
        <div class="flex flex-col items-end gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={cat.label}
            onClick={() => onChange(0, on ? 0 : 1)}
            class={`btn min-w-24 px-4 py-2 text-base ${on ? 'bg-sun' : 'bg-surface'}`}
          >
            {on ? `✓ +${cat.points}` : 'No'}
          </button>
          {heldBy && !on && <span class="text-xs text-muted">Held by {heldBy}</span>}
        </div>
      </li>
    );
  }

  if (cat.type === 'table') {
    return (
      <li class={`${rowCls} flex items-center gap-4`}>
        {label(cat.unit)}
        <div class="flex flex-col items-end gap-1">
          <Stepper value={val(0)} label={cat.label} onChange={(v) => onChange(0, v)} />
          <span class={`text-xs font-bold tabular-nums ${pts < 0 ? 'text-accent' : 'text-muted'}`}>= {pts} pts</span>
        </div>
      </li>
    );
  }

  if (cat.type === 'counts' || cat.type === 'sets' || cat.type === 'tiered') {
    let fields: { name: string; note: string }[];
    if (cat.type === 'counts') fields = cat.items.map((it) => ({ name: it.label, note: `${it.points} pts each` }));
    else if (cat.type === 'sets') fields = cat.symbols.map((s) => ({ name: s, note: '' }));
    else {
      const t = tierIndex(cat, Number.isFinite(val(0)) ? val(0)! : 0);
      fields = [
        { name: cat.tierLabel, note: cat.tiers[t].label },
        ...cat.fields.map((f) => ({ name: f.label, note: `${f.points[t]} pts per ${f.per === 1 ? 'one' : f.per}` })),
      ];
    }
    return (
      <li class={rowCls}>
        <div class="flex items-start gap-4">
          {label()}
          <span class="shrink-0 rounded-xl bg-soft px-3 py-1 font-display text-xl font-bold tabular-nums">= {pts}</span>
        </div>
        <ul class="mt-3 grid gap-2 sm:grid-cols-2">
          {fields.map((f, i) => (
            <li key={f.name} class="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2">
              <div class="min-w-0 flex-1">
                <div class="font-semibold leading-tight">{f.name}</div>
                {f.note && <div class="text-xs text-muted">{f.note}</div>}
              </div>
              <Stepper value={val(i)} label={`${cat.label}: ${f.name}`} onChange={(v) => onChange(i, v)} />
            </li>
          ))}
        </ul>
      </li>
    );
  }

  const showPts = (cat.multiplier !== 1 || !!cat.divisor) && Number.isFinite(val(0));
  return (
    <li class={`${rowCls} flex items-center gap-4`}>
      {label(cat.unit)}
      <div class="flex flex-col items-end gap-1">
        <Stepper value={val(0)} allowNegative={cat.allowNegative} label={cat.label} onChange={(v) => onChange(0, v)} />
        {showPts && <span class="text-xs font-bold tabular-nums text-muted">= {pts} pts</span>}
      </div>
    </li>
  );
}

function Stepper(props: { value: number | undefined; label: string; allowNegative?: boolean; onChange: (v: number) => void }) {
  const n = props.value != null && Number.isFinite(props.value) ? props.value : NaN;
  const shown = Number.isFinite(n) ? String(n) : '';
  const step = (d: number) => {
    const next = (Number.isFinite(n) ? n : 0) + d;
    props.onChange(props.allowNegative ? next : Math.max(0, next));
  };
  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-surface font-display text-2xl font-bold leading-none transition active:scale-90 disabled:opacity-30';
  return (
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class={btn}
        aria-label={`${props.label}: minus 1`}
        disabled={!props.allowNegative && !(n > 0)}
        onClick={() => step(-1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode={props.allowNegative ? 'text' : 'numeric'}
        min={props.allowNegative ? undefined : 0}
        step={1}
        value={shown}
        placeholder="0"
        aria-label={props.label}
        onFocus={(e) => e.currentTarget.select()}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          let v = raw === '' ? NaN : Math.trunc(Number(raw));
          if (!props.allowNegative && v < 0) v = Math.abs(v);
          props.onChange(v);
        }}
        class="h-11 w-16 rounded-xl border-[2.5px] border-ink bg-paper text-center font-display text-2xl font-semibold tabular-nums placeholder:text-ink/30 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-sun"
      />
      <button type="button" class={btn} aria-label={`${props.label}: plus 1`} onClick={() => step(1)}>
        +
      </button>
    </div>
  );
}
