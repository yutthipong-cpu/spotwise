import { CATALOG_BY_ID, type Layer } from './catalog';

export interface Placement {
  id: string;
  rotation: number;
  variant: number;
}

export interface Cell {
  ground?: Placement;
  object?: Placement;
}

export interface CityState {
  version: 2;
  size: number;
  cells: Record<string, Cell>;
}

const STORAGE_KEY = 'tribemap.city.v2';
const UNDO_LIMIT = 60;

export class City {
  readonly size: number;
  private cells = new Map<string, Cell>();
  private listeners = new Set<(key: string) => void>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(size = 20) {
    this.size = size;
  }

  static key(x: number, y: number) {
    return `${x},${y}`;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  get(x: number, y: number): Cell | undefined {
    return this.cells.get(City.key(x, y));
  }

  place(x: number, y: number, itemId: string, rotation = 0) {
    if (!this.inBounds(x, y)) return;
    const def = CATALOG_BY_ID.get(itemId);
    if (!def) return;

    const key = City.key(x, y);
    const cell = this.cells.get(key) ?? {};
    const current = cell[def.layer];
    if (current?.id === itemId && current.rotation === rotation) return;

    this.pushUndo();
    cell[def.layer] = {
      id: itemId,
      rotation,
      variant: current?.id === itemId ? current.variant : Math.floor(Math.random() * 4),
    };
    this.cells.set(key, cell);
    this.emit(key);
  }

  /** ลบของชิ้นบนก่อน แล้วค่อยลบพื้น — เหมือนยางลบที่ค่อยๆ ลอกทีละชั้น */
  erase(x: number, y: number) {
    const key = City.key(x, y);
    const cell = this.cells.get(key);
    if (!cell) return;
    const layer: Layer = cell.object ? 'object' : 'ground';
    if (!cell[layer]) return;

    this.pushUndo();
    delete cell[layer];
    if (!cell.ground && !cell.object) this.cells.delete(key);
    this.emit(key);
  }

  rotate(x: number, y: number) {
    const cell = this.get(x, y);
    const target = cell?.object ?? cell?.ground;
    if (!target) return;
    this.pushUndo();
    target.rotation = (target.rotation + 1) % 4;
    this.emit(City.key(x, y));
  }

  entries(): [string, Cell][] {
    return [...this.cells.entries()];
  }

  clear() {
    this.pushUndo();
    this.cells.clear();
    this.emit('*');
  }

  onChange(fn: (key: string) => void) {
    this.listeners.add(fn);
  }

  private emit(key: string) {
    for (const fn of this.listeners) fn(key);
  }

  // --- history -------------------------------------------------------------
  private snapshot() {
    return JSON.stringify([...this.cells]);
  }

  private restoreSnapshot(json: string) {
    this.cells = new Map(JSON.parse(json) as [string, Cell][]);
    this.emit('*');
  }

  private pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    const prev = this.undoStack.pop();
    if (prev === undefined) return;
    this.redoStack.push(this.snapshot());
    this.restoreSnapshot(prev);
  }

  redo() {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(this.snapshot());
    this.restoreSnapshot(next);
  }

  // --- persistence ---------------------------------------------------------
  toJSON(): CityState {
    return { version: 2, size: this.size, cells: Object.fromEntries(this.cells) };
  }

  load(state: CityState) {
    const entries = Object.entries(state.cells).filter(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return this.inBounds(x, y);
    });
    this.cells = new Map(entries);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit('*');
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
  }

  restore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      this.load(JSON.parse(raw) as CityState);
      return this.cells.size > 0;
    } catch {
      return false;
    }
  }
}
