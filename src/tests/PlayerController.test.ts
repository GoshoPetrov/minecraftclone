import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import {
  PlayerController,
  idleMovementInput,
  type MovementInput,
} from '../player/PlayerController';

/** Pixels of horizontal mouse motion that rotate the view by `radians`. */
function pixelsFor(radians: number): number {
  return radians / config.camera.lookSensitivity;
}

function input(overrides: Partial<MovementInput> = {}): MovementInput {
  return { ...idleMovementInput(), ...overrides };
}

describe('PlayerController look', () => {
  it('starts looking straight ahead', () => {
    const controller = new PlayerController();

    expect(controller.orientation.yaw).toBe(0);
    expect(controller.orientation.pitch).toBe(0);
  });

  it('rotates horizontally without limit and wraps a full turn', () => {
    const controller = new PlayerController();
    const fullTurn = Math.PI * 2 / config.camera.lookSensitivity;

    controller.applyLook({ dx: -fullTurn, dy: 0 });

    expect(Number.isFinite(controller.orientation.yaw)).toBe(true);
    expect(controller.orientation.yaw).toBeGreaterThan(-Math.PI - 1e-9);
    expect(controller.orientation.yaw).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  it('clamps pitch at the configured limit in both directions', () => {
    const controller = new PlayerController();

    controller.applyLook({ dx: 0, dy: -100000 });
    expect(controller.orientation.pitch).toBeCloseTo(config.camera.maxPitchRadians, 9);
    expect(controller.orientation.pitch).toBeLessThan(Math.PI / 2);

    controller.applyLook({ dx: 0, dy: 100000 });
    expect(controller.orientation.pitch).toBeCloseTo(-config.camera.maxPitchRadians, 9);
    expect(controller.orientation.pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it('ignores non-finite mouse motion', () => {
    const controller = new PlayerController();

    controller.applyLook({ dx: Number.NaN, dy: Number.POSITIVE_INFINITY });

    expect(controller.orientation).toEqual({ yaw: 0, pitch: 0 });
  });

  it('turns right when the mouse moves right', () => {
    const controller = new PlayerController();

    controller.applyLook({ dx: pixelsFor(Math.PI / 2), dy: 0 });

    expect(controller.orientation.yaw).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('PlayerController movement intent', () => {
  it('walks toward -Z when pressing forward at yaw 0', () => {
    const controller = new PlayerController();

    const intent = controller.intent(input({ forward: true }));

    expect(intent.move.x).toBeCloseTo(0, 9);
    expect(intent.move.z).toBeCloseTo(-1, 9);
    expect(intent.jump).toBe(false);
  });

  it('walks toward +Z when pressing backward at yaw 0', () => {
    const controller = new PlayerController();

    const intent = controller.intent(input({ backward: true }));

    expect(intent.move.z).toBeCloseTo(1, 9);
  });

  it('strafes toward +X when pressing right at yaw 0', () => {
    const controller = new PlayerController();

    const intent = controller.intent(input({ right: true }));

    expect(intent.move.x).toBeCloseTo(1, 9);
    expect(intent.move.z).toBeCloseTo(0, 9);
  });

  it('moves relative to facing after turning a quarter turn', () => {
    const controller = new PlayerController();
    controller.applyLook({ dx: pixelsFor(Math.PI / 2), dy: 0 });

    const intent = controller.intent(input({ forward: true }));

    expect(intent.move.x).toBeCloseTo(1, 9);
    expect(intent.move.z).toBeCloseTo(0, 9);
  });

  it('combines forward and strafe without forcing a normalized length', () => {
    const controller = new PlayerController();

    const intent = controller.intent(input({ forward: true, right: true }));

    expect(intent.move.x).toBeGreaterThan(0);
    expect(intent.move.z).toBeLessThan(0);
  });

  it('passes the jump button through to the intent', () => {
    const controller = new PlayerController();

    expect(controller.intent(input({ jump: true })).jump).toBe(true);
    expect(controller.intent(idleMovementInput()).jump).toBe(false);
  });

  it('produces no movement when nothing is held', () => {
    const controller = new PlayerController();

    const intent = controller.intent(idleMovementInput());

    expect(intent.move.x).toBeCloseTo(0, 9);
    expect(intent.move.z).toBeCloseTo(0, 9);
  });
});

describe('PlayerController look direction', () => {
  it('looks down -Z when facing straight ahead', () => {
    const controller = new PlayerController();

    const dir = controller.lookDirection;

    expect(dir.x).toBeCloseTo(0, 9);
    expect(dir.y).toBeCloseTo(0, 9);
    expect(dir.z).toBeCloseTo(-1, 9);
  });

  it('turns toward +X on a right quarter turn', () => {
    const controller = new PlayerController();
    controller.applyLook({ dx: pixelsFor(Math.PI / 2), dy: 0 });

    const dir = controller.lookDirection;

    expect(dir.x).toBeCloseTo(1, 9);
    expect(dir.z).toBeCloseTo(0, 9);
  });

  it('tilts upward with positive pitch', () => {
    const controller = new PlayerController();
    controller.applyLook({ dx: 0, dy: -pixelsFor(Math.PI / 4) });

    const dir = controller.lookDirection;

    expect(dir.x).toBeCloseTo(0, 9);
    expect(dir.y).toBeCloseTo(Math.SQRT1_2, 9);
    expect(dir.z).toBeCloseTo(-Math.SQRT1_2, 9);
  });

  it('is always a unit vector', () => {
    const controller = new PlayerController();
    controller.applyLook({ dx: pixelsFor(1.1), dy: -pixelsFor(0.4) });

    const dir = controller.lookDirection;

    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 9);
  });
});
