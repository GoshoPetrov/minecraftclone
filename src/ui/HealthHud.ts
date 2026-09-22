import { heartStates } from '../player/Vitals';

/**
 * Presenter for the avatar's health hearts.
 *
 * It is a dumb presenter over one page-owned element: it reads only plain
 * numbers, writes DOM, attaches no listeners, and holds no gameplay state.
 * The full/half/empty split is derived entirely by the pure `heartStates`
 * mapping, so this class only turns the result into elements.
 */
export class HealthHud {
  /** Last rendered hit-point value, used to ignore redundant updates. */
  private health: number | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly maxHealth: number,
  ) {}

  /**
   * Render `health` as hearts, doing nothing when the value is unchanged.
   * The maximum only scales the number of hearts and comes straight from the
   * central tuning configuration.
   */
  setHealth(health: number): void {
    if (health === this.health) {
      return;
    }
    this.health = health;
    this.element.replaceChildren(
      ...heartStates(health, this.maxHealth).map((state) => {
        const heart = document.createElement('span');
        heart.className = `heart heart--${state}`;
        return heart;
      }),
    );
  }
}
