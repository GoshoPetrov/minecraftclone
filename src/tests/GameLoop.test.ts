import { describe, expect, it } from 'vitest';

import {
  computeDeltaSeconds,
  GameLoop,
  type FrameScheduler,
  type GameLoopCallbacks,
} from '../app/GameLoop';

/** Deterministic scheduler that runs queued frames on demand. */
class ManualScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly queued = new Map<number, (timestampMs: number) => void>();

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.queued.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.queued.delete(handle);
  }

  get pendingCount(): number {
    return this.queued.size;
  }

  /** Run every frame currently scheduled at the given timestamp. */
  runFrame(timestampMs: number): void {
    const callbacks = [...this.queued.values()];
    this.queued.clear();
    for (const callback of callbacks) {
      callback(timestampMs);
    }
  }
}

function recordingCallbacks(): { callbacks: GameLoopCallbacks; events: string[] } {
  const events: string[] = [];
  return {
    events,
    callbacks: {
      update: (deltaSeconds) => {
        events.push(`update:${deltaSeconds}`);
      },
      render: () => {
        events.push('render');
      },
    },
  };
}

describe('computeDeltaSeconds', () => {
  it('converts a millisecond gap to seconds', () => {
    expect(computeDeltaSeconds(1016, 1000, 0.05)).toBeCloseTo(0.016);
  });

  it('clamps a hitch or tab-switch gap to the maximum', () => {
    expect(computeDeltaSeconds(6000, 1000, 0.05)).toBe(0.05);
  });

  it('treats non-positive and non-finite gaps as zero', () => {
    expect(computeDeltaSeconds(1000, 1000, 0.05)).toBe(0);
    expect(computeDeltaSeconds(900, 1000, 0.05)).toBe(0);
    expect(computeDeltaSeconds(Number.NaN, 1000, 0.05)).toBe(0);
  });
});

describe('GameLoop', () => {
  it('runs update before render each frame', () => {
    const scheduler = new ManualScheduler();
    const { callbacks, events } = recordingCallbacks();
    const loop = new GameLoop(callbacks, 0.05, scheduler);

    loop.start();
    scheduler.runFrame(1000);
    scheduler.runFrame(1016);

    expect(events).toEqual(['update:0', 'render', 'update:0.016', 'render']);
  });

  it('clamps a long frame gap passed to update', () => {
    const scheduler = new ManualScheduler();
    const { callbacks, events } = recordingCallbacks();
    const loop = new GameLoop(callbacks, 0.05, scheduler);

    loop.start();
    scheduler.runFrame(1000);
    scheduler.runFrame(9000);

    expect(events).toEqual(['update:0', 'render', 'update:0.05', 'render']);
  });

  it('does not schedule a frame until start is called', () => {
    const scheduler = new ManualScheduler();
    const { callbacks } = recordingCallbacks();
    new GameLoop(callbacks, 0.05, scheduler);

    expect(scheduler.pendingCount).toBe(0);
  });

  it('ignores a second start while running', () => {
    const scheduler = new ManualScheduler();
    const { callbacks } = recordingCallbacks();
    const loop = new GameLoop(callbacks, 0.05, scheduler);

    loop.start();
    loop.start();

    expect(scheduler.pendingCount).toBe(1);
  });

  it('stops scheduling frames after stop', () => {
    const scheduler = new ManualScheduler();
    const { callbacks, events } = recordingCallbacks();
    const loop = new GameLoop(callbacks, 0.05, scheduler);

    loop.start();
    scheduler.runFrame(1000);
    expect(loop.isRunning).toBe(true);

    loop.stop();
    expect(loop.isRunning).toBe(false);
    expect(scheduler.pendingCount).toBe(0);

    scheduler.runFrame(1016);
    expect(events).toEqual(['update:0', 'render']);
  });
});
