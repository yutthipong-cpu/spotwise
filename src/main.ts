import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { City } from './city';
import { IsoScene } from './scene';
import { GROUND_H, buildPlacementMesh } from './meshes';
import { CATALOG_BY_ID } from './catalog';
import { setupLibrary } from './ui';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const city = new City(16);
const iso = new IsoScene(canvas, city.size);
const half = city.size / 2;

// --- terrain ---------------------------------------------------------------
const soil = new THREE.Mesh(
  new RoundedBoxGeometry(city.size + 0.4, 1.6, city.size + 0.4, 3, 0.3),
  new THREE.MeshLambertMaterial({ color: 0xc79a70 }),
);
soil.position.set(half, -0.8, half);
soil.receiveShadow = true;

const lawn = new THREE.Mesh(
  new RoundedBoxGeometry(city.size, 0.5, city.size, 3, 0.16),
  new THREE.MeshLambertMaterial({ color: 0xa9dd8b }),
);
lawn.position.set(half, -0.25, half);
lawn.receiveShadow = true;

const grid = new THREE.GridHelper(city.size, city.size, 0x86bd6a, 0x86bd6a);
grid.position.set(half, 0.03, half);
const gridMat = grid.material as THREE.Material;
gridMat.transparent = true;
gridMat.opacity = 0.35;
gridMat.depthWrite = false;

iso.scene.add(soil, lawn, grid);

// --- cell rendering --------------------------------------------------------
const cellRoot = new THREE.Group();
iso.scene.add(cellRoot);
const rendered = new Map<string, THREE.Group>();
const popping: { group: THREE.Group; t: number }[] = [];

function disposeCell(key: string) {
  const old = rendered.get(key);
  if (!old) return;
  cellRoot.remove(old);
  old.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
  rendered.delete(key);
}

function syncCell(key: string) {
  if (key === '*') {
    for (const k of [...rendered.keys()]) disposeCell(k);
    for (const [k] of city.entries()) syncCell(k);
    return;
  }

  const hadMesh = rendered.has(key);
  disposeCell(key);

  const [x, y] = key.split(',').map(Number);
  const cell = city.get(x, y);
  if (!cell) return;

  const group = new THREE.Group();
  if (cell.ground) {
    const mesh = buildPlacementMesh(cell.ground, 'ground');
    if (mesh) group.add(mesh);
  }
  if (cell.object) {
    const mesh = buildPlacementMesh(cell.object, 'object');
    if (mesh) {
      mesh.position.y = cell.ground ? GROUND_H : 0;
      group.add(mesh);
    }
  }

  group.position.set(x + 0.5, 0, y + 0.5);
  cellRoot.add(group);
  rendered.set(key, group);

  if (!hadMesh) {
    group.scale.set(0.4, 0.4, 0.4);
    popping.push({ group, t: 0 });
  }
}

city.onChange(syncCell);

// --- cursor ----------------------------------------------------------------
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
const cursor = new THREE.Mesh(new RoundedBoxGeometry(1, 0.05, 1, 2, 0.1), cursorMat);
cursor.visible = false;
iso.scene.add(cursor);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let hovered: { x: number; y: number } | null = null;

function updateHover(clientX: number, clientY: number) {
  pointer.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, iso.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    hovered = null;
  } else {
    const x = Math.floor(hitPoint.x);
    const y = Math.floor(hitPoint.z);
    hovered = city.inBounds(x, y) ? { x, y } : null;
  }
  cursor.visible = hovered !== null;
  if (hovered) cursor.position.set(hovered.x + 0.5, 0.04, hovered.y + 0.5);
}

// --- tools -----------------------------------------------------------------
let currentItem: string | null = 'house';
let erasing = false;
let rotation = 0;
let painting = false;

const library = setupLibrary((id) => {
  currentItem = id;
  erasing = false;
  refreshTools();
});

function refreshTools() {
  library.setActive(erasing ? null : currentItem);
  cursorMat.color.set(erasing ? 0xff8fa3 : 0xffffff);
  document.querySelector('[data-act="erase"]')?.classList.toggle('active', erasing);
}

function applyAt(x: number, y: number) {
  if (erasing) city.erase(x, y);
  else if (currentItem) city.place(x, y, currentItem, rotation);
}

canvas.addEventListener('pointermove', (e) => {
  updateHover(e.clientX, e.clientY);
  if (painting && hovered) applyAt(hovered.x, hovered.y);
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.shiftKey) return;
  painting = true;
  updateHover(e.clientX, e.clientY);
  if (hovered) applyAt(hovered.x, hovered.y);
});

addEventListener('pointerup', () => {
  if (!painting) return;
  painting = false;
  city.save();
});

// drag & drop from the library, the Icograms-style way in
canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
  updateHover(e.clientX, e.clientY);
});
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const id = e.dataTransfer?.getData('text/plain');
  if (!id || !CATALOG_BY_ID.has(id) || !hovered) return;
  city.place(hovered.x, hovered.y, id, rotation);
  city.save();
});

// --- toolbar actions -------------------------------------------------------
const ACTIONS: Record<string, () => void> = {
  undo: () => (city.undo(), city.save()),
  redo: () => (city.redo(), city.save()),
  erase: () => {
    erasing = !erasing;
    refreshTools();
  },
  clear: () => {
    if (confirm('ล้างแผนที่ทั้งหมดเลยไหม? (กดย้อนกลับได้)')) {
      city.clear();
      city.save();
    }
  },
  export: exportPNG,
  'rot-left': () => iso.rotateBy(-1),
  'rot-right': () => iso.rotateBy(1),
  'zoom-in': () => iso.zoomBy(-0.2),
  'zoom-out': () => iso.zoomBy(0.2),
};

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-act]')) {
  btn.onclick = () => ACTIONS[btn.dataset.act!]?.();
}

function exportPNG() {
  cursor.visible = false;
  grid.visible = false;
  iso.update();
  canvas.toBlob((blob) => {
    grid.visible = true;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tribemap-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  const key = e.key.toLowerCase();
  if (key === 'r') rotation = (rotation + 1) % 4;
  if (key === 'x') ACTIONS.erase();
  if (key === 'q') iso.rotateBy(-1);
  if (key === 'e') iso.rotateBy(1);
  if (key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    (e.shiftKey ? ACTIONS.redo : ACTIONS.undo)();
  }
});

// --- boot ------------------------------------------------------------------
if (!city.restore()) seedDemo();
syncCell('*');
refreshTools();

function seedDemo() {
  for (let i = 0; i < city.size; i++) {
    city.place(i, 7, 'road');
    city.place(7, i, 'road');
  }
  const layout: [number, number, string][] = [
    [5, 5, 'house'], [4, 5, 'house2'], [5, 4, 'tower'], [10, 10, 'tower'],
    [11, 10, 'shop'], [10, 11, 'cafe'], [3, 10, 'school'], [11, 4, 'hospital'],
    [2, 2, 'tree'], [3, 2, 'pine'], [2, 3, 'bush'], [13, 13, 'tree'],
    [2, 13, 'water'], [3, 13, 'water'], [2, 12, 'water'], [13, 2, 'flower'],
    [6, 7, 'car'], [7, 10, 'bus'], [8, 7, 'lamp'], [9, 6, 'bench'],
    [4, 8, 'fountain'], [12, 7, 'sign'],
  ];
  for (const [x, y, id] of layout) city.place(x, y, id);
}

// --- loop ------------------------------------------------------------------
function frame() {
  for (let i = popping.length - 1; i >= 0; i--) {
    const pop = popping[i];
    pop.t = Math.min(1, pop.t + 0.12);
    // overshoot then settle — the little bounce that makes placing feel good
    const e = 1 + 2.2 * Math.pow(1 - pop.t, 3) * Math.sin(pop.t * Math.PI * 1.6);
    const s = 0.4 + 0.6 * pop.t * e;
    pop.group.scale.setScalar(pop.t === 1 ? 1 : s);
    if (pop.t === 1) popping.splice(i, 1);
  }
  iso.update();
  requestAnimationFrame(frame);
}
frame();
