import { APOTHEM, ARENA_CX, ARENA_CY, BOMBER, BlobKind, BomberKind, CoilKind, GAMES, MemoryLedger, PotatoKind, Room, VOLT, VoltKind } from '@arena/engine';
import { TICK_MS, type EntitySnap, type GameId } from '@arena/shared';
import { PELLET_COLORS } from '../render/color';
import { settings } from '../settings';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

type Draw = (ctx: CanvasRenderingContext2D, ents: EntitySnap[], w: number, h: number, t: number) => void;

function octPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

type Ent = { x: number; y: number; r: number; alive: boolean };
/** Busiest spot: follow the average position of everyone alive (smoothed by the camera). */
const crowd = (fallback: number, size: number, pad: number) => (ents: Iterable<Ent>): [number, number] => {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const e of ents) {
    if (!e.alive) continue;
    x += e.x;
    y += e.y;
    n++;
  }
  const keep = (v: number) => Math.min(size - pad, Math.max(pad, v));
  return n ? [keep(x / n), keep(y / n)] : [fallback, fallback];
};
const disc = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};
const players = (ctx: CanvasRenderingContext2D, ents: EntitySnap[], kind: number, scale = 1.6) => {
  for (const e of ents) {
    if (e.k !== kind) continue;
    disc(ctx, e.x + 5, e.y + 8, e.r * scale, 'rgba(0,0,0,.3)');
    disc(ctx, e.x, e.y, e.r * scale, hex(e.c ?? 0xffffff));
    disc(ctx, e.x + Math.cos(e.a ?? 0) * e.r * 0.7, e.y + Math.sin(e.a ?? 0) * e.r * 0.7, e.r * 0.35, '#fff');
  }
};

const DRAW: Partial<Record<GameId, { center: (ents: Iterable<Ent>) => [number, number]; span: number; draw: Draw }>> = {
  bomber: {
    center: crowd(1050, 2100, 650),
    span: 1500,
    draw(ctx, ents, _w, _h, t) {
      for (let y = 0; y < 2100; y += 105) for (let x = 0; x < 2100; x += 105) {
        ctx.fillStyle = (x + y) / 105 % 2 ? '#2e1a1a' : '#341e1d';
        ctx.fillRect(x, y, 105, 105);
      }
      for (const e of ents) {
        if (e.k === BomberKind.Pillar) disc(ctx, e.x, e.y, e.r, '#5b4a4a');
        else if (e.k === BomberKind.SkyMark) {
          ctx.strokeStyle = '#ff3d3d';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.k === BomberKind.Bomb) {
          disc(ctx, e.x, e.y, BOMBER.blast, `rgba(255,61,61,${0.05 + (1 - (e.h ?? 1)) * 0.15})`);
          disc(ctx, e.x, e.y, e.r * 1.6, Math.sin(t * (6 + (1 - (e.h ?? 1)) * 20)) > 0.5 ? '#ff5050' : '#1b1430');
        }
      }
      players(ctx, ents, BomberKind.Player);
    },
  },
  potato: {
    center: crowd(1200, 2400, 650),
    span: 1500,
    draw(ctx, ents, _w, _h, t) {
      ctx.fillStyle = '#2d2614';
      ctx.fillRect(0, 0, 2400, 2400);
      for (const e of ents) if (e.k === PotatoKind.Pillar) disc(ctx, e.x, e.y, e.r, '#6b5a2e');
      players(ctx, ents, PotatoKind.Player);
      for (const e of ents) {
        if (e.k !== PotatoKind.Potato) continue;
        const heat = 1 - (e.h ?? 1);
        disc(ctx, e.x, e.y - 60, 60 + heat * 40, `rgba(255,${Math.round(180 - heat * 120)},60,.35)`);
        ctx.fillStyle = heat > 0.66 ? '#ff5030' : '#b5833f';
        ctx.beginPath();
        ctx.ellipse(e.x + Math.sin(t * 40) * heat * 4, e.y - 60, 34, 24, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  coil: {
    center: (ents) => {
      let best: (Ent & { mass?: number }) | null = null;
      for (const e of ents as Iterable<Ent & { mass?: number }>) if (e.alive && (!best || (e.mass ?? 0) > (best.mass ?? 0))) best = e;
      const keep = (v: number) => Math.min(3400 - 600, Math.max(600, v));
      return best ? [keep(best.x), keep(best.y)] : [1700, 1700];
    },
    span: 1300,
    draw(ctx, ents, _w, _h, t) {
      ctx.fillStyle = '#0f2b2a';
      ctx.fillRect(0, 0, 3400, 3400);
      ctx.strokeStyle = '#3de0b0';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, 3400, 3400);
      for (const e of ents) {
        if (e.k === CoilKind.Pellet) {
          ctx.fillStyle = e.c === -1 ? '#ffb84f' : hex(PELLET_COLORS[(e.c ?? 0) % PELLET_COLORS.length]!);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 1.6 * (1 + 0.2 * Math.sin(t * 5 + e.id)), 0, Math.PI * 2);
          ctx.fill();
        } else if (e.k === CoilKind.Trap) {
          ctx.fillStyle = '#ff4f7b';
          ctx.beginPath();
          for (let i = 0; i < 24; i++) {
            const rr = i % 2 ? e.r * 0.75 : e.r * 1.3;
            const a = (i / 24) * Math.PI * 2 + (e.a ?? 0);
            ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
          }
          ctx.fill();
        }
      }
      for (const e of ents) {
        if (e.k !== CoilKind.Snake || !e.pts) continue;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(e.pts![0]!, e.pts![1]!);
          for (let i = 2; i < e.pts!.length; i += 2) ctx.lineTo(e.pts![i]!, e.pts![i + 1]!);
        };
        path();
        ctx.strokeStyle = 'rgba(0,0,0,.45)';
        ctx.lineWidth = e.r * 2.6 + 10;
        ctx.stroke();
        path();
        ctx.strokeStyle = hex(e.c ?? 0x3de0b0);
        ctx.lineWidth = e.r * 2.6;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x + Math.cos((e.a ?? 0) + 0.6) * e.r * 0.7, e.y + Math.sin((e.a ?? 0) + 0.6) * e.r * 0.7, e.r * 0.45, 0, Math.PI * 2);
        ctx.arc(e.x + Math.cos((e.a ?? 0) - 0.6) * e.r * 0.7, e.y + Math.sin((e.a ?? 0) - 0.6) * e.r * 0.7, e.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  blob: {
    // follow the biggest cell so there is always something happening
    center: (ents) => {
      let best: Ent | null = null;
      for (const e of ents) if (e.alive && (!best || e.r > best.r)) best = e;
      const keep = (v: number) => Math.min(3200 - 500, Math.max(500, v)); // stay inside the map
      return best ? [keep(best.x), keep(best.y)] : [1600, 1600];
    },
    span: 1150,
    draw(ctx, ents, _w, _h, t) {
      ctx.fillStyle = '#2a1440';
      ctx.fillRect(0, 0, 3200, 3200);
      for (const e of ents) {
        if (e.k === BlobKind.Pellet) {
          ctx.fillStyle = hex(PELLET_COLORS[(e.c ?? 0) % PELLET_COLORS.length]!);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * (1 + 0.2 * Math.sin(t * 4 + e.id)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const e of ents) {
        if (e.k !== BlobKind.Trap) continue;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.a ?? 0);
        ctx.fillStyle = '#2fd36b';
        ctx.beginPath();
        for (let i = 0; i < 28; i++) {
          const rr = i % 2 ? e.r * 0.82 : e.r * 1.25;
          const a = (i / 28) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.fill();
        ctx.restore();
      }
      for (const e of ents.filter((x) => x.k === BlobKind.Cell).sort((a, b) => a.r - b.r)) {
        ctx.fillStyle = hex(e.c ?? 0xff4f7b);
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.lineWidth = Math.max(4, e.r * 0.12);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    },
  },
  volt: {
    center: () => [ARENA_CX, ARENA_CY],
    span: VOLT.arenaRadius * 1.75,
    draw(ctx, ents, w, h, t) {
      ctx.fillStyle = '#0f0b24';
      ctx.fillRect(-w, -h, w * 3, h * 3);
      octPath(ctx, ARENA_CX, ARENA_CY, VOLT.arenaRadius);
      ctx.fillStyle = '#221d63';
      ctx.fill();
      ctx.strokeStyle = '#2f2a84';
      ctx.lineWidth = 8;
      octPath(ctx, ARENA_CX, ARENA_CY, VOLT.arenaRadius * 0.55);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,61,139,.18)';
      ctx.beginPath();
      ctx.arc(ARENA_CX - APOTHEM, ARENA_CY, VOLT.arenaRadius * 0.34, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(61,232,255,.16)';
      ctx.beginPath();
      ctx.arc(ARENA_CX + APOTHEM, ARENA_CY, VOLT.arenaRadius * 0.34, Math.PI / 2, Math.PI * 1.5);
      ctx.fill();
      for (const e of ents) {
        if (e.k === VoltKind.Strike) {
          ctx.strokeStyle = '#ff3d8b';
          ctx.lineWidth = 8;
          ctx.fillStyle = `rgba(233,212,255,${0.15 + 0.25 * (e.p ?? 0)})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * (e.p ?? 0), 0, Math.PI * 2);
          ctx.fill();
        } else if (e.k === VoltKind.Bolt) {
          ctx.fillStyle = 'rgba(233,212,255,.6)';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#e9d4ff';
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(e.x - 40, e.y - 900);
          for (let i = 1; i < 8; i++) ctx.lineTo(e.x + (Math.random() - 0.5) * 120, e.y - 900 + i * 112);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        } else if (e.k === VoltKind.Pylon) {
          ctx.fillStyle = '#ffb84f';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,61,139,${0.7 + 0.3 * Math.sin(t * 6 + e.id)})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.k === VoltKind.Orb) {
          ctx.fillStyle = '#3de0b0';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const e0 of ents) {
        if (e0.k !== VoltKind.Fighter) continue;
        const e = { ...e0, r: e0.r * 1.9 }; // drawn larger so they read at thumbnail size
        const a = e.a ?? 0;
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.ellipse(e.x + 6, e.y + 10, e.r * 1.1, e.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(e.c ?? 0xff4f7b);
        for (const side of [-1, 1]) {
          const reach = (e.f ?? 0) & 256 ? 1.3 : 0.6;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * e.r * reach - Math.sin(a) * side * e.r * 0.7, e.y + Math.sin(a) * e.r * reach + Math.cos(a) * side * e.r * 0.7, e.r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.6, a - 0.7, a + 0.7);
        ctx.stroke();
      }
      const pulse = 0.7 + 0.3 * Math.sin(t * 2.2);
      octPath(ctx, ARENA_CX, ARENA_CY, VOLT.arenaRadius + 14);
      ctx.strokeStyle = `rgba(255,61,139,${0.25 * pulse})`;
      ctx.lineWidth = 46;
      ctx.stroke();
      ctx.strokeStyle = '#ff3d8b';
      ctx.lineWidth = 14;
      ctx.stroke();
    },
  },
};

/**
 * A real bot-only match running in the browser, drawn with Canvas 2D.
 * Runs only while visible; a single still frame with reduced motion.
 */
export class LivePreview {
  private room: Room;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private visible = false;
  private io: IntersectionObserver;
  private spec: NonNullable<(typeof DRAW)[GameId]>;
  private cam: [number, number] | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, gameId: GameId, population = 10) {
    const game = GAMES[gameId];
    const spec = DRAW[gameId];
    if (!game || !spec) throw new Error(`no preview for ${gameId}`);
    this.spec = spec;
    this.room = new Room(game, { id: `preview-${gameId}`, seed: (Math.random() * 2 ** 31) | 0, ledger: new MemoryLedger(), targetPopulation: population });
    for (let i = 0; i < 240; i++) this.room.step();
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      if (this.visible && !this.raf && !settings.reducedMotion) {
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
      }
    });
    this.io.observe(canvas);
    this.draw(performance.now());
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (!this.visible) return;
    this.acc += Math.min(200, now - this.last);
    this.last = now;
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.room.step();
    }
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(now: number): void {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth || 320;
    const h = c.clientHeight || 200;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const target = this.spec.center(this.room.entities.values());
    // ease the camera so following a cell is smooth
    this.cam = this.cam ? [this.cam[0] + (target[0] - this.cam[0]) * 0.08, this.cam[1] + (target[1] - this.cam[1]) * 0.08] : target;
    const [cx, cy] = this.cam;
    const scale = (Math.max(w, h) / this.spec.span) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f0b24';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, c.width / 2 - cx * scale, c.height / 2 - cy * scale);
    this.spec.draw(ctx, this.room.snapshotAt(cx, cy), c.width / scale, c.height / scale, now / 1000);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.room.close();
  }
}

/** Still illustrations for games that are not playable yet. */
export function drawArt(canvas: HTMLCanvasElement, id: GameId, accent: string, bg: string): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 320;
  const h = canvas.clientHeight || 200;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const dot = (x: number, y: number, r: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const cx = w / 2;
  const cy = h / 2;
  switch (id) {
    case 'coil': {
      for (const [ox, oy, c, ph] of [[-60, -10, accent, 0], [50, 25, '#ffb84f', 2]] as const) {
        for (let i = 14; i >= 0; i--) dot(cx + ox + i * 9, cy + oy + Math.sin(i * 0.6 + ph) * 18, i === 0 ? 11 : 9, c);
      }
      for (let i = 0; i < 18; i++) dot((i * 53) % w, (i * 37) % h, 3, '#ffffff55');
      break;
    }
    case 'bomber': {
      for (const [x, y] of [[-60, 0], [40, -20], [10, 35]] as const) {
        dot(cx + x, cy + y, 12, '#1b1430');
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + x + 6, cy + y - 9);
        ctx.lineTo(cx + x + 12, cy + y - 18);
        ctx.stroke();
        dot(cx + x + 12, cy + y - 19, 3, '#ffd84f');
      }
      ctx.fillStyle = accent + '55';
      ctx.fillRect(cx + 40 - 60, cy - 20 - 8, 120, 16);
      ctx.fillRect(cx + 40 - 8, cy - 20 - 60, 16, 120);
      break;
    }
    case 'potato': {
      for (const [x, y, c] of [[-70, 10, '#4fd2ff'], [70, -10, '#b07bff'], [0, 40, '#3de0b0']] as const) dot(cx + x, cy + y, 15, c);
      ctx.fillStyle = '#b5833f';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 15, 22, 15, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy - 15, 30, -Math.PI / 2, Math.PI);
      ctx.stroke();
      break;
    }
    default:
      dot(cx, cy, 30, accent);
  }
}
