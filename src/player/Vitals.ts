import { config } from '../config/Config';

/**
 * Transient avatar vitals.
 *
 * Health is deliberately **not** part of `PlayerState`: `PlayerState` is the
 * movement/collision state that the pure `step` reads and produces, while
 * vitals are a separate value owned beside it by application orchestration.
 * This module is pure, DOM-free, and renderer-free so health, damage, and the
 * hearts mapping can be simulated and tested headlessly.
 *
 * Later tickets extend the value with the cross-frame fall and void state
 * (`fallDistance`, `inVoid`, `voidDamageTimer`); this ticket establishes the
 * health value and the full/half/empty mapping only.
 */

/** The avatar's transient condition. Never written to the save file. */
export interface VitalsState {
  /** Remaining hit points, always within `[0, maxHealth]`. */
  readonly health: number;
}

/** One heart's worth of health, as rendered in the HUD. */
export type HeartState = 'full' | 'half' | 'empty';

/**
 * Constrain a hit-point value to the valid range so it can never become
 * negative or non-finite. A non-finite input collapses to the nearest bound
 * (`NaN` to zero), and a non-positive or non-finite maximum yields zero.
 */
export function clampHealth(health: number, maxHealth: number): number {
  if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
    return 0;
  }
  if (!Number.isFinite(health)) {
    return health > 0 ? maxHealth : 0;
  }
  return Math.min(maxHealth, Math.max(0, health));
}

/** A fresh avatar at full health. */
export function createVitals(): VitalsState {
  return { health: config.player.maxHealth };
}

/** Whether the avatar has died. True exactly at zero (and never below). */
export function isDead(vitals: VitalsState): boolean {
  return vitals.health <= 0;
}

/**
 * Map a hit-point value onto the HUD's hearts.
 *
 * Each heart is worth two hit points and renders `full` at 2 HP, `half` at
 * 1 HP, and `empty` at 0 HP, so an odd remaining value produces exactly one
 * half heart. The result is exactly `maxHealth / 2` hearts long; health is
 * clamped first, so the mapping is total for any input.
 */
export function heartStates(health: number, maxHealth: number): readonly HeartState[] {
  const clamped = clampHealth(health, maxHealth);
  const heartCount = Math.max(0, Math.ceil(maxHealth / 2));
  const states: HeartState[] = [];
  for (let index = 0; index < heartCount; index += 1) {
    const remaining = clamped - index * 2;
    states.push(remaining >= 2 ? 'full' : remaining >= 1 ? 'half' : 'empty');
  }
  return states;
}
