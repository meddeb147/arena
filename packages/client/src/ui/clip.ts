import { audioStream } from '../audio/sfx';

const MIME = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
/** a segment is restarted after this long so clips stay short and small */
const MAX_SEGMENT_MS = 25_000;
const MIN_USEFUL_MS = 6_000;

/**
 * Records the game canvas (and game sound) while you play, so the end screen
 * can offer the clip of the life that just ended. One encoder at a time; the
 * current segment restarts every 25 s and the previous one is kept, so a clip
 * is always the most recent 6-25 seconds.
 */
export class ClipRecorder {
  readonly mime: string;
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private prev: Blob | null = null;
  private timer = 0;

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && MIME.some((m) => MediaRecorder.isTypeSupported(m));
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.mime = MIME.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  }

  get extension(): string {
    return this.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  }

  /** Start (or restart) recording: call when a life begins. */
  start(): void {
    try {
      if (!this.stream) {
        this.stream = this.canvas.captureStream(30);
        const audio = audioStream();
        if (audio) for (const t of audio.getAudioTracks()) this.stream.addTrack(t);
      }
      this.prev = null;
      this.begin();
      clearInterval(this.timer);
      this.timer = window.setInterval(() => void this.rotate(), 1000);
    } catch {
      this.rec = null; // recording is a bonus: never break the game over it
    }
  }

  private begin(): void {
    if (!this.stream) return;
    this.chunks = [];
    const rec = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 96_000 });
    const chunks = this.chunks;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.start();
    this.rec = rec;
    this.startedAt = performance.now();
  }

  private finish(): Promise<Blob | null> {
    const rec = this.rec;
    const chunks = this.chunks;
    this.rec = null;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: this.mime.split(';')[0] }) : null);
      rec.stop();
    });
  }

  private async rotate(): Promise<void> {
    if (!this.rec || performance.now() - this.startedAt < MAX_SEGMENT_MS) return;
    this.prev = await this.finish();
    this.begin();
  }

  /** The life ended: returns its clip (waits a moment so the final explosion is in it). */
  async lifeEnded(tailMs = 1300): Promise<Blob | null> {
    clearInterval(this.timer);
    if (!this.rec) return null;
    await new Promise((r) => setTimeout(r, tailMs));
    const length = performance.now() - this.startedAt;
    const current = await this.finish();
    const clip = length < MIN_USEFUL_MS && this.prev ? this.prev : current;
    this.prev = null;
    return clip;
  }

  dispose(): void {
    clearInterval(this.timer);
    void this.finish();
    this.stream?.getVideoTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/** Share a clip through the phone's share sheet, or download it. */
export async function shareClip(blob: Blob, name: string, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'saved';
}
