export type PieceId = string;

export interface GridState {
  width: number;
  height: number;
  /** Row-major cells, each holding a piece id or null. */
  cells: Array<PieceId | null>;
}

export function createGrid(width: number, height: number): GridState {
  if (width < 1 || height < 1) {
    throw new Error(`Invalid grid dimensions: ${width}x${height}`);
  }
  return {
    width,
    height,
    cells: new Array<PieceId | null>(width * height).fill(null),
  };
}

export function index(grid: GridState, x: number, y: number): number {
  return y * grid.width + x;
}

export function isInside(grid: GridState, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

export function getPieceAt(grid: GridState, x: number, y: number): PieceId | null {
  if (!isInside(grid, x, y)) {
    return null;
  }
  return grid.cells[index(grid, x, y)];
}

export function isOccupied(grid: GridState, x: number, y: number): boolean {
  return getPieceAt(grid, x, y) !== null;
}

export function canPlace(grid: GridState, x: number, y: number): boolean {
  return isInside(grid, x, y) && !isOccupied(grid, x, y);
}

export function placePiece(grid: GridState, pieceId: PieceId, x: number, y: number): GridState {
  if (!isInside(grid, x, y)) {
    throw new Error(`Cannot place piece outside grid bounds: (${x}, ${y})`);
  }
  if (isOccupied(grid, x, y)) {
    throw new Error(`Cell (${x}, ${y}) is already occupied`);
  }
  const cells = [...grid.cells];
  cells[index(grid, x, y)] = pieceId;
  return { ...grid, cells };
}

export function removePiece(grid: GridState, x: number, y: number): GridState {
  if (!isInside(grid, x, y)) {
    throw new Error(`Cannot remove piece outside grid bounds: (${x}, ${y})`);
  }
  if (!isOccupied(grid, x, y)) {
    throw new Error(`Cell (${x}, ${y}) is empty, nothing to remove`);
  }
  const cells = [...grid.cells];
  cells[index(grid, x, y)] = null;
  return { ...grid, cells };
}
