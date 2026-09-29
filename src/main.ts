import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { City } from './city';
import { IsoScene } from './scene';
import { GROUND_H, buildPlacementMesh } from './meshes';
import { BUILDING_KINDS, buildBuildingMesh } from './buildings';
import { CATALOG_BY_ID } from './catalog';
import { setupLibrary } from './ui';
import { SITE_BUILDINGS, SITE_GROUND, SITE_H, SITE_PROPS, SITE_W } from './site-roiet';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const city = new City(SITE_W, SITE_H);
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

// --- cell rendering --------------------------------------------------------
const cellRoot = new THREE.Group();
const buildingRoot = new THREE.Group();
iso.scene.add(cellRoot, buildingRoot);

const rendered = new Map<string, THREE.Group>();
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
  for (const b of city.allBuildings()) {
    const mesh = buildBuildingMesh(b);
    mesh.position.y = GROUND_H;
    buildingRoot.add(mesh);
  }
}

city.onChange(syncCell);

// --- cursor ----------------------------------------------------------------
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
const cursor = new THREE.Mesh(new RoundedBoxGeometry(1, 0.05, 1, 2, 0.1), cursorMat);
cursor.visible = false;

const footprintMat = new THREE.MeshBasicMaterial({ color: 0xb9a4f0, transparent: true, opacity: 0.45 });
const footprint = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), footprintMat);
footprint.visible = false;
iso.scene.add(cursor, footprint);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let hovered: { x: number; y: number } | null = null;

function updateHover(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, iso.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    hovered = null;
  } else {
    const x = Math.floor(hitPoint.x);
    const y = Math.floor(hitPoint.z);
    hovered = city.inBounds(x, y) ? { x, y } : null;
  }
  cursor.visible = hovered !== null && !dragStart;
  if (hovered) cursor.position.set(hovered.x + 0.5, 0.04, hovered.y + 0.5);
  showBuildingInfo();
}

const hoverEl = document.getElementById('hover')!;

function showBuildingInfo() {
  const b = hovered && city.buildingAt(hovered.x, hovered.y);
  hoverEl.classList.toggle('show', Boolean(b));
  if (b) {
    hoverEl.innerHTML = `<b>${b.no}</b> ${b.name} · <span>${b.floors} ชั้น</span>`;
  }
}

// --- tools -----------------------------------------------------------------
let currentItem: string | null = 'classroom';
let erasing = false;
let rotation = 0;
let painting = false;
let dragStart: { x: number; y: number } | null = null;

const library = setupLibrary((id) => {
  currentItem = id;
  erasing = false;
  refreshTools();
});

const isBuildingTool = () => !erasing && CATALOG_BY_ID.get(currentItem ?? '')?.layer === 'building';

function refreshTools() {
  library.setActive(erasing ? null : currentItem);
  cursorMat.color.set(erasing ? 0xff8fa3 : 0xffffff);
  document.querySelector('[data-act="erase"]')?.classList.toggle('active', erasing);
}

function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

function showFootprint(r: { x: number; y: number; w: number; h: number }) {
  footprint.visible = true;
  footprint.scale.set(r.w, 1, r.h);
  footprint.position.set(r.x + r.w / 2, 0.05, r.y + r.h / 2);
  footprintMat.color.set(city.rectIsFree(r.x, r.y, r.w, r.h) ? 0xb9a4f0 : 0xff8fa3);
}

function applyAt(x: number, y: number) {
  if (erasing) city.erase(x, y);
  else if (currentItem) city.place(x, y, currentItem, rotation);
}

canvas.addEventListener('pointermove', (e) => {
  updateHover(e.clientX, e.clientY);
  if (!hovered) return;
  if (dragStart) showFootprint(rectBetween(dragStart, hovered));
  else if (painting) applyAt(hovered.x, hovered.y);
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.shiftKey) return;
  updateHover(e.clientX, e.clientY);
  if (!hovered) return;

  if (isBuildingTool()) {
    dragStart = hovered;
    cursor.visible = false;
    showFootprint(rectBetween(hovered, hovered));
  } else {
    painting = true;
    applyAt(hovered.x, hovered.y);
  }
});

addEventListener('pointerup', () => {
  if (dragStart && hovered && currentItem) {
    const rect = rectBetween(dragStart, hovered);
    const kind = currentItem as keyof typeof BUILDING_KINDS;
    city.addBuilding({
      ...rect,
      kind,
      name: BUILDING_KINDS[kind].label,
      floors: CATALOG_BY_ID.get(currentItem)?.floors ?? 1,
    });
    city.save();
  }
  dragStart = null;
  footprint.visible = false;

  if (painting) {
    painting = false;
    city.save();
  }
});

// drag & drop from the library, the Icograms-style way in
canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
  updateHover(e.clientX, e.clientY);
});
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const id = e.dataTransfer?.getData('text/plain');
  const def = id ? CATALOG_BY_ID.get(id) : null;
  if (!def || !hovered) return;
  if (def.layer === 'building') {
    city.addBuilding({
      x: hovered.x,
      y: hovered.y,
      w: 3,
      h: 2,
      kind: def.id as keyof typeof BUILDING_KINDS,
      name: BUILDING_KINDS[def.id as keyof typeof BUILDING_KINDS].label,
      floors: def.floors ?? 1,
    });
  } else {
    city.place(hovered.x, hovered.y, def.id, rotation);
  }
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
    if (confirm('ล้างผังทั้งหมดเลยไหม? (กดย้อนกลับได้)')) {
      city.clear();
      city.save();
    }
  },
  reset: () => {
    if (confirm('โหลดผังวิทยาลัยอาชีวศึกษาร้อยเอ็ดกลับมาใหม่ ทับของเดิมไหม?')) {
      city.clear();
      seedSite();
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
  iso.update();
  canvas.toBlob((blob) => {
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
if (!city.restore()) {
  seedSite();
  city.save();
}
syncCell('*');
refreshTools();

function seedSite() {
  city.batch(() => {
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
