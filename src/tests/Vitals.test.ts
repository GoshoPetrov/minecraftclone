import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import { type PlayerState } from '../player/Player';
import {
  clampHealth,
  createVitals,
  heartStates,
  isDead,
  updateVitals,
  type VitalsState,
} from '../player/Vitals';

const MAX_HEALTH = config.player.maxHealth;
const HEART_COUNT = MAX_HEALTH / 2;
const SAFE_FALL_DISTANCE = config.player.safeFallDistance;
const FALL_DAMAGE_PER_BLOCK = config.player.fallDamagePerBlock;
const VOID_Y = config.player.voidY;
const VOID_DAMAGE = config.player.voidDamage;
const VOID_INTERVAL = config.player.voidDamageIntervalSeconds;

/** A player state at `y`, grounded or airborne, with no horizontal motion. */
function player(y: number, grounded: boolean): PlayerState {
  return {
    position: { x: 0, y, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    grounded,
    crouching: false,
    movement: grounded ? 'idle' : 'airborne',
  };
}

describe('createVitals', () => {
  it('starts the avatar at full health', () => {
    const vitals = createVitals();

    expect(vitals.health).toBe(20);
    expect(vitals.health).toBe(MAX_HEALTH);
    expect(vitals.fallDistance).toBe(0);
    expect(vitals.inVoid).toBe(false);
    expect(vitals.voidDamageTimer).toBe(0);
    expect(isDead(vitals)).toBe(false);
  });
});

describe('heartStates', () => {
  it('returns exactly ten hearts for the configured maximum', () => {
    expect(HEART_COUNT).toBe(10);
    expect(heartStates(MAX_HEALTH, MAX_HEALTH)).toHaveLength(10);
  });

  it('renders every heart full at full health', () => {
    expect(heartStates(MAX_HEALTH, MAX_HEALTH)).toEqual(Array(10).fill('full'));
  });

  it('renders every heart empty at zero health', () => {
    expect(heartStates(0, MAX_HEALTH)).toEqual(Array(10).fill('empty'));
  });

  it('renders whole hearts for even health', () => {
    const states = heartStates(4, MAX_HEALTH);

    expect(states).toEqual([
      'full',
      'full',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
    ]);
  });

  it('renders exactly one half heart for an odd hit-point value', () => {
    const states = heartStates(19, MAX_HEALTH);

    expect(states).toHaveLength(10);
    expect(states.filter((state) => state === 'full')).toHaveLength(9);
    expect(states.filter((state) => state === 'half')).toHaveLength(1);
    expect(states[8]).toBe('full');
    expect(states[9]).toBe('half');
  });

  it('renders a leading half heart for a single hit point', () => {
    const states = heartStates(1, MAX_HEALTH);

    expect(states[0]).toBe('half');
    expect(states.slice(1)).toEqual(Array(9).fill('empty'));
  });

  it('clamps health before mapping, so out-of-range values stay valid', () => {
    expect(heartStates(MAX_HEALTH + 6, MAX_HEALTH)).toEqual(Array(10).fill('full'));
    expect(heartStates(-4, MAX_HEALTH)).toEqual(Array(10).fill('empty'));
    expect(heartStates(Number.NaN, MAX_HEALTH)).toEqual(Array(10).fill('empty'));
  });
});

describe('clampHealth', () => {
  it('clamps into [0, maxHealth]', () => {
    expect(clampHealth(-5, 20)).toBe(0);
    expect(clampHealth(25, 20)).toBe(20);
    expect(clampHealth(7, 20)).toBe(7);
  });

  it('never returns a non-finite value', () => {
    expect(Number.isFinite(clampHealth(Number.NaN, 20))).toBe(true);
    expect(Number.isFinite(clampHealth(Number.POSITIVE_INFINITY, 20))).toBe(true);
    expect(Number.isFinite(clampHealth(Number.NEGATIVE_INFINITY, 20))).toBe(true);
  });
});

describe('isDead', () => {
  it('is true exactly at zero health', () => {
    expect(isDead({ ...createVitals(), health: 0 })).toBe(true);
    expect(isDead({ ...createVitals(), health: 1 })).toBe(false);
    expect(isDead({ ...createVitals(), health: MAX_HEALTH })).toBe(false);
  });
});

describe('updateVitals fall damage', () => {
  /** Land after falling `distance` blocks with an optional carried total. */
  function land(distance: number, carried = 0): VitalsState {
    const previous = player(distance, false);
    const next = player(0, true);
    return updateVitals({ ...createVitals(), fallDistance: carried }, previous, next, 1 / 60);
  }

  it('is safe for a fall of exactly the configured safe distance', () => {
    // Rebuild the fall so the distance is exactly the safe threshold.
    const start = player(SAFE_FALL_DISTANCE, false);
    const landed = player(0, true);

    const result = updateVitals(createVitals(), start, landed, 1 / 60);

    expect(result.health).toBe(MAX_HEALTH);
    expect(result.fallDistance).toBe(0);
  });

  it('costs at least one hit point for 3.1 and 4.0 block falls', () => {
    const justPast = land(SAFE_FALL_DISTANCE + 0.1);
    const wholeDrop = land(SAFE_FALL_DISTANCE + 1);

    expect(MAX_HEALTH - justPast.health).toBeGreaterThanOrEqual(1);
    expect(MAX_HEALTH - wholeDrop.health).toBeGreaterThanOrEqual(1);
    // The ceil rule means a 3.1 and a 4.0 block fall cost the same one block.
    expect(MAX_HEALTH - justPast.health).toBe(FALL_DAMAGE_PER_BLOCK);
    expect(justPast.health).toBe(wholeDrop.health);
  });

  it('scales damage with the whole blocks past the safe distance', () => {
    // 9 blocks fallen -> ceil(9) - 3 = 6 blocks of damage.
    const result = land(9);

    expect(result.health).toBe(MAX_HEALTH - 6 * FALL_DAMAGE_PER_BLOCK);
  });

  it('accumulates only downward displacement while airborne', () => {
    const rising = updateVitals(createVitals(), player(0, false), player(2, false), 1 / 60);
    expect(rising.fallDistance).toBe(0);

    const falling = updateVitals(
      { ...createVitals(), fallDistance: 3 },
      player(2, false),
      player(1, false),
      1 / 60,
    );
    expect(falling.fallDistance).toBe(4);
    expect(falling.health).toBe(MAX_HEALTH);
  });

  it('contributes nothing to fall distance while grounded', () => {
    const result = updateVitals(
      { ...createVitals(), fallDistance: 5 },
      player(4, true),
      player(4, true),
      1 / 60,
    );

    expect(result.fallDistance).toBe(0);
  });

  it('a plain jump rises and falls back without damage', () => {
    // Rise from the ground, peak, then fall back to the same height.
    let vitals = createVitals();
    vitals = updateVitals(vitals, player(4, true), player(5.29, false), 1 / 60);
    vitals = updateVitals(vitals, player(5.29, false), player(5.29, false), 1 / 60);
    vitals = updateVitals(vitals, player(5.29, false), player(4, true), 1 / 60);

    expect(vitals.health).toBe(MAX_HEALTH);
    expect(vitals.fallDistance).toBe(0);
  });

  it('measures a jump off a ledge from the apex, not the takeoff height', () => {
    // Jump from a ledge at y = 10 with an apex of 11.29, then land at y = 4.
    // The rise contributes nothing, so the drop is 7.29 blocks, not the 6
    // blocks between the ledge and the ground.
    let vitals = createVitals();
    vitals = updateVitals(vitals, player(10, true), player(11.29, false), 1 / 60);
    vitals = updateVitals(vitals, player(11.29, false), player(4, true), 1 / 60);

    expect(vitals.health).toBe(MAX_HEALTH - 5 * FALL_DAMAGE_PER_BLOCK);
    expect(vitals.fallDistance).toBe(0);
  });

  it('applies the final downward slice before measuring, then resets', () => {
    // 2.9 carried + 0.2 on the landing frame crosses the threshold; measuring
    // only the carried total (2.9) would be free.
    const result = updateVitals(
      { ...createVitals(), fallDistance: 2.9 },
      player(4.2, false),
      player(4, true),
      1 / 60,
    );

    expect(result.health).toBe(MAX_HEALTH - FALL_DAMAGE_PER_BLOCK);
    expect(result.fallDistance).toBe(0);
  });

  it('resets the accumulator on landing so repeated short hops never add up', () => {
    let vitals = createVitals();
    for (let hop = 0; hop < 5; hop += 1) {
      // Each hop is two blocks up and two back down, then lands.
      vitals = updateVitals(vitals, player(4, true), player(6, false), 1 / 60);
      vitals = updateVitals(vitals, player(6, false), player(6, false), 1 / 60);
      vitals = updateVitals(vitals, player(6, false), player(4, true), 1 / 60);
      expect(vitals.fallDistance).toBe(0);
    }

    expect(vitals.health).toBe(MAX_HEALTH);
  });

  it('clamps lethal damage at zero and reports death', () => {
    const result = land(MAX_HEALTH + SAFE_FALL_DISTANCE + 5);

    expect(result.health).toBe(0);
    expect(isDead(result)).toBe(true);
    expect(Number.isFinite(result.health)).toBe(true);
  });

  it('is unaffected by crouching, sprinting, or the airborne label', () => {
    const plain = land(8);
    const posed = updateVitals(
      createVitals(),
      { ...player(8, false), crouching: true, movement: 'sprinting' },
      { ...player(0, true), crouching: true, movement: 'sneaking' },
      1 / 60,
    );

    expect(posed.health).toBe(plain.health);
    expect(posed.fallDistance).toBe(plain.fallDistance);
  });
});

describe('updateVitals void damage', () => {
  /**
   * Advance one frame while staying below the threshold: a fixed pair of
   * airborne states with the feet below `voidY`, so only the void rule fires.
   */
  function tickInVoid(vitals: VitalsState, dt: number): VitalsState {
    return updateVitals(
      vitals,
      player(VOID_Y - 1, false),
      player(VOID_Y - 1, false),
      dt,
    );
  }

  it('never damages the avatar at or above the threshold', () => {
    const highUp = updateVitals(createVitals(), player(40, false), player(30, false), 1 / 60);
    expect(highUp.health).toBe(MAX_HEALTH);
    expect(highUp.inVoid).toBe(false);

    // Exactly at the threshold is not yet in the void; one block lower is.
    const atThreshold = updateVitals(
      createVitals(),
      player(VOID_Y + 1, false),
      player(VOID_Y, false),
      1 / 60,
    );
    expect(atThreshold.health).toBe(MAX_HEALTH);
    expect(atThreshold.inVoid).toBe(false);
  });

  it('lands the first tick immediately on crossing the threshold', () => {
    const result = updateVitals(
      createVitals(),
      player(VOID_Y, false),
      player(VOID_Y - 0.1, false),
      1 / 60,
    );

    expect(result.health).toBe(MAX_HEALTH - VOID_DAMAGE);
    expect(result.inVoid).toBe(true);
    expect(result.voidDamageTimer).toBe(VOID_INTERVAL);
  });

  it('ticks again only once the configured interval has elapsed', () => {
    // 0.125s divides the configured interval exactly, so the cadence is not
    // exposed to floating-point drift.
    const dt = 0.125;
    const framesPerInterval = Math.round(VOID_INTERVAL / dt);
    expect(framesPerInterval).toBeGreaterThan(0);

    let vitals = tickInVoid(createVitals(), dt);
    expect(vitals.health).toBe(MAX_HEALTH - VOID_DAMAGE);

    // One frame short of the interval: no second tick yet.
    for (let frame = 1; frame < framesPerInterval; frame += 1) {
      vitals = tickInVoid(vitals, dt);
    }
    expect(vitals.health).toBe(MAX_HEALTH - VOID_DAMAGE);

    // The next frame completes the interval and lands the second tick.
    vitals = tickInVoid(vitals, dt);
    expect(vitals.health).toBe(MAX_HEALTH - 2 * VOID_DAMAGE);
  });

  it('resets the timer on leaving so a later re-entry ticks immediately', () => {
    const dt = 0.125;
    // Enter (immediate tick) and burn two frames of the next interval.
    let vitals = tickInVoid(createVitals(), dt);
    vitals = tickInVoid(vitals, dt);
    vitals = tickInVoid(vitals, dt);
    expect(vitals.voidDamageTimer).toBeGreaterThan(0);

    // Rise back to exactly the threshold: the void state clears.
    vitals = updateVitals(
      vitals,
      player(VOID_Y - 1, false),
      player(VOID_Y, false),
      dt,
    );
    expect(vitals.inVoid).toBe(false);
    expect(vitals.voidDamageTimer).toBe(0);

    // Re-entering ignores the leftover time and ticks on the first frame.
    vitals = tickInVoid(vitals, dt);
    expect(vitals.health).toBe(MAX_HEALTH - 2 * VOID_DAMAGE);
    expect(vitals.inVoid).toBe(true);
  });

  it('keeps ticking until it is lethal from full health', () => {
    let vitals = createVitals();
    let frames = 0;
    while (!isDead(vitals) && frames < 10_000) {
      vitals = tickInVoid(vitals, 0.125);
      frames += 1;
    }

    expect(isDead(vitals)).toBe(true);
    expect(vitals.health).toBe(0);
  });

  it('clamps a lethal tick at zero even for tiny remaining health', () => {
    const nearlyDead: VitalsState = { ...createVitals(), health: 1 };
    const result = tickInVoid(nearlyDead, 0.125);

    expect(result.health).toBe(0);
    expect(isDead(result)).toBe(true);
    expect(Number.isFinite(result.health)).toBe(true);
  });

  it('applies only void damage during a plunge that never lands', () => {
    // A long airborne drop that stays below the threshold accumulates fall
    // distance but never triggers the landing branch, so its health loss is
    // exactly the void ticks.
    let vitals = createVitals();
    for (let frame = 0; frame < 8; frame += 1) {
      vitals = updateVitals(
        vitals,
        player(VOID_Y - 1 - frame, false),
        player(VOID_Y - 2 - frame, false),
        0.125,
      );
    }

    expect(vitals.fallDistance).toBeGreaterThan(0);
    expect(vitals.health).toBe(MAX_HEALTH - 2 * VOID_DAMAGE);
    expect(vitals.inVoid).toBe(true);
  });
});
