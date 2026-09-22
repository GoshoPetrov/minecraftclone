import { config } from '../config/Config';

/** A mouse button that maps to a game action. */
export type MouseButton = 'left' | 'right';

/** Accumulated relative mouse motion since the last consume. */
export interface MouseDelta {
  readonly dx: number;
  readonly dy: number;
}

/** Every key code that has a binding, so unrelated keys are ignored. */
const BOUND_KEY_CODES: ReadonlySet<string> = new Set(Object.values(config.input.bindings));

/**
 * Owns every DOM listener the game needs and exposes plain polled state.
 *
 * Game systems never attach their own listeners or read `KeyboardEvent` /
 * `MouseEvent` objects: they ask this one object which keys are down, consume
 * the accumulated mouse delta once per frame, and drain the queues of mouse
 * and key presses. Pointer-lock acquisition and `contextmenu` suppression
 * also live here, so browser integration stays in a single place.
 *
 * Mouse look and button presses only register while the canvas holds pointer
 * lock; once lock is lost all held input is cleared so nothing sticks.
 */
export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly pressedKeyCodes = new Set<string>();
  private readonly queuedPresses: MouseButton[] = [];
  private readonly queuedKeyPresses: string[] = [];
  private accumulatedDx = 0;
  private accumulatedDy = 0;
  private pointerLocked = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.pointerLocked = document.pointerLockElement === canvas;

    canvas.addEventListener('click', this.onCanvasClick);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
  }

  /** Whether the canvas currently holds pointer lock. */
  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /** Whether a physical key code is currently held down. */
  isKeyDown(code: string): boolean {
    return this.pressedKeyCodes.has(code);
  }

  /**
   * Return the mouse motion accumulated since the previous call and reset it,
   * so a frame's look is applied exactly once.
   */
  consumeMouseDelta(): MouseDelta {
    const delta: MouseDelta = { dx: this.accumulatedDx, dy: this.accumulatedDy };
    this.accumulatedDx = 0;
    this.accumulatedDy = 0;
    return delta;
  }

  /**
   * Drain the queued mouse presses. Each entry is one action; the caller maps
   * one press to one break or place and never sees a press twice.
   */
  consumeMousePresses(): readonly MouseButton[] {
    return this.queuedPresses.splice(0, this.queuedPresses.length);
  }

  /**
   * Drain the queued key presses (one entry per physical press, with OS key
   * repeat filtered out). Held state is sampled once per frame, so a press
   * that lands between two frames — or that is followed by focus loss — would
   * otherwise be lost; a one-shot action must be latched instead.
   */
  consumeKeyPresses(): readonly string[] {
    return this.queuedKeyPresses.splice(0, this.queuedKeyPresses.length);
  }

  /**
   * Release the pointer lock, handing the cursor back to the page. It is the
   * counterpart to `requestPointerLock` and, like it, the only pointer-lock
   * call in the game. An already-unlocked pointer, or a browser refusal, is
   * non-fatal.
   */
  releasePointerLock(): void {
    if (!this.pointerLocked) {
      return;
    }
    try {
      document.exitPointerLock();
    } catch {
      // Ignore: the browser declined or there was nothing to release.
    }
  }

  /**
   * Ask the browser to lock the pointer to the canvas. Refusal (for example
   * when not called from a user gesture) is non-fatal: the overlay stays up
   * and the next click tries again.
   */
  requestPointerLock(): void {
    if (this.pointerLocked) {
      return;
    }
    try {
      const result = this.canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) {
        void result.catch(() => {});
      }
    } catch {
      // Ignore: the browser declined the request.
    }
  }

  /** Remove every listener and drop all captured state. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.canvas.removeEventListener('click', this.onCanvasClick);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);

    this.pressedKeyCodes.clear();
    this.queuedPresses.length = 0;
    this.queuedKeyPresses.length = 0;
    this.accumulatedDx = 0;
    this.accumulatedDy = 0;
  }

  private readonly onCanvasClick = (): void => {
    this.requestPointerLock();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    // Right-click places blocks, so the browser menu must never appear.
    event.preventDefault();
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) {
      // Keys held at the moment of release would otherwise stay down.
      this.pressedKeyCodes.clear();
      this.accumulatedDx = 0;
      this.accumulatedDy = 0;
    }
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) {
      return;
    }
    this.accumulatedDx += event.movementX;
    this.accumulatedDy += event.movementY;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (!this.pointerLocked) {
      return;
    }
    if (event.button === 0) {
      this.queuedPresses.push('left');
    } else if (event.button === 2) {
      this.queuedPresses.push('right');
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!BOUND_KEY_CODES.has(event.code)) {
      return;
    }
    // Space would otherwise scroll the page while playing.
    event.preventDefault();
    this.pressedKeyCodes.add(event.code);
    // Latch the physical press so a toggle cannot be dropped when the key is
    // released (or focus is lost) before the next frame polls held state.
    // Key repeat is filtered so holding the key stays a single press.
    if (!event.repeat) {
      this.queuedKeyPresses.push(event.code);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeyCodes.delete(event.code);
  };

  private readonly onWindowBlur = (): void => {
    this.pressedKeyCodes.clear();
  };
}
