import * as THREE from "three";
import { colorHex, type MarbleColor } from "../domain/colors";
import { CONNECTIONS, type PieceType, type Rotation } from "../domain/pieces";
import type { TintTarget } from "./piece-juice";

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

/**
 * Poses a piece mesh on the board at a cell: center position, authored yaw
 * alignment with the piece's rotation, and the ramp pitch + lift so the low
 * end stays flush with neighboring piece floors. Shared by the live renderer
 * and offscreen board previews.
 */
export function posePiece(
  mesh: THREE.Object3D,
  piece: { type: PieceType; rotation: Rotation; x: number; y: number },
): void {
  mesh.position.set(...cellToWorld(piece.x, piece.y));
  mesh.rotation.order = "YXZ";
  mesh.rotation.y = rotationYaw(piece.rotation) + CONNECTIONS[piece.type].modelYawOffset;
  const slope = CONNECTIONS[piece.type].slope ?? 0;
  mesh.rotation.x = slope;
  mesh.position.y += slope > 0 ? 0.48 * Math.sin(slope) : 0;
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

  /** Read-only template access for offscreen snapshots (null before load). */
  templateFor(type: PieceType): THREE.Object3D | null {
    return this.templates.get(type) ?? null;
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
      color?: MarbleColor;
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
      posePiece(mesh, piece);
      // Colored sorting cups wear their candy tint; classics stay as modeled.
      if (piece.type === "goal" && piece.color !== undefined) {
        tintCup(mesh, piece.color);
      }
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

/** Tints a colored cup's materials, cloning them so the template is safe. */
export function tintCup(mesh: THREE.Object3D, color: MarbleColor): void {
  mesh.traverse((node) => {
    const part = node as THREE.Mesh;
    if (!part.isMesh) {
      return;
    }
    let material = part.material as THREE.MeshStandardMaterial;
    if (material.userData.msCupTint !== true) {
      material = material.clone();
      material.userData.msCupTint = true;
      part.material = material;
    }
    material.color.set(colorHex(color));
  });
}

/**
 * Flash target for a cup's mesh: pulses the emissive channel so a tap
 * visibly lights up the newly chosen tint.
 */
export function cupTintTarget(mesh: THREE.Object3D): TintTarget {
  const materials: THREE.MeshStandardMaterial[] = [];
  mesh.traverse((node) => {
    const part = node as THREE.Mesh;
    if (part.isMesh) {
      const material = part.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        materials.push(material);
      }
    }
  });
  return {
    setFlash(amount) {
      for (const material of materials) {
        material.emissive.setScalar(amount * 0.6);
      }
    },
  };
}
