import { GameLoop } from './GameLoop';
import { config } from '../config/Config';
import { createDefaultBlockRegistry, type BlockRegistry } from '../world/BlockRegistry';
import type { World } from '../world/World';
import type { BlockSampler } from '../rendering/ChunkMeshBuilder';
import { WorldRenderer } from '../rendering/WorldRenderer';
import { InputManager, type MouseButton, type MouseDelta } from '../input/InputManager';
import { PlayerController, idleMovementInput, type MovementInput } from '../player/PlayerController';
import {
  createPlayerState,
  eyeHeightFor,
  idleIntent,
  playerAabb,
  type PlayerState,
  type Vec3,
} from '../player/Player';
import { step } from '../player/PlayerPhysics';
import { createVitals, updateVitals, type VitalsState } from '../player/Vitals';
import { findSpawn } from '../player/Spawn';
import { raycastBlock, type BlockHit } from '../interaction/BlockRaycaster';
import { BlockInteractor } from '../interaction/BlockInteractor';
import type { BlockType } from '../world/BlockType';
import { PlayOverlay } from '../ui/PlayOverlay';
import { worldMetadataFrom } from '../persistence/SaveData';
import {
  loadWorld,
  type PersistenceObserver,
  type WorldPersistence,
} from '../persistence/WorldPersistence';
import { createBrowserWorldRepository } from '../persistence/RepositoryFactory';
import { NoticeOverlay } from '../ui/Notices';
import { DebugReadout, formatDebugPosition } from '../ui/DebugReadout';
import { HealthHud } from '../ui/HealthHud';

export interface GameOptions {
  readonly canvas: HTMLCanvasElement;
  /** Click-to-play overlay element; optional so the game can run headless. */
  readonly overlay?: HTMLElement;
  /** Container for non-fatal persistence notices; optional. */
  readonly notices?: HTMLElement;
  /** Coordinate readout element; optional so the game can run headless. */
  readonly debug?: HTMLElement;
  /** Health hearts element; optional so the game can run headless. */
  readonly health?: HTMLElement;
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
  private readonly debugReadout: DebugReadout | null;
  private readonly healthHud: HealthHud | null;
  private readonly world: World;
  private readonly interactor: BlockInteractor;
  private readonly placeableBlock: BlockType;
  private readonly persistence: WorldPersistence;

  private playerState: PlayerState;
  /**
   * The avatar's transient health, owned beside the player state. It is never
   * persisted and no UI code reads it directly; the hearts presenter is fed a
   * plain number at the end of the frame.
   */
  private vitals: VitalsState;
  private mouseDelta: MouseDelta = { dx: 0, dy: 0 };
  private mousePresses: readonly MouseButton[] = [];
  private movementInput: MovementInput = idleMovementInput();
  private pointerLocked = false;
  private target: BlockHit | null = null;
  /** Whether the player has toggled the debug readout on with L. */
  private debugVisible = false;

  /**
   * Load the saved world (or start a fresh one), then build the game around
   * it. This is async because persistence is async; nothing in the game loop
   * ever waits on storage.
   */
  static async create(options: GameOptions): Promise<Game> {
    const registry = createDefaultBlockRegistry();
    const noticeOverlay =
      options.notices === undefined ? null : new NoticeOverlay(options.notices);
    const observer: PersistenceObserver = {
      notify: (message) => {
        noticeOverlay?.show(message.message, {
          level: message.level,
          dismissible: message.dismissible,
          persistent: message.persistent,
        });
      },
    };

    const { repository, storageAvailable } = createBrowserWorldRepository();
    const loaded = await loadWorld({
      repository,
      registry,
      fallbackMetadata: worldMetadataFrom(config.world.sizeInChunks, config.generation),
      debounceMs: config.persistence.saveDebounceMs,
      storageAvailable,
      observer,
    });
    for (const message of loaded.messages) {
      observer.notify(message);
    }

    return new Game(options, registry, loaded.world, loaded.persistence);
  }

  private constructor(
    options: GameOptions,
    registry: BlockRegistry,
    world: World,
    persistence: WorldPersistence,
  ) {
    this.world = world;
    this.persistence = persistence;

    // The renderer reads block types through the world, so the world stays
    // the authority on which blocks exist and which geometry is dirty.
    const blockAt: BlockSampler = (x, y, z) => registry.get(world.getBlock(x, y, z));

    this.renderer = new WorldRenderer(options.canvas, world, blockAt);
    this.input = new InputManager(options.canvas);
    this.controller = new PlayerController();
    this.overlay = options.overlay === undefined ? null : new PlayOverlay(options.overlay);
    this.debugReadout =
      options.debug === undefined ? null : new DebugReadout(options.debug);
    this.healthHud =
      options.health === undefined
        ? null
        : new HealthHud(options.health, config.player.maxHealth);
    this.playerState = createPlayerState(findSpawn(world));
    this.vitals = createVitals();
    this.interactor = new BlockInteractor(world, registry);
    this.placeableBlock = registry.get(config.interaction.defaultPlaceableBlock);

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

  /**
   * Best-effort save triggers while the page is going away. A hidden tab can
   * be discarded without another frame, so this is the last chance to persist
   * a pending edit without blocking the game loop.
   */
  private readonly onPageHide = (): void => {
    void this.persistence.flush().catch(() => undefined);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      void this.persistence.flush().catch(() => undefined);
    }
  };

  start(): void {
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.loop.start();
  }

  stop(): void {
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.persistence.flush().catch(() => undefined);
    this.persistence.dispose();
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
   *   4. update vitals        (fall accumulation + landing damage + void drain)
   *   5. update targeting     (raycast + highlight)
   *   6. apply actions        (queued break/place)
   *   7. flush dirty meshes   (budgeted geometry rebuild)
   *   8. follow camera        (position + orientation for the next render)
   *   9. update health HUD    (render the frame's health as hearts)
   *  10. update debug readout (read-only diagnostic text)
   */
  update(deltaSeconds: number): void {
    this.consumeInput();
    this.applyLook();
    const previous = this.stepPhysics(deltaSeconds);
    this.advanceVitals(previous, deltaSeconds);
    this.updateTargeting();
    this.applyActions();
    this.flushDirtyMeshes();
    this.updateCamera(deltaSeconds);
    this.updateHealthHud();
    this.updateDebugReadout();
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
    // Drained once per frame so one press is one action and a press can never
    // leak into a later frame.
    this.mousePresses = this.input.consumeMousePresses();
    const keyPresses = this.input.consumeKeyPresses();

    const bindings = config.input.bindings;
    this.movementInput = {
      forward: this.input.isKeyDown(bindings.forward),
      backward: this.input.isKeyDown(bindings.backward),
      left: this.input.isKeyDown(bindings.left),
      right: this.input.isKeyDown(bindings.right),
      jump: this.input.isKeyDown(bindings.jump),
      sprint: this.input.isKeyDown(bindings.sprint),
      crouch: this.input.isKeyDown(bindings.crouch),
    };

    // A latched physical press, so key-repeat and focus loss cannot drop it.
    for (const code of keyPresses) {
      if (code === bindings.debug) {
        this.debugVisible = !this.debugVisible;
      }
    }
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
  private stepPhysics(deltaSeconds: number): PlayerState {
    const intent = this.pointerLocked ? this.controller.intent(this.movementInput) : idleIntent();
    const previous = this.playerState;
    this.playerState = step(previous, intent, this.world, deltaSeconds);
    return previous;
  }

  /**
   * Advance the transient vitals from the exact grounded transition and
   * position physics just produced. Running immediately after the physics
   * stage means fall accumulation, landing damage, and the void drain all
   * observe the frame's real end state before targeting, actions, or the HUD
   * touch it. All damage arithmetic, including the void cadence, lives in the
   * pure vitals module.
   */
  private advanceVitals(previous: PlayerState, deltaSeconds: number): void {
    this.vitals = updateVitals(this.vitals, previous, this.playerState, deltaSeconds);
  }

  /**
   * Cast from the camera eye along the view direction and hand the result to
   * the renderer. The result is cached only for the following action stages;
   * it is derived view state and is never written to the world.
   */
  private updateTargeting(): void {
    const eye: Vec3 = {
      x: this.playerState.position.x,
      y: this.playerState.position.y + eyeHeightFor(this.playerState.crouching),
      z: this.playerState.position.z,
    };
    this.target = raycastBlock(
      this.world,
      eye,
      this.controller.lookDirection,
      config.interaction.range,
    );
    this.renderer.setTarget(this.target);
  }

  /**
   * Apply this frame's queued mouse presses: left breaks the target, right
   * places the configured block against the targeted face. Each press yields
   * exactly one validated edit, and validation failures change nothing.
   * Presses are discarded while the pointer is unlocked so a press queued
   * just before losing capture can never fire later.
   */
  private applyActions(): void {
    const presses = this.mousePresses;
    this.mousePresses = [];
    if (!this.pointerLocked) {
      return;
    }

    const range = config.interaction.range;
    for (const press of presses) {
      const changed =
        press === 'left'
          ? this.interactor.breakBlock(this.target, range)
          : this.interactor.placeBlock(
              this.target,
              playerAabb(this.playerState.position, this.playerState.crouching),
              this.placeableBlock,
              range,
            );
      if (changed) {
        // Persistence is scheduled, never awaited: storage never blocks a
        // frame, and a failed write cannot change the world.
        this.persistence.markDirty();
      }
    }
  }

  private flushDirtyMeshes(): void {
    this.renderer.flushDirtyChunks(config.rendering.chunkRebuildBudgetPerFrame);
  }

  private updateCamera(deltaSeconds: number): void {
    const orientation = this.controller.orientation;
    // Sprint widens the field of view only while the movement label says so;
    // the field of view changes projection, never the aim direction.
    const targetFov =
      this.playerState.movement === 'sprinting'
        ? config.camera.fovDegrees * config.camera.sprintFovMultiplier
        : config.camera.fovDegrees;
    this.renderer.setCameraPose(
      this.playerState.position,
      orientation.yaw,
      orientation.pitch,
      eyeHeightFor(this.playerState.crouching),
      targetFov,
      deltaSeconds,
    );
  }

  /**
   * Refresh the hearts presenter from the frame's settled vitals. Only the
   * plain health number crosses the seam; the presenter never reads gameplay
   * state and the game never touches the DOM.
   */
  private updateHealthHud(): void {
    this.healthHud?.setHealth(this.vitals.health);
  }

  /**
   * Refresh the diagnostic readout from the frame's settled player state.
   * Read-only: it observes the feet-centre position physics produced and
   * writes DOM text, and is independent of pointer lock so the player's
   * choice to show it survives an unlocked pointer and the play overlay.
   */
  private updateDebugReadout(): void {
    if (this.debugReadout === null) {
      return;
    }
    this.debugReadout.setVisible(this.debugVisible);
    this.debugReadout.setText(formatDebugPosition(this.playerState.position));
  }
}
