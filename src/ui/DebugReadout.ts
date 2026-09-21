import type { Vec3 } from '../player/Player';

/**
 * Render a position as the single labelled debug line, one decimal per
 * component, e.g. `{ x: 12.5, y: 24, z: -3.5 }` → `XYZ: 12.5 / 24.0 / -3.5`.
 *
 * Pure and DOM-free so the display contract can be unit-tested headlessly.
 */
export function formatDebugPosition(position: Vec3): string {
  return `XYZ: ${position.x.toFixed(1)} / ${position.y.toFixed(1)} / ${position.z.toFixed(1)}`;
}

/**
 * Diagnostic readout shown in the corner of the viewport.
 *
 * It is a dumb presenter over one page-owned element: it attaches no
 * listeners, reads no game systems, and holds no gameplay state. Redundant
 * visibility changes and identical text are ignored so a stationary player
 * causes no per-frame DOM mutation.
 */
export class DebugReadout {
  private visible = false;
  private text = '';

  constructor(private readonly element: HTMLElement) {
    // Starts hidden every session, regardless of the markup's initial state.
    this.element.hidden = true;
  }

  /** Show or hide the readout, ignoring redundant changes. */
  setVisible(visible: boolean): void {
    if (visible === this.visible) {
      return;
    }
    this.visible = visible;
    this.element.hidden = !visible;
  }

  /** Replace the readout text only when it actually changed. */
  setText(text: string): void {
    if (text === this.text) {
      return;
    }
    this.text = text;
    this.element.textContent = text;
  }
}
