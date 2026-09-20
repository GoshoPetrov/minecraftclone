/**
 * A minimal abstraction over `requestAnimationFrame` so the loop can be
 * driven deterministically in unit tests.
 */
export interface FrameScheduler {
  request(callback: (timestampMs: number) => void): number;
  cancel(handle: number): void;
}

export const browserFrameScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export interface GameLoopCallbacks {
  /**
   * Advance simulation by `deltaSeconds`. Called once per frame before
   * `render`, with a delta already clamped by the loop.
   */
  readonly update: (deltaSeconds: number) => void;
  /** Draw the current state. Called once per frame after `update`. */
  readonly render: () => void;
}

/**
 * Convert a wall-clock gap into a simulation delta, clamped so a long
 * pause (tab switch, debugger, GC hitch) cannot produce a huge step.
 */
export function computeDeltaSeconds(
  timestampMs: number,
  previousTimestampMs: number,
  maxDeltaSeconds: number,
): number {
  const rawDeltaSeconds = (timestampMs - previousTimestampMs) / 1000;
  if (!Number.isFinite(rawDeltaSeconds) || rawDeltaSeconds < 0) {
    return 0;
  }
  return Math.min(rawDeltaSeconds, maxDeltaSeconds);
}

/**
 * Drives `update` then `render` on the animation frame cadence, deriving
 * movement from delta time and clamping it.
 */
export class GameLoop {
  private handle: number | null = null;
  private previousTimestampMs: number | null = null;

  constructor(
    private readonly callbacks: GameLoopCallbacks,
    private readonly maxDeltaSeconds: number,
    private readonly scheduler: FrameScheduler = browserFrameScheduler,
  ) {}

  get isRunning(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) {
      return;
    }
    this.previousTimestampMs = null;
    this.handle = this.scheduler.request(this.onFrame);
  }

  stop(): void {
    if (this.handle === null) {
      return;
    }
    this.scheduler.cancel(this.handle);
    this.handle = null;
    this.previousTimestampMs = null;
  }

  private readonly onFrame = (timestampMs: number): void => {
    const previousTimestampMs = this.previousTimestampMs;
    this.previousTimestampMs = timestampMs;

    const deltaSeconds =
      previousTimestampMs === null
        ? 0
        : computeDeltaSeconds(timestampMs, previousTimestampMs, this.maxDeltaSeconds);

    this.callbacks.update(deltaSeconds);
    this.callbacks.render();

    // `stop()` may have been called during update/render; only reschedule
    // when the loop is still meant to be running.
    if (this.handle !== null) {
      this.handle = this.scheduler.request(this.onFrame);
    }
  };
}
