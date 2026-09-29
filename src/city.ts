import { CATALOG_BY_ID } from './catalog';

/** the two layers a grid cell can hold — buildings live in their own collection */
type CellLayer = 'ground' | 'object';

export type BuildingKind =
  | 'classroom'
  | 'auditorium'
  | 'dome'
  | 'canteen'
  | 'service'
  | 'toilet'
  | 'carport'
  | 'library'
  | 'guard';

export interface Building {
  id: string;
  /** เลขอาคารตามผัง */
  no: number;
  name: string;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  floors: number;
}

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
  version: 3;
  width: number;
  height: number;
  cells: Record<string, Cell>;
  buildings: Building[];
}

const UNDO_LIMIT = 40;

export class City {
  private cells = new Map<string, Cell>();
  private buildings = new Map<string, Building>();
  private listeners = new Set<(key: string) => void>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private batching = false;

  constructor(
    readonly width: number,
    readonly height: number,
    private storageKey: string,
  ) {}

  static key(x: number, y: number) {
    return `${x},${y}`;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  // --- cells ---------------------------------------------------------------
  get(x: number, y: number): Cell | undefined {
    return this.cells.get(City.key(x, y));
  }

  place(x: number, y: number, itemId: string, rotation = 0) {
    if (!this.inBounds(x, y)) return;
    const def = CATALOG_BY_ID.get(itemId);
    if (!def || def.layer === 'building') return;

    const layer: CellLayer = def.layer;
    const key = City.key(x, y);
    const cell = this.cells.get(key) ?? {};
    const current = cell[layer];
    if (current?.id === itemId && current.rotation === rotation) return;

    this.pushUndo();
    cell[layer] = {
      id: itemId,
      rotation,
      variant: current?.id === itemId ? current.variant : Math.floor(Math.random() * 4),
    };
    this.cells.set(key, cell);
    this.emit(key);
  }

  /** ลบของชิ้นบนก่อน แล้วค่อยลบพื้น — เหมือนยางลบที่ค่อยๆ ลอกทีละชั้น */
  erase(x: number, y: number) {
    const building = this.buildingAt(x, y);
    if (building) {
      this.pushUndo();
      this.buildings.delete(building.id);
      this.emit('*');
      return;
    }

    const key = City.key(x, y);
    const cell = this.cells.get(key);
    if (!cell) return;
    const layer: CellLayer = cell.object ? 'object' : 'ground';
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

  // --- buildings -----------------------------------------------------------
  allBuildings() {
    return [...this.buildings.values()];
  }

  buildingAt(x: number, y: number) {
    return this.allBuildings().find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  }

  rectIsFree(x: number, y: number, w: number, h: number, exceptId?: string) {
    if (x < 0 || y < 0 || x + w > this.width || y + h > this.height) return false;
    return !this.allBuildings().some(
      (b) => b.id !== exceptId && x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y,
    );
  }

  addBuilding(b: Omit<Building, 'id' | 'no'> & { no?: number }) {
    if (!this.rectIsFree(b.x, b.y, b.w, b.h)) return null;
    const used = new Set(this.allBuildings().map((x) => x.no));
    let no = b.no ?? 1;
    while (used.has(no)) no++;
    const building: Building = { ...b, no, id: `b${no}-${Date.now().toString(36)}` };
    this.pushUndo();
    this.buildings.set(building.id, building);
    this.emit('*');
    return building;
  }

  getBuilding(id: string) {
    return this.buildings.get(id);
  }

  removeBuilding(id: string) {
    if (!this.buildings.has(id)) return;
    this.pushUndo();
    this.buildings.delete(id);
    this.emit('*');
  }

  updateBuilding(id: string, patch: Partial<Building>) {
    const b = this.buildings.get(id);
    if (!b) return;
    this.pushUndo();
    Object.assign(b, patch);
    this.emit('*');
  }

  clear() {
    this.pushUndo();
    this.cells.clear();
    this.buildings.clear();
    this.emit('*');
  }

  onChange(fn: (key: string) => void) {
    this.listeners.add(fn);
  }

  private emit(key: string) {
    if (this.batching) return;
    for (const fn of this.listeners) fn(key);
  }

  /** seeding a whole site one cell at a time would snapshot the map ~900 times */
  batch(fn: () => void) {
    this.batching = true;
    try {
      fn();
    } finally {
      this.batching = false;
    }
    this.resetHistory();
    this.emit('*');
  }

  // --- history -------------------------------------------------------------
  private snapshot() {
    return JSON.stringify({ cells: [...this.cells], buildings: [...this.buildings] });
  }

  private restoreSnapshot(json: string) {
    const data = JSON.parse(json) as { cells: [string, Cell][]; buildings: [string, Building][] };
    this.cells = new Map(data.cells);
    this.buildings = new Map(data.buildings);
    this.emit('*');
  }

  private pushUndo() {
    if (this.batching) return;
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

  /** the seeded site should not be undoable back to an empty map */
  resetHistory() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  // --- persistence ---------------------------------------------------------
  toJSON(): CityState {
    return {
      version: 3,
      width: this.width,
      height: this.height,
      cells: Object.fromEntries(this.cells),
      buildings: this.allBuildings(),
    };
  }

  load(state: CityState) {
    this.cells = new Map(
      Object.entries(state.cells).filter(([key]) => {
        const [x, y] = key.split(',').map(Number);
        return this.inBounds(x, y);
      }),
    );
    this.buildings = new Map(
      (state.buildings ?? [])
        .filter((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= this.width && b.y + b.h <= this.height)
        .map((b) => [b.id, b]),
    );
    this.resetHistory();
    this.emit('*');
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.toJSON()));
  }

  restore() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return false;
    try {
      const state = JSON.parse(raw) as CityState;
      if (state.width !== this.width || state.height !== this.height) return false;
      this.load(state);
      return this.cells.size > 0 || this.buildings.size > 0;
    } catch {
      return false;
    }
  }
}
