import { config } from '../config/Config';
import type { PlayerState } from './Player';

/**
 * Transient avatar vitals.
 *
 * Health is deliberately **not** part of `PlayerState`: `PlayerState` is the
 * movement/collision state that the pure `step` reads and produces, while
 * vitals are a separate value owned beside it by application orchestration.
 * This module is pure, DOM-free, and renderer-free so health, damage, and the
 * hearts mapping can be simulated and tested headlessly.
 *
 * Later tickets extend the value with the cross-frame void state (`inVoid`,
 * `voidDamageTimer`); this ticket adds the fall-distance accumulator and the
 * landing damage rule.
 */

/** The avatar's transient condition. Never written to the save file. */
export interface VitalsState {
  /** Remaining hit points, always within `[0, maxHealth]`. */
  readonly health: number;
  /**
   * Blocks accumulated while airborne since the avatar last left the ground.
   * Only downward displacement counts, so the rise of a jump contributes
   * nothing and a jump off a ledge is measured from its apex. It is reset to
   * zero on landing and while grounded.
   */
  readonly fallDistance: number;
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

/** A fresh avatar at full health, grounded, with no fall accumulated. */
export function createVitals(): VitalsState {
  return { health: config.player.maxHealth, fallDistance: 0 };
}

/** Whether the avatar has died. True exactly at zero (and never below). */
export function isDead(vitals: VitalsState): boolean {
  return vitals.health <= 0;
}

/**
 * Advance the avatar's vitals by one frame.
 *
 * Fall distance accumulates only while the **previous** state was airborne
 * and only for downward displacement (`max(0, previous.y - next.y)`), so the
 * upward arc of a jump contributes nothing and a jump off a ledge is measured
 * from its apex. When a frame crosses from airborne to grounded, the final
 * slice of downward movement is added before the total is measured, damage is
 * applied as a whole number of hit points, and the accumulator resets. While
 * grounded the accumulator is held at zero, so a walk off a ledge starts from
 * zero and repeated short hops never add up.
 *
 * This function owns every fall and damage rule; orchestration only supplies
 * the states and reads the result. It is pure and total: the inputs are never
 * mutated, and the returned health is always clamped to `[0, maxHealth]`.
 * `dt` is unused by the fall rule (it is reserved for the void timer).
 */
export function updateVitals(
  vitals: VitalsState,
  previous: PlayerState,
  next: PlayerState,
  _dt: number,
): VitalsState {
  const wasAirborne = !previous.grounded;
  // The previous state decides whether this slice counts: once grounded the
  // accumulator is cleared, and only airborne downward movement accrues.
  let fallDistance = wasAirborne
    ? vitals.fallDistance + Math.max(0, previous.position.y - next.position.y)
    : 0;

  let health = vitals.health;
  if (wasAirborne && next.grounded) {
    health = clampHealth(health - fallDamage(fallDistance), config.player.maxHealth);
    fallDistance = 0;
  }

  return { health, fallDistance };
}

/**
 * Hit points lost by landing after `fallDistance` blocks of falling. The
 * distance is rounded up first, so any drop past the safe distance costs at
 * least one hit point, and the result is always a whole number.
 */
function fallDamage(fallDistance: number): number {
  if (!Number.isFinite(fallDistance)) {
    return 0;
  }
  const blocksBeyondSafe = Math.max(
    0,
    Math.ceil(fallDistance) - config.player.safeFallDistance,
  );
  return blocksBeyondSafe * config.player.fallDamagePerBlock;
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
