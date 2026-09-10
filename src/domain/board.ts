import type { MarbleColor } from "./colors";
import { createGrid, placePiece, type GridState, isInside } from "./grid";
import { CONNECTIONS, PIECE_TYPES, type PieceType, type Rotation } from "./pieces";
import type { Storage } from "./storage";

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "marblescape.board.v1";

export interface PlacedPiece {
  id: string;
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
  /** Candy color for goal cups; absent = classic catch-all cup. */
  color?: MarbleColor;
}

export interface BoardState extends GridState {
  pieces: PlacedPiece[];
}

export function createBoard(width: number, height: number): BoardState {
  return { ...createGrid(width, height), pieces: [] };
}

/** Place a typed piece: updates both the grid occupancy and the piece list. */
export function placeTypedPiece(board: BoardState, piece: PlacedPiece): BoardState {
  const withCell = placePiece(board, piece.id, piece.x, piece.y);
  return { ...withCell, pieces: [...board.pieces, piece] };
}

/** Remove a piece by cell: clears occupancy and drops it from the piece list. */
export function removeTypedPiece(board: BoardState, x: number, y: number): BoardState {
  const piece = board.pieces.find((p) => p.x === x && p.y === y);
  if (!piece) {
    throw new Error(`No piece at (${x}, ${y})`);
  }
  const cleared = { ...board, cells: [...board.cells] };
  cleared.cells[piece.y * board.width + piece.x] = null;
  return { ...cleared, pieces: board.pieces.filter((p) => p !== piece) };
}

// --- Serialization ---

interface SerializedPiece {
  id: string;
  type: string;
  rotation: number;
  x: number;
  y: number;
}

interface SerializedBoard {
  version: number;
  width: number;
  height: number;
  pieces: SerializedPiece[];
}

export function toJSON(board: BoardState): string {
  const doc: SerializedBoard = {
    version: SCHEMA_VERSION,
    width: board.width,
    height: board.height,
    pieces: board.pieces.map((p) => ({
      id: p.id,
      type: p.type,
      rotation: p.rotation,
      x: p.x,
      y: p.y,
    })),
  };
  return JSON.stringify(doc);
}

export function fromJSON(json: string): BoardState | null {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(doc) || doc.version !== SCHEMA_VERSION) {
    return null;
  }
  const { width, height, pieces } = doc;
  if (!isInt(width) || !isInt(height) || width < 1 || height < 1 || !Array.isArray(pieces)) {
    return null;
  }

  let board = createBoard(width, height);
  for (const entry of pieces) {
    const piece = parsePiece(entry);
    if (!piece || !isInside(board, piece.x, piece.y) || !canOccupy(board, piece.x, piece.y)) {
      return null;
    }
    board = placeTypedPiece(board, piece);
  }
  return board;
}

function parsePiece(entry: unknown): PlacedPiece | null {
  if (!isRecord(entry)) {
    return null;
  }
  const { id, type, rotation, x, y } = entry;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  if (typeof type !== "string" || !PIECE_TYPES.includes(type as PieceType)) {
    return null;
  }
  if (!isInt(rotation) || rotation < 0 || rotation > 3) {
    return null;
  }
  if (!isInt(x) || !isInt(y)) {
    return null;
  }
  // Non-rotatable pieces always serialize at rotation 0.
  const validRotation: Rotation = CONNECTIONS[type as PieceType].rotatable
    ? (rotation as Rotation)
    : 0;
  return { id, type: type as PieceType, rotation: validRotation, x, y };
}

function canOccupy(board: BoardState, x: number, y: number): boolean {
  return board.cells[y * board.width + x] === null;
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// --- localStorage persistence ---

export function saveBoard(storage: Storage, board: BoardState): void {
  storage.setItem(STORAGE_KEY, toJSON(board));
}

/** Returns the saved board, or null when absent/corrupt (fresh start). */
export function loadBoard(storage: Storage): BoardState | null {
  const json = storage.getItem(STORAGE_KEY);
  return json === null ? null : fromJSON(json);
}
