import type { PlayerInput } from '@arena/shared';

/**
 * Turns mouse / touch / keyboard / on-screen buttons into a PlayerInput.
 *  - Mouse: steer toward the cursor (distance from centre = throttle).
 *  - Touch: floating virtual joystick wherever the thumb lands.
 *  - Keyboard: WASD / arrows, Space = skill 1, Shift or E = skill 2, hold Q = cash out.
 */
export class Controls {
  private seq = 0;
  private mouse: { x: number; y: number } | null = null;
  private keys = new Set<string>();
  private joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private joyEl: HTMLDivElement;
  private knob: HTMLElement;
  buttons = { skill1: false, skill2: false, cashout: false };
  private readonly ac = new AbortController();

  constructor(private readonly surface: HTMLElement) {
    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joystick hidden';
    this.knob = document.createElement('i');
    this.joyEl.appendChild(this.knob);
    surface.appendChild(this.joyEl);

    const o = { signal: this.ac.signal };
    surface.addEventListener('pointermove', (e) => this.onMove(e), o);
    surface.addEventListener('pointerdown', (e) => this.onDown(e), o);
    window.addEventListener('pointerup', (e) => this.onUp(e), o);
    window.addEventListener('pointercancel', (e) => this.onUp(e), o);
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    }, o);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), o);
    window.addEventListener('blur', () => this.keys.clear(), o);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse') this.mouse = { x: e.clientX, y: e.clientY };
    else if (this.joy && e.pointerId === this.joy.id) {
      this.joy.x = e.clientX;
      this.joy.y = e.clientY;
      this.drawJoy();
    }
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      this.mouse = { x: e.clientX, y: e.clientY };
      return;
    }
    if (this.joy) return;
    this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    this.joyEl.classList.remove('hidden');
    this.joyEl.style.left = `${e.clientX}px`;
    this.joyEl.style.top = `${e.clientY}px`;
    this.drawJoy();
  }

  private onUp(e: PointerEvent): void {
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy = null;
      this.joyEl.classList.add('hidden');
    }
  }

  private drawJoy(): void {
    if (!this.joy) return;
    let dx = this.joy.x - this.joy.ox;
    let dy = this.joy.y - this.joy.oy;
    const m = Math.hypot(dx, dy);
    if (m > 50) {
      dx = (dx / m) * 50;
      dy = (dy / m) * 50;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  read(): PlayerInput {
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (kx || ky) {
      const m = Math.hypot(kx, ky);
      dx = kx / m;
      dy = ky / m;
    } else if (this.joy) {
      const jx = this.joy.x - this.joy.ox;
      const jy = this.joy.y - this.joy.oy;
      const m = Math.hypot(jx, jy);
      if (m > 6) {
        const thr = Math.min(1, m / 50);
        dx = (jx / m) * thr;
        dy = (jy / m) * thr;
      }
    } else if (this.mouse) {
      const r = this.surface.getBoundingClientRect();
      const jx = this.mouse.x - (r.left + r.width / 2);
      const jy = this.mouse.y - (r.top + r.height / 2);
      const m = Math.hypot(jx, jy);
      if (m > 4) {
        const thr = Math.min(1, m / 140);
        dx = (jx / m) * thr;
        dy = (jy / m) * thr;
      }
    }
    return {
      seq: ++this.seq,
      dx,
      dy,
      skill1: this.buttons.skill1 || k.has('Space'),
      skill2: this.buttons.skill2 || k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE'),
      cashout: this.buttons.cashout || k.has('KeyQ'),
    };
  }

  dispose(): void {
    this.ac.abort();
    this.joyEl.remove();
  }
}
