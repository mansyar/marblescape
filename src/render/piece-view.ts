import * as THREE from "three";
import { CONNECTIONS, type PieceType, type Rotation } from "../domain/pieces";

/** Cell (col,row) -> world position of the cell center on the board surface. */
export function cellToWorld(x: number, y: number): [number, number, number] {
  return [x + 0.5, 0, y + 0.5];
}

/**
 * Quarter turns (clockwise viewed from above) -> yaw radians.
 * three.js positive Y-rotation is counter-clockwise from above, hence negated.
 */
export function rotationYaw(rotation: Rotation): number {
  return (-rotation * Math.PI) / 2;
}

/** Preloads each piece type's Kenney model and syncs meshes to a board state. */
export class PieceRenderer {
  private readonly templates = new Map<PieceType, THREE.Object3D>();
  private readonly meshes = new Map<string, THREE.Object3D>();
  private readonly root: THREE.Group;
  private readonly loader: { loadAsync: (url: string) => Promise<unknown> };

  /** Direct access to a placed piece's scene object (for pop animations). */
  meshFor(id: string): THREE.Object3D | null {
    return this.meshes.get(id) ?? null;
  }

  constructor(root: THREE.Group, loader: { loadAsync: (url: string) => Promise<unknown> }) {
    this.root = root;
    this.loader = loader;
  }

  /** Preload one template per piece type; falls back to a simple slab. */
  async loadTemplates(): Promise<void> {
    const types = Object.keys(CONNECTIONS) as PieceType[];
    await Promise.all(
      types.map(async (type) => {
        try {
          const gltf = (await this.loader.loadAsync(CONNECTIONS[type].model)) as {
            scene: THREE.Object3D;
          };
          this.templates.set(type, gltf.scene);
        } catch {
          // CC0 model failed to load (e.g. offline dev): show a placeholder
          // slab so the piece is still visible and draggable.
          this.templates.set(type, PieceRenderer.placeholder(type));
        }
      }),
    );
  }

  /** Adds/removes/re-pieces meshes so the scene matches the board. */
  sync(
    pieces: ReadonlyArray<{
      id: string;
      type: PieceType;
      rotation: Rotation;
      x: number;
      y: number;
    }>,
  ): void {
    const keep = new Set(pieces.map((p) => p.id));
    for (const [id, mesh] of this.meshes) {
      if (!keep.has(id)) {
        this.root.remove(mesh);
        this.meshes.delete(id);
      }
    }
    for (const piece of pieces) {
      let mesh = this.meshes.get(piece.id);
      const template = this.templates.get(piece.type);
      if (!template) {
        continue;
      }
      if (!mesh) {
        mesh = template.clone(true);
        mesh.name = `piece-${piece.id}`;
        this.root.add(mesh);
        this.meshes.set(piece.id, mesh);
      }
      mesh.position.set(...cellToWorld(piece.x, piece.y));
      mesh.rotation.y = rotationYaw(piece.rotation) + CONNECTIONS[piece.type].modelYawOffset;
    }
  }

  private static placeholder(type: PieceType): THREE.Object3D {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xf4a261 }),
    );
    mesh.name = `placeholder-${type}`;
    mesh.position.y = 0.125;
    return mesh;
  }
}
