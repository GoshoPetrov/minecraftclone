import { describe, expect, it } from 'vitest';

import { Prng } from '../world/Prng';

function sequence(seed: number, count: number): number[] {
  const prng = new Prng(seed);
  return Array.from({ length: count }, () => prng.nextUint32());
}

describe('Prng', () => {
  it('produces an identical sequence for the same seed', () => {
    expect(sequence(12345, 32)).toEqual(sequence(12345, 32));
  });

  it('produces a different sequence for a different seed', () => {
    expect(sequence(12345, 32)).not.toEqual(sequence(54321, 32));
  });

  it('keeps raw values within the 32-bit unsigned range', () => {
    const prng = new Prng(7);

    for (let i = 0; i < 1000; i += 1) {
      const value = prng.nextUint32();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('keeps floats within [0, 1)', () => {
    const prng = new Prng(99);

    for (let i = 0; i < 1000; i += 1) {
      const value = prng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads values across the range instead of returning a constant', () => {
    const values = new Set(sequence(42, 256));

    expect(values.size).toBeGreaterThan(200);
  });

  it('rejects seeds outside the 32-bit unsigned range', () => {
    expect(() => new Prng(-1)).toThrow();
    expect(() => new Prng(1.5)).toThrow();
    expect(() => new Prng(0x1_0000_0000)).toThrow();
    expect(() => new Prng(Number.NaN)).toThrow();
  });
});
