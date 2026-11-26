import type { SavedSession } from './db';
import { playerColor } from './colors';

const W = 1080;
const H = 1080;
const INK = '#1e1b2e';
const PAPER = '#fff6e0';
const SUN = '#ffc93c';
const MUTED = '#5e5873';
const DISPLAY = '"Fredoka Variable", ui-rounded, system-ui, sans-serif';

/** Draws a square results card. Text and shapes only, no game artwork. */
export async function drawResults(session: SavedSession): Promise<HTMLCanvasElement> {
  // Make sure the display font is ready before drawing with it.
  await Promise.all([document.fonts.load(`700 40px ${DISPLAY}`), document.fonts.load(`500 40px ${DISPLAY}`)]).catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (weight: number, size: number) => `${weight} ${size}px ${DISPLAY}`;

  // Background with dot texture
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(30,27,46,0.07)';
  for (let x = 9; x < W; x += 24) for (let y = 9; y < H; y += 24) ctx.fillRect(x, y, 2.5, 2.5);

  ctx.fillStyle = MUTED;
  ctx.font = font(600, 34);
  ctx.fillText('FINAL SCORES', 80, 128);

  ctx.fillStyle = INK;
  ctx.font = font(700, 84);
  ctx.fillText(fit(ctx, session.gameName, W - 160), 80, 218);

  ctx.fillStyle = MUTED;
  ctx.font = font(500, 32);
  ctx.fillText(new Date(session.playedAt).toLocaleDateString(undefined, { dateStyle: 'long' }), 80, 272);

  const players = [...session.players].sort((a, b) => a.rank - b.rank).slice(0, 8);
  const top = 330;
  const rowH = Math.min(104, (H - top - 170) / players.length);
  players.forEach((p, i) => {
    const y = top + i * rowH;
    const h = rowH - 18;
    const winner = p.rank === 1;
    const c = playerColor(p.color ?? i);

    // chunky card: offset shadow, then outlined fill
    ctx.fillStyle = INK;
    roundRect(ctx, 70, y + 6, W - 140, h, 26);
    ctx.fill();
    ctx.fillStyle = winner ? SUN : '#ffffff';
    roundRect(ctx, 64, y, W - 140, h, 26);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.stroke();

    const mid = y + h / 2;
    const r = Math.min(30, h / 2 - 10);
    ctx.beginPath();
    ctx.arc(124, mid, r, 0, Math.PI * 2);
    ctx.fillStyle = c.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = c.ink;
    ctx.font = font(700, Math.round(r * 1.1));
    ctx.fillText(String(p.rank), 124, mid + 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = font(winner ? 700 : 500, 44);
    ctx.fillText(fit(ctx, p.name + (winner ? '  👑' : ''), W - 480), 176, mid + 2);

    ctx.textAlign = 'right';
    ctx.font = font(700, 54);
    ctx.fillText(String(p.total), W - 110, mid + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  });

  ctx.fillStyle = INK;
  ctx.font = font(700, 40);
  ctx.fillText('MeepleMath', 80, H - 70);
  ctx.fillStyle = MUTED;
  ctx.font = font(500, 32);
  ctx.textAlign = 'right';
  ctx.fillText('meeplemath.org', W - 80, H - 70);
  ctx.textAlign = 'left';
  return canvas;
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Uses the native share sheet with the image when the device supports it, otherwise downloads it. */
export async function shareResults(session: SavedSession) {
  const canvas = await drawResults(session);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `${session.gameSlug}-scores.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${session.gameName} scores` });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
