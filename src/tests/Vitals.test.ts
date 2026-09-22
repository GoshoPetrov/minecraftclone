import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import { clampHealth, createVitals, heartStates, isDead } from '../player/Vitals';

const MAX_HEALTH = config.player.maxHealth;
const HEART_COUNT = MAX_HEALTH / 2;

describe('createVitals', () => {
  it('starts the avatar at full health', () => {
    const vitals = createVitals();

    expect(vitals.health).toBe(20);
    expect(vitals.health).toBe(MAX_HEALTH);
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
    expect(isDead({ health: 0 })).toBe(true);
    expect(isDead({ health: 1 })).toBe(false);
    expect(isDead({ health: MAX_HEALTH })).toBe(false);
  });
});
