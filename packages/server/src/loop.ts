/**
 * Drift-corrected fixed-rate loop. Schedules against an absolute clock so the
 * average rate stays exact even when setTimeout is late; if the process stalls
 * badly it skips ahead instead of running a burst of catch-up ticks.
 */
export class FixedLoop {
  private timer: NodeJS.Timeout | null = null;
  private next = 0;
  /** last tick duration in ms */
  lastMs = 0;
  maxMs = 0;

  constructor(private readonly intervalMs: number, private readonly onTick: () => void, private readonly maxCatchUp = 3) {}

  start(): void {
    if (this.timer) return;
    this.next = performance.now();
    const run = () => {
      const now = performance.now();
      let n = 0;
      while (now >= this.next && n < this.maxCatchUp) {
        const t0 = performance.now();
        this.onTick();
        this.lastMs = performance.now() - t0;
        this.maxMs = Math.max(this.maxMs, this.lastMs);
        this.next += this.intervalMs;
        n++;
      }
      if (now - this.next > this.intervalMs * this.maxCatchUp) this.next = now; // give up catching up
      this.timer = setTimeout(run, Math.max(0, this.next - performance.now()));
    };
    run();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
