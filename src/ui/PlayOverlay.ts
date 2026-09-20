/**
 * The click-to-play overlay shown whenever pointer lock is not held.
 *
 * It only toggles visibility of an element owned by the page; it attaches no
 * listeners and holds no game state. Clicks pass through it to the canvas
 * (see the overlay's CSS), so clicking the hint also captures the pointer.
 */
export class PlayOverlay {
  private visible = false;

  constructor(private readonly element: HTMLElement) {
    this.setVisible(true);
  }

  /** Show or hide the overlay, ignoring redundant changes. */
  setVisible(visible: boolean): void {
    if (visible === this.visible) {
      return;
    }
    this.visible = visible;
    this.element.hidden = !visible;
  }
}
