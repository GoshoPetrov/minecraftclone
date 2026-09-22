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
    expect(vitals.fallStartY).toBeNull();
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
  /**
   * Drop from `takeoffY` to `landingY`. The takeoff frame records the anchor
   * (previous grounded, next airborne); the landing frame measures the net
   * delta from that anchor.
   */
  function fall(takeoffY: number, landingY: number): VitalsState {
    const airborne = updateVitals(
      createVitals(),
      player(takeoffY, true),
      player(takeoffY, false),
      1 / 60,
    );
    return updateVitals(airborne, player(takeoffY, false), player(landingY, true), 1 / 60);
  }

  it('is safe for a fall of exactly the configured safe distance', () => {
    const result = fall(SAFE_FALL_DISTANCE, 0);

    expect(result.health).toBe(MAX_HEALTH);
    expect(result.fallStartY).toBeNull();
  });

  it('costs at least one hit point for 3.1 and 4.0 block falls', () => {
    const justPast = fall(SAFE_FALL_DISTANCE + 0.1, 0);
    const wholeDrop = fall(SAFE_FALL_DISTANCE + 1, 0);

    expect(MAX_HEALTH - justPast.health).toBeGreaterThanOrEqual(1);
    expect(MAX_HEALTH - wholeDrop.health).toBeGreaterThanOrEqual(1);
    // The ceil rule means a 3.1 and a 4.0 block fall cost the same one block.
    expect(MAX_HEALTH - justPast.health).toBe(FALL_DAMAGE_PER_BLOCK);
    expect(justPast.health).toBe(wholeDrop.health);
  });

  it('scales damage with the whole blocks past the safe distance', () => {
    // 9 blocks fallen -> ceil(9) - 3 = 6 blocks of damage.
    const result = fall(9, 0);

    expect(result.health).toBe(MAX_HEALTH - 6 * FALL_DAMAGE_PER_BLOCK);
  });

  it('anchors the fall at takeoff and ignores the upward arc', () => {
    const takeoff = updateVitals(createVitals(), player(4, true), player(5.29, false), 1 / 60);
    expect(takeoff.fallStartY).toBe(4);

    // A higher apex never moves the anchor or costs health.
    const rising = updateVitals(takeoff, player(5.29, false), player(6, false), 1 / 60);
    expect(rising.fallStartY).toBe(4);
    expect(rising.health).toBe(MAX_HEALTH);
  });

  it('clears the anchor on any grounded frame', () => {
    const result = updateVitals(
      { ...createVitals(), fallStartY: 5 },
      player(4, true),
      player(4, true),
      1 / 60,
    );

    expect(result.fallStartY).toBeNull();
  });

  it('a plain jump rises and falls back without damage', () => {
    // Rise from the ground, peak, then fall back to the same height.
    let vitals = createVitals();
    vitals = updateVitals(vitals, player(4, true), player(5.29, false), 1 / 60);
    vitals = updateVitals(vitals, player(5.29, false), player(5.29, false), 1 / 60);
    vitals = updateVitals(vitals, player(5.29, false), player(4, true), 1 / 60);

    expect(vitals.health).toBe(MAX_HEALTH);
    expect(vitals.fallStartY).toBeNull();
  });

  it('measures a jump off a ledge from takeoff, not the apex', () => {
    // Jump from a ledge at y = 10 with an apex of 11.29, then land at y = 4.
    // The anchor is the ledge, so the drop is the 6 blocks actually lost,
    // not the 7.29 blocks below the apex.
    let vitals = createVitals();
    vitals = updateVitals(vitals, player(10, true), player(11.29, false), 1 / 60);
    vitals = updateVitals(vitals, player(11.29, false), player(4, true), 1 / 60);

    expect(vitals.health).toBe(MAX_HEALTH - 3 * FALL_DAMAGE_PER_BLOCK);
    expect(vitals.fallStartY).toBeNull();
  });

  it('costs the same to jump off a ledge as to walk off it', () => {
    const walkedOff = fall(10, 4);
    let jumped = createVitals();
    jumped = updateVitals(jumped, player(10, true), player(11.29, false), 1 / 60);
    jumped = updateVitals(jumped, player(11.29, false), player(4, true), 1 / 60);

    expect(jumped.health).toBe(walkedOff.health);
  });

  it('includes the landing frame in the delta before resetting', () => {
    // Take off at 3.2 and land at 0. The final frame from 0.2 to 0 is only
    // 0.2 blocks, but the takeoff anchor makes the measured fall 3.2.
    const airborne = updateVitals(
      createVitals(),
      player(3.2, true),
      player(3.2, false),
      1 / 60,
    );
    const result = updateVitals(airborne, player(0.2, false), player(0, true), 1 / 60);

    expect(result.health).toBe(MAX_HEALTH - FALL_DAMAGE_PER_BLOCK);
    expect(result.fallStartY).toBeNull();
  });

  it('costs nothing when landing at or above the takeoff height', () => {
    const level = fall(4, 4);
    expect(level.health).toBe(MAX_HEALTH);
    expect(level.fallStartY).toBeNull();

    const higher = fall(4, 6);
    expect(higher.health).toBe(MAX_HEALTH);
    expect(higher.fallStartY).toBeNull();
  });

  it('seeds an already-airborne start so a mid-air spawn is measured', () => {
    // An update that observes the avatar already airborne records previous.y.
    const airborne = updateVitals(createVitals(), player(15, false), player(14, false), 1 / 60);
    expect(airborne.fallStartY).toBe(15);

    // 11 blocks from the seeded anchor -> ceil(11) - 3 = 8 damage.
    const landed = updateVitals(airborne, player(14, false), player(4, true), 1 / 60);
    expect(landed.health).toBe(MAX_HEALTH - 8 * FALL_DAMAGE_PER_BLOCK);
    expect(landed.fallStartY).toBeNull();
  });

  it('clears the fall when a landing has no recorded start', () => {
    const landed = updateVitals(createVitals(), player(15, false), player(4, true), 1 / 60);

    expect(landed.health).toBe(MAX_HEALTH);
    expect(landed.fallStartY).toBeNull();
  });

  it('resets on landing so repeated short hops never add up', () => {
    let vitals = createVitals();
    for (let hop = 0; hop < 5; hop += 1) {
      // Each hop is two blocks up and two back down, then lands.
      vitals = updateVitals(vitals, player(4, true), player(6, false), 1 / 60);
      vitals = updateVitals(vitals, player(6, false), player(6, false), 1 / 60);
      vitals = updateVitals(vitals, player(6, false), player(4, true), 1 / 60);
      expect(vitals.fallStartY).toBeNull();
    }

    expect(vitals.health).toBe(MAX_HEALTH);
  });

  it('clamps lethal damage at zero and reports death', () => {
    const result = fall(MAX_HEALTH + SAFE_FALL_DISTANCE + 5, 0);

    expect(result.health).toBe(0);
    expect(isDead(result)).toBe(true);
    expect(Number.isFinite(result.health)).toBe(true);
  });

  it('is unaffected by crouching, sprinting, or the airborne label', () => {
    const plain = fall(8, 0);
    const posed = updateVitals(
      updateVitals(
        createVitals(),
        { ...player(8, true), crouching: true, movement: 'sprinting' },
        { ...player(8, false), crouching: true, movement: 'sprinting' },
        1 / 60,
      ),
      { ...player(8, false), crouching: true, movement: 'sprinting' },
      { ...player(0, true), crouching: true, movement: 'sneaking' },
      1 / 60,
    );

    expect(posed.health).toBe(plain.health);
    expect(posed.fallStartY).toBe(plain.fallStartY);
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

    expect(vitals.fallStartY).not.toBeNull();
    expect(vitals.health).toBe(MAX_HEALTH - 2 * VOID_DAMAGE);
    expect(vitals.inVoid).toBe(true);
  });
});
