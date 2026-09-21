import { describe, expect, it } from 'vitest';

import { formatDebugPosition } from '../ui/DebugReadout';

describe('formatDebugPosition', () => {
  it('labels the line and orders components X, Y, Z separated by " / "', () => {
    expect(formatDebugPosition({ x: 12.5, y: 24, z: -3.5 })).toBe(
      'XYZ: 12.5 / 24.0 / -3.5',
    );
  });

  it('renders every integer component to exactly one decimal place', () => {
    expect(formatDebugPosition({ x: 0, y: 1, z: 2 })).toBe('XYZ: 0.0 / 1.0 / 2.0');
  });

  it('renders negative components with a leading minus sign', () => {
    expect(formatDebugPosition({ x: -12.34, y: -0.5, z: -100 })).toBe(
      'XYZ: -12.3 / -0.5 / -100.0',
    );
  });
});
