import * as THREE from 'three';

import type { BlockHit } from '../interaction/BlockRaycaster';

/**
 * The outline drawn around the targeted block.
 *
 * This is purely view state: it is repositioned from a raycast result each
 * frame and never read back into the world or stored as block data. The same
 * object is reused for every target, so following the aim allocates nothing.
 */
export class BlockHighlight {
  /** Scene node for the outline; hidden whenever nothing is targeted. */
  readonly object3d: THREE.LineSegments;

  private readonly geometry: THREE.EdgesGeometry;
  private readonly material: THREE.LineBasicMaterial;

  constructor() {
    // A hair larger than one block so the outline sits just outside the
    // block's faces instead of z-fighting with them.
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.geometry = new THREE.EdgesGeometry(box);
    box.dispose();
    this.material = new THREE.LineBasicMaterial({ color: 0x000000 });
    this.object3d = new THREE.LineSegments(this.geometry, this.material);
    this.object3d.name = 'block-highlight';
    this.object3d.visible = false;
  }

  /**
   * Outline the hit block, or hide the outline when there is no target. The
   * block occupies `[pos, pos + 1]`, so the outline is centred on `pos + 0.5`.
   */
  setTarget(hit: BlockHit | null): void {
    if (hit === null) {
      this.object3d.visible = false;
      return;
    }

    this.object3d.position.set(
      hit.blockPos.x + 0.5,
      hit.blockPos.y + 0.5,
      hit.blockPos.z + 0.5,
    );
    this.object3d.visible = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
