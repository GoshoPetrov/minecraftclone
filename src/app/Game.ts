import { GameLoop } from './GameLoop';
import { config } from '../config/Config';
import { WorldRenderer } from '../rendering/WorldRenderer';

export interface GameOptions {
  readonly canvas: HTMLCanvasElement;
}

/**
 * Application orchestrator. It wires the render loop to a renderer and
 * fixes the per-frame update order. It holds no block/renderer state of
 * its own beyond the systems it owns.
 */
export class Game {
  private readonly renderer: WorldRenderer;
  private readonly loop: GameLoop;

  constructor(options: GameOptions) {
    this.renderer = new WorldRenderer(options.canvas);
    this.loop = new GameLoop(
      {
        update: (deltaSeconds) => {
          this.update(deltaSeconds);
        },
        render: () => {
          this.renderer.render();
        },
      },
      config.maxFrameDeltaSeconds,
    );
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.renderer.dispose();
  }

  /**
   * The fixed update order for every frame. Stages are deliberately empty
   * in this scaffold and are filled in by later tickets, but the order is
   * contractual: each stage observes state left consistent by the previous
   * one, and rendering happens only after all stages have run.
   *
   *   1. consume input        (polled state and queued actions)
   *   2. apply look           (yaw/pitch from accumulated mouse delta)
   *   3. step physics         (movement, gravity, collision)
   *   4. update targeting     (raycast + highlight)
   *   5. apply actions        (queued break/place)
   *   6. flush dirty meshes   (budgeted geometry rebuild)
   */
  update(deltaSeconds: number): void {
    this.consumeInput();
    this.applyLook();
    this.stepPhysics(deltaSeconds);
    this.updateTargeting();
    this.applyActions();
    this.flushDirtyMeshes();
  }

  private consumeInput(): void {}

  private applyLook(): void {}

  private stepPhysics(_deltaSeconds: number): void {}

  private updateTargeting(): void {}

  private applyActions(): void {}

  private flushDirtyMeshes(): void {}
}
