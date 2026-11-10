import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { settings } from '../settings';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  grow: number;
}

interface Floater {
  t: Text;
  vy: number;
  life: number;
}

/** Shared textures generated once at start-up (no image assets needed). */
export interface Textures {
  circle: Texture; // white disc, radius 64
  ring: Texture; // white ring, radius 64
  soft: Texture; // soft glow, radius 64
}

/**
 * Pixi application + camera + generic effects (particles, floaters, shake).
 * Game renderers draw into `world` (world units) and `fx` sits above them.
 */
export class Stage {
  readonly app = new Application();
  readonly world = new Container();
  readonly layerBg = new Container();
  readonly layerMain = new Container();
  readonly layerFx = new Container();
  textures!: Textures;

  camX = 0;
  camY = 0;
  zoom = 1;
  private shakeAmp = 0;
  private particles: Particle[] = [];
  private pool: Sprite[] = [];
  private floaters: Floater[] = [];

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      antialias: true,
      background: 0x171433,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      // `?renderer=canvas` forces the Canvas 2D fallback (broken WebGL drivers, video capture)
      preference: new URLSearchParams(location.search).get('renderer') === 'canvas' ? 'canvas' : ['webgl', 'canvas'],
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);
    this.world.addChild(this.layerBg, this.layerMain, this.layerFx);
    this.app.stage.addChild(this.world);
    this.textures = this.makeTextures();
  }

  private makeTextures(): Textures {
    const r = this.app.renderer;
    const circle = r.generateTexture({ target: new Graphics().circle(64, 64, 64).fill(0xffffff), resolution: 2 });
    const ring = r.generateTexture({ target: new Graphics().circle(64, 64, 60).stroke({ width: 8, color: 0xffffff }), resolution: 2 });
    const g = new Graphics();
    for (let i = 8; i >= 1; i--) g.circle(64, 64, i * 8).fill({ color: 0xffffff, alpha: 0.06 });
    const soft = r.generateTexture({ target: g, resolution: 1 });
    return { circle, ring, soft };
  }

  get width(): number {
    return this.app.screen.width;
  }
  get height(): number {
    return this.app.screen.height;
  }

  /** Smoothly follow a world point; zoom so the visible span grows with player size. */
  follow(x: number, y: number, size: number, dtMs: number): void {
    const span = 1500 + size * 6;
    const targetZoom = Math.max(this.width, this.height) / span;
    const k = 1 - Math.pow(0.001, dtMs / 1000);
    const kz = 1 - Math.pow(0.05, dtMs / 1000);
    if (this.camX === 0 && this.camY === 0) {
      this.camX = x;
      this.camY = y;
      this.zoom = targetZoom;
    }
    this.camX += (x - this.camX) * k;
    this.camY += (y - this.camY) * k;
    this.zoom += (targetZoom - this.zoom) * kz;
  }

  shake(amount: number): void {
    if (settings.reducedMotion) return;
    this.shakeAmp = Math.min(30, this.shakeAmp + amount);
  }

  burst(x: number, y: number, color: number, count: number, speed: number, size = 6): void {
    const n = settings.reducedMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spawnParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, color, size * (0.5 + Math.random()), 0.5 + Math.random() * 0.5, -0.6);
    }
  }

  spawnParticle(x: number, y: number, vx: number, vy: number, color: number, size: number, life: number, grow = 0): void {
    if (this.particles.length > 600) return;
    const s = this.pool.pop() ?? new Sprite(this.textures.circle);
    s.anchor.set(0.5);
    s.tint = color;
    s.position.set(x, y);
    s.scale.set(size / 64);
    s.alpha = 1;
    this.layerFx.addChild(s);
    this.particles.push({ s, vx, vy, life, max: life, grow });
  }

  floatText(x: number, y: number, text: string, color: number, size = 34): void {
    const t = new Text({
      text,
      style: { fontFamily: 'Bungee, Impact, sans-serif', fontSize: size, fill: color, stroke: { color: 0x171433, width: 6 } },
      resolution: 2,
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.layerFx.addChild(t);
    this.floaters.push({ t, vy: -90, life: 1.3 });
  }

  /** Per-frame: effects and camera transform. */
  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.removeFromParent();
        this.pool.push(p.s);
        this.particles.splice(i, 1);
        continue;
      }
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.vx *= 1 - 2.5 * dt;
      p.vy *= 1 - 2.5 * dt;
      const k = p.life / p.max;
      p.s.alpha = k;
      p.s.scale.set(Math.max(0.01, p.s.scale.x * (1 + p.grow * dt)));
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life -= dt;
      f.t.y += f.vy * dt;
      f.vy *= 1 - 1.5 * dt;
      f.t.alpha = Math.min(1, f.life * 2);
      f.t.scale.set(1 / this.zoom);
      if (f.life <= 0) {
        f.t.destroy();
        this.floaters.splice(i, 1);
      }
    }

    let sx = 0;
    let sy = 0;
    if (this.shakeAmp > 0.1) {
      sx = (Math.random() - 0.5) * this.shakeAmp * 2;
      sy = (Math.random() - 0.5) * this.shakeAmp * 2;
      this.shakeAmp *= Math.pow(0.002, dt);
    } else this.shakeAmp = 0;
    this.world.scale.set(this.zoom);
    this.world.position.set(this.width / 2 - this.camX * this.zoom + sx, this.height / 2 - this.camY * this.zoom + sy);
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}
