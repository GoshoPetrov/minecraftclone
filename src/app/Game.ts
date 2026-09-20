import { GameLoop } from './GameLoop';
import { config } from '../config/Config';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { World } from '../world/World';
import { HeightmapWorldGenerator } from '../world/WorldGenerator';
import type { BlockSampler } from '../rendering/ChunkMeshBuilder';
import { WorldRenderer } from '../rendering/WorldRenderer';
import { InputManager, type MouseDelta } from '../input/InputManager';
import { PlayerController, idleMovementInput, type MovementInput } from '../player/PlayerController';
import { createPlayerState, idleIntent, type PlayerState } from '../player/Player';
import { step } from '../player/PlayerPhysics';
import { findSpawn } from '../player/Spawn';
import { PlayOverlay } from '../ui/PlayOverlay';

export interface GameOptions {
  readonly canvas: HTMLCanvasElement;
  /** Click-to-play overlay element; optional so the game can run headless. */
  readonly overlay?: HTMLElement;
}

/**
 * Application orchestrator. It wires the render loop to a renderer and fixes
 * the per-frame update order. It owns the player simulation and the input
 * system; no other system reads DOM events or drives the camera.
 */
export class Game {
  private readonly renderer: WorldRenderer;
  private readonly loop: GameLoop;
  private readonly input: InputManager;
  private readonly controller: PlayerController;
  private readonly overlay: PlayOverlay | null;
  private readonly world: World;

  private playerState: PlayerState;
  private mouseDelta: MouseDelta = { dx: 0, dy: 0 };
  private movementInput: MovementInput = idleMovementInput();
  private pointerLocked = false;

  constructor(options: GameOptions) {
    const registry = createDefaultBlockRegistry();
    const world = new World({ sizeInChunks: config.world.sizeInChunks }, registry);
    new HeightmapWorldGenerator(config.generation).generate(world);
    this.world = world;

    // The renderer reads block types through the world, so the world stays
    // the authority on which blocks exist and which geometry is dirty.
    const blockAt: BlockSampler = (x, y, z) => registry.get(world.getBlock(x, y, z));

    this.renderer = new WorldRenderer(options.canvas, world, blockAt);
    this.input = new InputManager(options.canvas);
    this.controller = new PlayerController();
    this.overlay = options.overlay === undefined ? null : new PlayOverlay(options.overlay);
    this.playerState = createPlayerState(findSpawn(world));

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
    this.input.dispose();
    this.renderer.dispose();
  }

  /**
   * The fixed update order for every frame. Stages are filled in by later
   * tickets, but the order is contractual: each stage observes state left
   * consistent by the previous one, and rendering happens only after all
   * stages have run.
   *
   *   1. consume input        (polled state and queued actions)
   *   2. apply look           (yaw/pitch from accumulated mouse delta)
   *   3. step physics         (movement, gravity, collision)
   *   4. update targeting     (raycast + highlight)
   *   5. apply actions        (queued break/place)
   *   6. flush dirty meshes   (budgeted geometry rebuild)
   *   7. follow camera        (position + orientation for the next render)
   */
  update(deltaSeconds: number): void {
    this.consumeInput();
    this.applyLook();
    this.stepPhysics(deltaSeconds);
    this.updateTargeting();
    this.applyActions();
    this.flushDirtyMeshes();
    this.updateCamera();
  }

  /**
   * Poll input once per frame. Mouse delta and queued presses are consumed
   * here so they cannot leak into a later frame; raw events never reach the
   * simulation.
   */
  private consumeInput(): void {
    this.pointerLocked = this.input.isPointerLocked;
    this.overlay?.setVisible(!this.pointerLocked);

    this.mouseDelta = this.input.consumeMouseDelta();
    // Reserved for break/place in a later ticket. Draining here keeps the
    // queue bounded and guarantees one frame's presses are never replayed.
    this.input.consumeMousePresses();

    const bindings = config.input.bindings;
    this.movementInput = {
      forward: this.input.isKeyDown(bindings.forward),
      backward: this.input.isKeyDown(bindings.backward),
      left: this.input.isKeyDown(bindings.left),
      right: this.input.isKeyDown(bindings.right),
      jump: this.input.isKeyDown(bindings.jump),
    };
  }

  /** Mouse look applies only while the pointer is captured. */
  private applyLook(): void {
    if (!this.pointerLocked) {
      return;
    }
    this.controller.applyLook(this.mouseDelta);
  }

  /**
   * Player input is paused while the pointer is unlocked, so the character
   * stands still rather than reacting to a cursor that is back on screen.
   * Physics keeps running so gravity and collision stay consistent.
   */
  private stepPhysics(deltaSeconds: number): void {
    const intent = this.pointerLocked ? this.controller.intent(this.movementInput) : idleIntent();
    this.playerState = step(this.playerState, intent, this.world, deltaSeconds);
  }

  private updateTargeting(): void {}

  private applyActions(): void {}

  private flushDirtyMeshes(): void {
    this.renderer.flushDirtyChunks(config.rendering.chunkRebuildBudgetPerFrame);
  }

  private updateCamera(): void {
    const orientation = this.controller.orientation;
    this.renderer.setCameraPose(this.playerState.position, orientation.yaw, orientation.pitch);
  }
}
