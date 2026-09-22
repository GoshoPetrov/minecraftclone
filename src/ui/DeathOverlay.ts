/**
 * The "You died!" panel shown over the viewport while the avatar is dead.
 *
 * It is a dumb presenter over one page-owned element: it toggles visibility
 * and forwards the Respawn button's click to an explicit callback supplied by
 * orchestration. It attaches a listener only for that button, reads no game
 * systems, and holds no gameplay state, so it can be omitted and the game
 * still runs headless.
 */
export class DeathOverlay {
  private visible = false;
  private readonly button: HTMLButtonElement | null;

  constructor(
    private readonly element: HTMLElement,
    private readonly onRespawn: () => void,
  ) {
    this.button = element.querySelector<HTMLButtonElement>('[data-respawn]');
    this.button?.addEventListener('click', this.handleRespawn);
    // Starts hidden every session, regardless of the markup's initial state.
    this.element.hidden = true;
  }

  private readonly handleRespawn = (): void => {
    this.onRespawn();
  };

  /** Show or hide the overlay, ignoring redundant changes. */
  setVisible(visible: boolean): void {
    if (visible === this.visible) {
      return;
    }
    this.visible = visible;
    this.element.hidden = !visible;
  }

  /** Detach the Respawn listener. */
  dispose(): void {
    this.button?.removeEventListener('click', this.handleRespawn);
  }
}
