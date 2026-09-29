import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { City, type Building } from './city';
import { IsoScene, type ViewMode } from './scene';
import { GROUND_H, buildPlacementMesh } from './meshes';
import { buildBuildingMesh } from './buildings';
import { CATALOG_BY_ID } from './catalog';
import { setupLibrary } from './ui';
import { SITE_BUILDINGS, SITE_GROUND, SITE_PROPS } from './site-roiet';
import {
  MAX_SIZE,
  MIN_SIZE,
  allSites,
  createSite,
  currentSite,
  deleteSite,
  openSite,
  resizeSite,
  shippedOriginal,
  storageKeyFor,
} from './sites';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const site = currentSite();
const city = new City(site.width, site.height, storageKeyFor(site.id));
const iso = new IsoScene(canvas, city.width, city.height);

// --- terrain ---------------------------------------------------------------
const soil = new THREE.Mesh(
  new RoundedBoxGeometry(city.width + 0.5, 1.6, city.height + 0.5, 3, 0.3),
  new THREE.MeshLambertMaterial({ color: 0xc79a70 }),
);
soil.position.set(city.width / 2, -0.88, city.height / 2);
soil.receiveShadow = true;

const lawn = new THREE.Mesh(
  new RoundedBoxGeometry(city.width, 0.5, city.height, 3, 0.16),
  new THREE.MeshLambertMaterial({ color: 0xa9dd8b }),
);
lawn.position.set(city.width / 2, -0.25, city.height / 2);
lawn.receiveShadow = true;

iso.scene.add(soil, lawn);

// --- rendering -------------------------------------------------------------
const cellRoot = new THREE.Group();
const buildingRoot = new THREE.Group();
iso.scene.add(cellRoot, buildingRoot);

const rendered = new Map<string, THREE.Group>();
const buildingMeshes = new Map<string, THREE.Group>();
const popping: { group: THREE.Group; t: number }[] = [];

function dropCell(key: string) {
  const old = rendered.get(key);
  if (!old) return;
  cellRoot.remove(old);
  rendered.delete(key);
}

function syncCell(key: string) {
  if (key === '*') {
    for (const k of [...rendered.keys()]) dropCell(k);
    for (const [k] of city.entries()) syncCell(k);
    syncBuildings();
    return;
  }

  const isNew = !rendered.has(key);
  dropCell(key);

  const [x, y] = key.split(',').map(Number);
  const cell = city.get(x, y);
  if (!cell) return;

  const group = new THREE.Group();
  if (cell.ground) {
    const mesh = buildPlacementMesh(cell.ground, 'ground', x, y);
    if (mesh) group.add(mesh);
  }
  if (cell.object) {
    const mesh = buildPlacementMesh(cell.object, 'object', x, y);
    if (mesh) {
      mesh.position.y = cell.ground ? GROUND_H : 0;
      group.add(mesh);
    }
  }

  group.position.set(x + 0.5, 0, y + 0.5);
  cellRoot.add(group);
  rendered.set(key, group);

  if (isNew) {
    group.scale.setScalar(0.4);
    popping.push({ group, t: 0 });
  }
}

function syncBuildings() {
  buildingRoot.clear();
  buildingMeshes.clear();
  for (const b of city.allBuildings()) {
    const mesh = buildBuildingMesh(b);
    mesh.position.y = GROUND_H;
    buildingRoot.add(mesh);
    buildingMeshes.set(b.id, mesh);
  }
  drawSelection();
}

city.onChange(syncCell);

// --- cursor & selection visuals --------------------------------------------
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
const cursor = new THREE.Mesh(new RoundedBoxGeometry(1, 0.05, 1, 2, 0.1), cursorMat);
cursor.visible = false;

const footprintMat = new THREE.MeshBasicMaterial({ color: 0xb9a4f0, transparent: true, opacity: 0.45 });
const footprint = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), footprintMat);
footprint.visible = false;

const selectionRoot = new THREE.Group();
const handleGeo = new RoundedBoxGeometry(0.9, 0.9, 0.9, 2, 0.18);
const handleMat = new THREE.MeshBasicMaterial({ color: 0xff92ae });
const handles: THREE.Mesh[] = [];
iso.scene.add(cursor, footprint, selectionRoot);

function drawSelection() {
  selectionRoot.clear();
  handles.length = 0;
  const b = selectedId ? city.getBuilding(selectedId) : null;
  if (!b) return;

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xff92ae, transparent: true, opacity: 0.85 });
  for (const [w, d, dx, dz] of [
    [b.w, 0.12, 0, -b.h / 2],
    [b.w, 0.12, 0, b.h / 2],
    [0.12, b.h, -b.w / 2, 0],
    [0.12, b.h, b.w / 2, 0],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), outlineMat);
    bar.position.set(b.x + b.w / 2 + dx, 0.09, b.y + b.h / 2 + dz);
    selectionRoot.add(bar);
  }

  // one grab handle per corner, sitting just outside the footprint so grabbing
  // one is never confused with clicking the building itself; it pins the opposite corner
  for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(b.x + cx * b.w + (cx ? 0.5 : -0.5), 0.45, b.y + cz * b.h + (cz ? 0.5 : -0.5));
    handle.userData.anchor = { x: cx ? b.x : b.x + b.w - 1, y: cz ? b.y : b.y + b.h - 1 };
    selectionRoot.add(handle);
    handles.push(handle);
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let hovered: { x: number; y: number } | null = null;

function updatePointer(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  iso.setRay(raycaster, pointer);
}

function updateHover(clientX: number, clientY: number) {
  updatePointer(clientX, clientY);
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    hovered = null;
  } else {
    const x = Math.floor(hitPoint.x);
    const y = Math.floor(hitPoint.z);
    hovered = city.inBounds(x, y) ? { x, y } : null;
  }
  cursor.visible = hovered !== null && mode !== 'select' && !drag;
  if (hovered) cursor.position.set(hovered.x + 0.5, 0.04, hovered.y + 0.5);
  showHoverInfo();
}

const hoverEl = document.getElementById('hover')!;

function showHoverInfo() {
  const b = hovered && city.buildingAt(hovered.x, hovered.y);
  hoverEl.classList.toggle('show', Boolean(b) && !drag);
  if (b) hoverEl.innerHTML = `<b>${b.no}</b> ${b.name} · <span>${b.floors} ชั้น</span>`;
}

// --- tools -----------------------------------------------------------------
type Mode = 'select' | 'place' | 'erase';
type Drag =
  | { kind: 'paint' }
  | { kind: 'draw'; start: { x: number; y: number } }
  | { kind: 'move'; id: string; grab: { dx: number; dy: number } }
  | { kind: 'resize'; id: string; anchor: { x: number; y: number } };

let mode: Mode = 'select';
let currentItem: string | null = null;
let selectedId: string | null = null;
let rotation = 0;
let drag: Drag | null = null;

const library = setupLibrary((id) => {
  currentItem = id;
  mode = 'place';
  refreshTools();
});

function refreshTools() {
  library.setActive(mode === 'place' ? currentItem : null, mode);
  cursorMat.color.set(mode === 'erase' ? 0xff8fa3 : 0xffffff);
  document.querySelector('[data-act="erase"]')?.classList.toggle('active', mode === 'erase');
  document.querySelector('[data-act="select"]')?.classList.toggle('active', mode === 'select');
}

function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

function showFootprint(r: { x: number; y: number; w: number; h: number }, exceptId?: string) {
  footprint.visible = true;
  footprint.scale.set(r.w, 1, r.h);
  footprint.position.set(r.x + r.w / 2, 0.05, r.y + r.h / 2);
  footprintMat.color.set(city.rectIsFree(r.x, r.y, r.w, r.h, exceptId) ? 0xb9a4f0 : 0xff8fa3);
}

function applyAt(x: number, y: number) {
  if (mode === 'erase') city.erase(x, y);
  else if (currentItem) city.place(x, y, currentItem, rotation);
}

function placeBuildingItem(itemId: string, x: number, y: number, size?: { w: number; h: number }) {
  const spec = CATALOG_BY_ID.get(itemId)?.building;
  if (!spec) return;
  city.addBuilding({
    no: spec.no,
    name: spec.name,
    kind: spec.kind,
    floors: spec.floors,
    x,
    y,
    w: size?.w ?? spec.w,
    h: size?.h ?? spec.h,
  });
}

canvas.addEventListener('pointermove', (e) => {
  updateHover(e.clientX, e.clientY);
  if (!hovered || !drag) return;

  if (drag.kind === 'paint') applyAt(hovered.x, hovered.y);
  else if (drag.kind === 'draw') showFootprint(rectBetween(drag.start, hovered));
  else if (drag.kind === 'resize') showFootprint(rectBetween(drag.anchor, hovered), drag.id);
  else {
    const b = city.getBuilding(drag.id)!;
    const r = { x: hovered.x - drag.grab.dx, y: hovered.y - drag.grab.dy, w: b.w, h: b.h };
    showFootprint(r, drag.id);
    buildingMeshes.get(drag.id)?.position.set(r.x + b.w / 2, GROUND_H, r.y + b.h / 2);
  }
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.shiftKey) return;
  updateHover(e.clientX, e.clientY);
  if (!hovered) return;

  if (mode === 'select') {
    const sel = selectedId ? city.getBuilding(selectedId) : null;
    const onBody =
      sel &&
      hovered.x >= sel.x &&
      hovered.x < sel.x + sel.w &&
      hovered.y >= sel.y &&
      hovered.y < sel.y + sel.h;

    if (sel && !onBody) {
      const grabbed = raycaster.intersectObjects(handles, false)[0];
      if (grabbed) {
        drag = { kind: 'resize', id: sel.id, anchor: grabbed.object.userData.anchor };
        selectionRoot.visible = false;
        showFootprint(rectBetween(drag.anchor, hovered), sel.id);
        return;
      }
    }

    const b = city.buildingAt(hovered.x, hovered.y);
    selectBuilding(b?.id ?? null);
    if (b) {
      drag = { kind: 'move', id: b.id, grab: { dx: hovered.x - b.x, dy: hovered.y - b.y } };
      selectionRoot.visible = false;
    }
    return;
  }

  const def = currentItem ? CATALOG_BY_ID.get(currentItem) : null;
  if (mode === 'place' && def?.layer === 'building') {
    drag = { kind: 'draw', start: hovered };
    showFootprint(rectBetween(hovered, hovered));
  } else {
    drag = { kind: 'paint' };
    applyAt(hovered.x, hovered.y);
  }
});

addEventListener('pointerup', () => {
  if (!drag) return;

  if (drag.kind === 'draw' && hovered && currentItem) {
    const r = rectBetween(drag.start, hovered);
    placeBuildingItem(currentItem, r.x, r.y, r);
  } else if (drag.kind === 'move' && hovered) {
    const b = city.getBuilding(drag.id)!;
    const x = hovered.x - drag.grab.dx;
    const y = hovered.y - drag.grab.dy;
    if (city.rectIsFree(x, y, b.w, b.h, b.id)) city.updateBuilding(b.id, { x, y });
    else syncBuildings();
  } else if (drag.kind === 'resize' && hovered) {
    const r = rectBetween(drag.anchor, hovered);
    if (city.rectIsFree(r.x, r.y, r.w, r.h, drag.id)) city.updateBuilding(drag.id, r);
  }

  drag = null;
  footprint.visible = false;
  selectionRoot.visible = true;
  drawSelection();
  city.save();
  showInspector();
});

// drag & drop from the library
canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
  updateHover(e.clientX, e.clientY);
});
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const id = e.dataTransfer?.getData('text/plain');
  const def = id ? CATALOG_BY_ID.get(id) : null;
  if (!def || !hovered) return;
  if (def.layer === 'building') placeBuildingItem(def.id, hovered.x, hovered.y);
  else city.place(hovered.x, hovered.y, def.id, rotation);
  city.save();
});

// --- inspector -------------------------------------------------------------
const inspector = document.getElementById('inspector')!;
const nameInput = inspector.querySelector('.name') as HTMLInputElement;

function selectBuilding(id: string | null) {
  selectedId = id;
  drawSelection();
  showInspector();
}

function showInspector() {
  const b = selectedId ? city.getBuilding(selectedId) : null;
  inspector.classList.toggle('show', Boolean(b));
  if (!b) return;
  (inspector.querySelector('.no') as HTMLElement).textContent = String(b.no);
  if (document.activeElement !== nameInput) nameInput.value = b.name;
  (inspector.querySelector('.floors') as HTMLElement).textContent = `${b.floors} ชั้น`;
  (inspector.querySelector('.size') as HTMLElement).textContent = `กว้าง ${b.w} × ยาว ${b.h} ช่อง`;
}

function patchSelected(patch: Partial<Building>) {
  if (!selectedId) return;
  city.updateBuilding(selectedId, patch);
  city.save();
  showInspector();
}

nameInput.addEventListener('input', () => patchSelected({ name: nameInput.value }));

const INSPECT: Record<string, () => void> = {
  'floor-up': () => {
    const b = selectedId && city.getBuilding(selectedId);
    if (b) patchSelected({ floors: Math.min(12, b.floors + 1) });
  },
  'floor-down': () => {
    const b = selectedId && city.getBuilding(selectedId);
    if (b) patchSelected({ floors: Math.max(1, b.floors - 1) });
  },
  delete: () => {
    if (!selectedId) return;
    city.removeBuilding(selectedId);
    city.save();
    selectBuilding(null);
  },
};

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-inspect]')) {
  btn.onclick = () => INSPECT[btn.dataset.inspect!]?.();
}

// --- toolbar actions -------------------------------------------------------
const ACTIONS: Record<string, () => void> = {
  select: () => {
    mode = 'select';
    refreshTools();
  },
  undo: () => (city.undo(), city.save(), selectBuilding(null)),
  redo: () => (city.redo(), city.save(), selectBuilding(null)),
  erase: () => {
    mode = mode === 'erase' ? 'select' : 'erase';
    selectBuilding(null);
    refreshTools();
  },
  clear: () => {
    if (confirm('ล้างผังทั้งหมดเลยไหม? (กดย้อนกลับได้)')) {
      city.clear();
      city.save();
      selectBuilding(null);
    }
  },
  reset: () => {
    if (confirm(`โหลดผังต้นฉบับของ${site.name}กลับมาใหม่ ทับของเดิมไหม?`)) {
      city.clear();
      seedSite();
      city.save();
      selectBuilding(null);
    }
  },
  export: exportPNG,
  'save-file': saveLayoutFile,
  'open-file': openLayoutFile,
  'view-mode': cycleViewMode,
  'rot-left': () => iso.rotateBy(-1),
  'rot-right': () => iso.rotateBy(1),
  'zoom-in': () => iso.zoomBy(-0.2),
  'zoom-out': () => iso.zoomBy(0.2),
};

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-act]')) {
  btn.onclick = () => ACTIONS[btn.dataset.act!]?.();
}

const VIEW_MODES: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: 'iso', icon: '🧊', label: '3D' },
  { mode: 'oblique', icon: '📐', label: 'มุมเฉียง' },
  { mode: 'plan', icon: '🗺', label: 'ผัง' },
];

function cycleViewMode() {
  const i = VIEW_MODES.findIndex((v) => v.mode === iso.mode);
  const next = VIEW_MODES[(i + 1) % VIEW_MODES.length];
  iso.setViewMode(next.mode);
  const btn = document.querySelector<HTMLButtonElement>('[data-act="view-mode"]')!;
  btn.textContent = next.icon;
  btn.title = `มุมมอง: ${next.label} — กดเพื่อสลับ (P)`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** the browser autosave lives in one browser only; a file can be kept, shared, and reopened */
function saveLayoutFile() {
  const json = JSON.stringify(city.toJSON(), null, 2);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  download(new Blob([json], { type: 'application/json' }), `spotwise-ผัง-${stamp}.json`);
}

function openLayoutFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const state = JSON.parse(await file.text());
      if (!state || typeof state.cells !== 'object') throw new Error('not a layout');
      const resized = state.width !== city.width || state.height !== city.height;
      const note = resized ? `
ขนาดผังจะเปลี่ยนจาก ${city.width}×${city.height} เป็น ${state.width}×${state.height} ช่องตามไฟล์` : '';
      if (!confirm(`เปิดผัง "${file.name}" ทับผังปัจจุบันไหม?${note}`)) return;
      if (resized) {
        // the plate size is fixed for a page, so store the plan at its own size and reload
        resizeSite(site.id, state);
        return openSite(site.id);
      }
      city.load(state);
      city.save();
      selectBuilding(null);
    } catch {
      alert('อ่านไฟล์ไม่ได้ — ต้องเป็นไฟล์ .json ที่บันทึกจาก Spotwise');
    }
  };
  input.click();
}

function exportPNG() {
  const wasSelected = selectedId;
  selectBuilding(null);
  cursor.visible = false;
  iso.update();
  canvas.toBlob((blob) => {
    selectBuilding(wasSelected);
    if (!blob) return;
    download(blob, `spotwise-${Date.now()}.png`);
  });
}

addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  const key = e.key.toLowerCase();
  if (key === 'r') rotation = (rotation + 1) % 4;
  if (key === 'x') ACTIONS.erase();
  if (key === 'v') ACTIONS.select();
  if (key === 'p') cycleViewMode();
  if (key === 'q') iso.rotateBy(-1);
  if (key === 'e') iso.rotateBy(1);
  if (key === 'escape') selectBuilding(null);
  if (key === 'delete' || key === 'backspace') INSPECT.delete();
  if (key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    (e.shiftKey ? ACTIONS.redo : ACTIONS.undo)();
  }
});

// --- sites -------------------------------------------------------------------
function setupSitePicker() {
  const picker = document.getElementById('site-picker') as HTMLSelectElement;
  for (const s of allSites()) picker.add(new Option(s.name, s.id, false, s.id === site.id));
  picker.add(new Option(`📏 ปรับขนาดผัง (${site.width}×${site.height})…`, '__resize'));
  picker.add(new Option('➕ เพิ่มสถานที่ใหม่…', '__new'));
  if (!site.builtin) picker.add(new Option('🗑️ ลบสถานที่นี้…', '__delete'));
  document.title = `Spotwise — ${site.name}`;

  picker.onchange = () => {
    const value = picker.value;
    picker.value = site.id;
    if (value === '__new') return addSite();
    if (value === '__resize') return resizePlan();
    if (value === '__delete') {
      if (confirm(`ลบ "${site.name}" และผังทั้งหมดของสถานที่นี้? (ย้อนกลับไม่ได้)`)) {
        deleteSite(site.id);
        openSite('roiet');
      }
      return;
    }
    openSite(value);
  };
}

function askSize(message: string, initial: string): [number, number] | null {
  const size = prompt(message, initial);
  if (size == null) return null;
  const match = size.match(/^\s*(\d+)\s*[x×*,\s]\s*(\d+)\s*$/i);
  if (!match) {
    alert('ใส่ขนาดเป็น กว้างxยาว เช่น 30x20');
    return null;
  }
  const [w, h] = [Number(match[1]), Number(match[2])];
  if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) {
    alert(`ขนาดต้องอยู่ระหว่าง ${MIN_SIZE} ถึง ${MAX_SIZE} ช่อง`);
    return null;
  }
  return [w, h];
}

function addSite() {
  const name = prompt('ชื่อสถานที่ใหม่')?.trim();
  if (!name) return;
  const size = askSize('ขนาดผัง กว้าง × ยาว (ช่อง) เช่น 30x20', '30x20');
  if (size) openSite(createSite(name, ...size).id);
}

/** grows or crops from the top-left corner; new ground is lawn, things past the new edge are removed */
function resizePlan() {
  const size = askSize(
    `ขนาดผังใหม่ กว้าง × ยาว (ตอนนี้ ${city.width}×${city.height})
ขยาย: พื้นที่ใหม่เป็นสนามหญ้า · ย่อ: ของที่เลยขอบขวา/ล่างจะถูกลบ`,
    `${city.width}x${city.height}`,
  );
  if (!size) return;
  const [width, height] = size;
  if (width === city.width && height === city.height) return;
  const state = city.toJSON();
  const lost = state.buildings.filter((b) => b.x + b.w > width || b.y + b.h > height);
  if (lost.length && !confirm(`อาคาร ${lost.map((b) => b.no).join(', ')} จะอยู่นอกผังและถูกลบ ทำต่อไหม?`)) return;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (x < city.width && y < city.height) continue;
      const variant = Math.floor(Math.random() * 4);
      state.cells[City.key(x, y)] = { ground: { id: 'grass', rotation: 0, variant } };
    }
  }
  resizeSite(site.id, { ...state, width, height });
  openSite(site.id);
}

setupSitePicker();

// --- boot ------------------------------------------------------------------
if (!city.restore()) {
  seedSite();
  city.save();
}
syncCell('*');
refreshTools();

function seedSite() {
  const original = shippedOriginal(site.id);
  if (original && original.width === city.width && original.height === city.height) {
    city.load(original);
    return;
  }
  city.batch(() => {
    if (site.id !== 'roiet') {
      // a new site starts as an empty lawn
      for (let x = 0; x < city.width; x++) for (let y = 0; y < city.height; y++) city.place(x, y, 'grass');
      return;
    }
    for (const [x0, y0, x1, y1, id] of SITE_GROUND) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) city.place(x, y, id);
    }
    for (const [x, y, id] of SITE_PROPS) city.place(x, y, id);
    for (const b of SITE_BUILDINGS) city.addBuilding(b);
  });
}

// --- loop ------------------------------------------------------------------
function frame() {
  for (let i = popping.length - 1; i >= 0; i--) {
    const pop = popping[i];
    pop.t = Math.min(1, pop.t + 0.12);
    // overshoot then settle — the little bounce that makes placing feel good
    const e = 1 + 2.2 * Math.pow(1 - pop.t, 3) * Math.sin(pop.t * Math.PI * 1.6);
    pop.group.scale.setScalar(pop.t === 1 ? 1 : 0.4 + 0.6 * pop.t * e);
    if (pop.t === 1) popping.splice(i, 1);
  }
  iso.update();
  requestAnimationFrame(frame);
}
frame();
