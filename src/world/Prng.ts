/**
 * Deterministic 32-bit pseudo-random number generator (mulberry32).
 *
 * Terrain generation must be reproducible from a seed, so `Math.random` is
 * never used. One instance is created per world and every generated value is
 * drawn from it, which is what makes a world reconstructable rather than
 * something that has to be stored block by block.
 *
 * The algorithm is intentionally tiny and fully specified by arithmetic on
 * 32-bit integers: the same seed always yields the same sequence.
 */
export class Prng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new Error(`PRNG seed must be a 32-bit unsigned integer, received ${seed}.`);
    }
    this.state = seed >>> 0;
  }

  /** The next raw value in `[0, 2^32)`. */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** The next value in `[0, 1)` with 32 bits of precision. */
  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }
}
