import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Building, BuildingKind } from './city';

export const FLOOR_H = 0.38;

export const BUILDING_KINDS: Record<BuildingKind, { label: string; icon: string; floors: number }> = {
  classroom: { label: 'อาคารเรียน', icon: '🏫', floors: 4 },
  auditorium: { label: 'หอประชุม', icon: '🎪', floors: 1 },
  dome: { label: 'โดม', icon: '⛺', floors: 1 },
  canteen: { label: 'โรงอาหาร', icon: '🍽️', floors: 1 },
  library: { label: 'ห้องสมุด', icon: '📚', floors: 1 },
  service: { label: 'อาคารบริการ', icon: '🏢', floors: 1 },
  toilet: { label: 'ห้องน้ำ', icon: '🚻', floors: 1 },
  carport: { label: 'โรงรถ', icon: '🚗', floors: 1 },
  guard: { label: 'ป้อมยาม', icon: '🛡️', floors: 1 },
};

const P = {
  cream: 0xfff3e2,
  sand: 0xf3e3c8,
  white: 0xfffdf8,
  mint: 0xbfe8d6,
  sky: 0xc9e7ff,
  peach: 0xffd8b8,
  lilac: 0xdccdf8,
  coral: 0xff9b93,
  teal: 0x6fc6bd,
  plum: 0xa090cf,
  mustard: 0xf7c66a,
  slate: 0x93a0bd,
  concrete: 0xe3ddd2,
  glass: 0xcfe9fb,
  rail: 0xfefcf6,
  door: 0xc9956b,
  pink: 0xffc3cd,
};

const WALLS = [P.cream, P.sand, P.white, P.peach];
const ROOFS = [P.coral, P.teal, P.plum, P.mustard];

const cache = new Map<number, THREE.MeshLambertMaterial>();
const m = (color: number) => {
  let mat = cache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    cache.set(color, mat);
  }
  return mat;
};

const rbox = (w: number, h: number, d: number, color: number, r = 0.06) =>
  new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) / 2.05)), m(color));

const cyl = (rTop: number, rBottom: number, h: number, color: number, seg = 10) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), m(color));

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};

/** window band + walkway rail along whichever pair of faces is longer */
function storeyBands(g: THREE.Group, y: number, w: number, d: number, rail: number) {
  const front = w >= d;
  const span = (front ? w : d) * 0.88;
  const off = (front ? d : w) / 2;
  for (const side of [1, -1]) {
    const band = rbox(span, 0.15, 0.04, P.glass, 0.03);
    const bar = rbox(span, 0.05, 0.06, rail, 0.02);
    if (front) {
      g.add(at(band, 0, y, side * off));
      g.add(at(bar, 0, y - 0.12, side * (off + 0.02)));
    } else {
      band.rotation.y = Math.PI / 2;
      bar.rotation.y = Math.PI / 2;
      g.add(at(band, side * off, y, 0));
      g.add(at(bar, side * (off + 0.02), y - 0.12, 0));
    }
  }
}

function ringPillars(g: THREE.Group, w: number, d: number, h: number, color: number, step = 1.4) {
  const nx = Math.max(2, Math.round(w / step));
  const nz = Math.max(2, Math.round(d / step));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      if (i > 0 && i < nx && j > 0 && j < nz) continue;
      const x = -w / 2 + (i * w) / nx;
      const z = -d / 2 + (j * d) / nz;
      g.add(at(cyl(0.05, 0.06, h, color, 8), x, h / 2, z));
    }
  }
}

const gable = (color: number, w: number, d: number, h: number) => {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, h, 4), m(color));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, Math.min(w, d) / Math.max(w, d));
  if (d > w) roof.scale.set(Math.min(w, d) / Math.max(w, d), 1, 1);
  return roof;
};

type KindBuilder = (g: THREE.Group, w: number, d: number, b: Building) => void;

const BUILDERS: Record<BuildingKind, KindBuilder> = {
  classroom: (g, w, d, b) => {
    const h = FLOOR_H * b.floors;
    const wall = WALLS[b.no % WALLS.length];
    g.add(at(rbox(w, h, d, wall, 0.08), 0, h / 2, 0));
    for (let f = 0; f < b.floors; f++) storeyBands(g, 0.24 + f * FLOOR_H, w, d, f % 2 ? P.mint : P.sky);
    g.add(at(rbox(w + 0.14, 0.09, d + 0.14, ROOFS[b.no % ROOFS.length], 0.04), 0, h + 0.045, 0));
  },
  auditorium: (g, w, d, b) => {
    const h = FLOOR_H * 2.2;
    g.add(at(rbox(w, h, d, P.cream, 0.1), 0, h / 2, 0));
    storeyBands(g, 0.3, w, d, P.mint);
    storeyBands(g, 0.72, w, d, P.mint);
    // #9 has a usable roof deck, so it gets a slab with a railing instead of a pitch
    g.add(at(rbox(w + 0.16, 0.1, d + 0.16, P.concrete, 0.04), 0, h + 0.05, 0));
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const rail = rbox(sx ? 0.07 : w, 0.16, sz ? 0.07 : d, P.rail, 0.03);
      g.add(at(rail, (sx * (w + 0.1)) / 2, h + 0.18, (sz * (d + 0.1)) / 2));
    }
    g.add(at(rbox(Math.min(w, d) * 0.5, 0.1, 0.5, ROOFS[1], 0.04), 0, FLOOR_H * 1.1, d / 2 + 0.2));
    g.add(at(rbox(Math.min(w, d) * 0.4, 0.5, 0.06, P.glass, 0.04), 0, 0.3, d / 2 + 0.02));
  },
  dome: (g, w, d) => {
    g.add(at(rbox(w, 0.1, d, P.concrete, 0.05), 0, 0.05, 0));
    ringPillars(g, w - 0.3, d - 0.3, 0.72, P.white, 1.6);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      m(P.sky),
    );
    shell.scale.set(w * 0.62, Math.min(w, d) * 0.3, d * 0.62);
    g.add(at(shell, 0, 0.72, 0));
    g.add(at(cyl(0.06, 0.08, 0.16, P.white, 8), 0, Math.min(w, d) * 0.3 + 0.76, 0));
  },
  canteen: (g, w, d) => {
    g.add(at(rbox(w, 0.1, d, P.concrete, 0.05), 0, 0.05, 0));
    ringPillars(g, w - 0.3, d - 0.3, 0.6, P.cream, 1.5);
    g.add(at(gable(P.mustard, w + 0.3, d + 0.3, 0.42), 0, 0.82, 0));
    for (let i = 0; i < Math.max(1, Math.floor(w / 1.2)); i++) {
      const x = -w / 2 + 0.7 + i * 1.2;
      g.add(at(rbox(0.8, 0.06, 0.4, P.cream, 0.03), x, 0.36, 0));
      for (const z of [-0.3, 0.3]) g.add(at(rbox(0.8, 0.05, 0.14, P.teal, 0.02), x, 0.22, z));
    }
  },
  library: (g, w, d, b) => {
    const h = FLOOR_H * b.floors;
    g.add(at(rbox(w, h, d, P.peach, 0.08), 0, h / 2, 0));
    for (let f = 0; f < b.floors; f++) storeyBands(g, 0.24 + f * FLOOR_H, w, d, P.mint);
    g.add(at(gable(P.teal, w + 0.2, d + 0.2, 0.34), 0, h + 0.17, 0));
  },
  service: (g, w, d, b) => {
    const h = FLOOR_H * b.floors;
    g.add(at(rbox(w, h, d, WALLS[(b.no + 1) % WALLS.length], 0.07), 0, h / 2, 0));
    for (let f = 0; f < b.floors; f++) storeyBands(g, 0.24 + f * FLOOR_H, w, d, P.lilac);
    g.add(at(rbox(w + 0.12, 0.08, d + 0.12, ROOFS[(b.no + 2) % ROOFS.length], 0.03), 0, h + 0.04, 0));
    g.add(at(rbox(0.3, 0.28, 0.05, P.door, 0.03), 0, 0.14, d / 2 + 0.02));
  },
  toilet: (g, w, d) => {
    const h = FLOOR_H;
    g.add(at(rbox(w, h, d, P.sky, 0.07), 0, h / 2, 0));
    for (const [i, color] of [P.pink, P.lilac].entries()) {
      g.add(at(rbox(0.22, 0.26, 0.05, color, 0.03), (i - 0.5) * 0.5, 0.13, d / 2 + 0.02));
    }
    g.add(at(rbox(w + 0.14, 0.07, d + 0.14, P.white, 0.03), 0, h + 0.035, 0));
  },
  carport: (g, w, d) => {
    g.add(at(rbox(w, 0.08, d, P.concrete, 0.04), 0, 0.04, 0));
    ringPillars(g, w - 0.25, d - 0.25, 0.5, P.slate, 1.5);
    g.add(at(rbox(w + 0.2, 0.09, d + 0.2, P.teal, 0.04), 0, 0.56, 0));
  },
  guard: (g, w, d) => {
    const h = FLOOR_H * 0.9;
    g.add(at(rbox(w, h, d, P.cream, 0.06), 0, h / 2, 0));
    g.add(at(rbox(w * 0.6, 0.16, 0.05, P.glass, 0.03), 0, h * 0.62, d / 2 + 0.01));
    g.add(at(gable(P.coral, w + 0.18, d + 0.18, 0.24), 0, h + 0.12, 0));
  },
};

// --- number badge ----------------------------------------------------------
const labelCache = new Map<string, THREE.SpriteMaterial>();

function labelMaterial(text: string) {
  let mat = labelCache.get(text);
  if (mat) return mat;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#b9a4f0';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5b5266';
  ctx.font = `bold ${text.length > 2 ? 46 : 62}px 'Mali', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  labelCache.set(text, mat);
  return mat;
}

export function buildBuildingMesh(b: Building) {
  const group = new THREE.Group();
  const w = b.w - 0.18;
  const d = b.h - 0.18;

  BUILDERS[b.kind](group, w, d, b);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const badge = new THREE.Sprite(labelMaterial(String(b.no)));
  badge.scale.setScalar(0.9);
  badge.position.y = heightOf(b) + 0.65;
  badge.renderOrder = 10;
  group.add(badge);

  group.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
  return group;
}

export function heightOf(b: Building) {
  if (b.kind === 'dome') return Math.min(b.w, b.h) * 0.3 + 0.9;
  if (b.kind === 'auditorium') return FLOOR_H * 2.2 + 0.3;
  if (b.kind === 'canteen') return 1.05;
  if (b.kind === 'carport') return 0.65;
  return FLOOR_H * b.floors + 0.2;
}
