import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';

describe('config', () => {
  it('exposes a single source of tuning constants', () => {
    expect(config.maxFrameDeltaSeconds).toBeGreaterThan(0);
    expect(config.skyColor).toBeGreaterThanOrEqual(0);
    expect(config.skyColor).toBeLessThanOrEqual(0xffffff);
    expect(config.camera.fovDegrees).toBeGreaterThan(0);
    expect(config.camera.fovDegrees).toBeLessThan(180);
    expect(config.maxPixelRatio).toBeGreaterThanOrEqual(1);
  });
});
