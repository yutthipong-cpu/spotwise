import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Placement } from './city';

export const GROUND_H = 0.12;

const C = {
  grass: 0xa9dd8b,
  grassDeep: 0x93d173,
  water: 0x8ad4f2,
  waterDeep: 0x6ec2e8,
  road: 0xcfc6b8,
  roadLine: 0xfff7e8,
  path: 0xf3e7d3,
  plaza: 0xf6efe4,
  sand: 0xf6dfb4,
  cream: 0xfff4e4,
  pink: 0xffc2c7,
  mint: 0xb2e5d2,
  lilac: 0xd8caf7,
  peach: 0xffd7b0,
  sky: 0xc3e6ff,
  coral: 0xff9a9a,
  teal: 0x74cbc4,
  plum: 0xa494d4,
  mustard: 0xffcb6e,
  slate: 0x8d97b8,
  trunk: 0xc08f68,
  leaf: 0x7cc36a,
  leafDeep: 0x5faa52,
  leafLime: 0x9dd87f,
  white: 0xfffdf8,
  glass: 0xd6eefc,
  stone: 0xc9c6cb,
  dark: 0x6b6f86,
};

const cache = new Map<number, THREE.MeshLambertMaterial>();
const m = (color: number) => {
  let mat = cache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    cache.set(color, mat);
  }
  return mat;
};

const rbox = (w: number, h: number, d: number, color: number, r = 0.05) =>
  new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) / 2.05)), m(color));

const ball = (r: number, color: number) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m(color));

const cyl = (rTop: number, rBottom: number, h: number, color: number, seg = 12) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), m(color));

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};

const WALLS = [C.cream, C.pink, C.mint, C.lilac];
const ROOFS = [C.coral, C.teal, C.plum, C.mustard];

// --- ground tiles ----------------------------------------------------------
// a slab slightly smaller than the cell leaves a hairline gap, which reads as
// soft stitched patchwork rather than one flat plane
function slab(color: number, height = GROUND_H) {
  const g = new THREE.Group();
  g.add(at(rbox(0.98, height, 0.98, color, 0.05), 0, height / 2, 0));
  return g;
}

const GROUND_BUILDERS: Record<string, (p: Placement) => THREE.Group> = {
  grass: (p) => {
    const g = slab(p.variant % 2 ? C.grassDeep : C.grass);
    for (let i = 0; i < 3; i++) {
      const blade = cyl(0.012, 0.02, 0.1, C.leafDeep, 5);
      const a = (i / 3) * Math.PI * 2 + p.variant;
      g.add(at(blade, Math.cos(a) * 0.28, GROUND_H + 0.05, Math.sin(a) * 0.28));
    }
    return g;
  },
  road: () => {
    const g = slab(C.road);
    g.add(at(rbox(0.26, 0.03, 0.08, C.roadLine, 0.015), 0, GROUND_H, 0));
    return g;
  },
  path: () => {
    const g = slab(C.path);
    for (const x of [-0.24, 0.24]) g.add(at(rbox(0.3, 0.02, 0.3, C.plaza, 0.04), x, GROUND_H, 0));
    return g;
  },
  plaza: () => slab(C.plaza),
  sand: (p) => {
    const g = slab(C.sand);
    if (p.variant % 2) g.add(at(ball(0.05, C.stone), 0.2, GROUND_H + 0.02, -0.2));
    return g;
  },
  water: () => {
    const g = slab(C.water, GROUND_H * 0.7);
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 16), m(C.waterDeep));
    ripple.rotation.x = -Math.PI / 2;
    g.add(at(ripple, 0, GROUND_H * 0.7 + 0.01, 0.06));
    return g;
  },
};

// --- buildings -------------------------------------------------------------
function windows(group: THREE.Group, rows: number, y0: number, step: number, width: number) {
  for (let r = 0; r < rows; r++) {
    for (const x of [-width / 4, width / 4]) {
      group.add(at(rbox(0.14, 0.16, 0.03, C.glass, 0.04), x, y0 + r * step, width / 2 + 0.005));
    }
  }
}

function gableRoof(color: number, width: number, height: number) {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.78, height, 4), m(color));
  roof.rotation.y = Math.PI / 4;
  return roof;
}

const OBJECT_BUILDERS: Record<string, (p: Placement) => THREE.Group> = {
  house: (p) => {
    const g = new THREE.Group();
    const wall = WALLS[p.variant % 4];
    const roof = ROOFS[p.variant % 4];
    g.add(at(rbox(0.66, 0.42, 0.66, wall, 0.1), 0, 0.21, 0));
    windows(g, 1, 0.24, 0, 0.66);
    g.add(at(rbox(0.16, 0.24, 0.04, C.trunk, 0.03), 0, 0.12, 0.34));
    g.add(at(gableRoof(roof, 0.66, 0.34), 0, 0.59, 0));
    g.add(at(rbox(0.1, 0.2, 0.1, roof, 0.03), 0.18, 0.66, -0.14));
    return g;
  },
  house2: (p) => {
    const g = new THREE.Group();
    const wall = WALLS[(p.variant + 1) % 4];
    const roof = ROOFS[(p.variant + 2) % 4];
    g.add(at(rbox(0.68, 0.76, 0.62, wall, 0.1), 0, 0.38, 0));
    windows(g, 2, 0.26, 0.34, 0.62);
    g.add(at(gableRoof(roof, 0.7, 0.32), 0, 0.92, 0));
    g.add(at(rbox(0.34, 0.06, 0.24, roof, 0.03), 0, 0.5, 0.42));
    return g;
  },
  tower: (p) => {
    const g = new THREE.Group();
    const floors = 5 + (p.variant % 4);
    const h = 0.32 * floors;
    g.add(at(rbox(0.62, h, 0.62, WALLS[p.variant % 4], 0.08), 0, h / 2, 0));
    for (let f = 0; f < floors; f++) {
      const band = at(rbox(0.5, 0.15, 0.64, C.glass, 0.05), 0, 0.2 + f * 0.32, 0);
      g.add(band);
      const cross = band.clone();
      cross.rotation.y = Math.PI / 2;
      g.add(cross);
    }
    g.add(at(rbox(0.68, 0.07, 0.68, C.leafLime, 0.03), 0, h + 0.035, 0));
    g.add(at(cyl(0.02, 0.02, 0.22, C.slate, 6), 0.18, h + 0.14, 0.18));
    return g;
  },
  shop: (p) => {
    const g = new THREE.Group();
    g.add(at(rbox(0.74, 0.44, 0.6, C.cream, 0.08), 0, 0.22, 0));
    g.add(at(rbox(0.78, 0.1, 0.64, ROOFS[p.variant % 4], 0.04), 0, 0.49, 0));
    g.add(at(rbox(0.6, 0.22, 0.04, C.glass, 0.05), 0, 0.26, 0.31));
    const awning = at(rbox(0.72, 0.05, 0.22, C.coral, 0.03), 0, 0.42, 0.38);
    awning.rotation.x = -0.35;
    g.add(awning);
    return g;
  },
  cafe: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.6, 0.46, 0.6, C.peach, 0.1), 0, 0.23, 0));
    g.add(at(rbox(0.66, 0.08, 0.66, C.teal, 0.04), 0, 0.5, 0));
    g.add(at(rbox(0.42, 0.22, 0.04, C.glass, 0.05), 0, 0.26, 0.31));
    g.add(at(cyl(0.11, 0.13, 0.03, C.white, 10), 0.26, 0.58, 0.26));
    g.add(at(cyl(0.07, 0.05, 0.12, C.white, 10), 0.26, 0.65, 0.26));
    return g;
  },
  school: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.82, 0.62, 0.5, C.cream, 0.08), 0, 0.31, 0));
    windows(g, 2, 0.24, 0.28, 0.5);
    g.add(at(rbox(0.3, 0.8, 0.34, C.pink, 0.08), 0, 0.4, -0.16));
    g.add(at(gableRoof(C.coral, 0.34, 0.26), 0, 0.93, -0.16));
    g.add(at(cyl(0.1, 0.1, 0.02, C.white, 12), 0, 0.68, 0.18));
    return g;
  },
  hospital: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.7, 0.9, 0.62, C.white, 0.08), 0, 0.45, 0));
    windows(g, 3, 0.26, 0.28, 0.62);
    g.add(at(rbox(0.2, 0.06, 0.03, C.coral, 0.01), 0, 0.78, 0.32));
    g.add(at(rbox(0.06, 0.2, 0.03, C.coral, 0.01), 0, 0.78, 0.32));
    g.add(at(rbox(0.76, 0.06, 0.68, C.mint, 0.03), 0, 0.93, 0));
    return g;
  },
  factory: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.8, 0.44, 0.66, C.slate, 0.07), 0, 0.22, 0));
    for (const x of [-0.24, 0, 0.24]) {
      const saw = at(cyl(0.12, 0.12, 0.64, C.cream, 3), x, 0.5, 0);
      saw.rotation.set(Math.PI / 2, 0, 0);
      g.add(saw);
    }
    g.add(at(cyl(0.08, 0.1, 0.5, C.pink, 10), -0.3, 0.68, -0.22));
    g.add(at(ball(0.09, C.white), -0.3, 0.96, -0.22));
    return g;
  },

  // --- nature --------------------------------------------------------------
  tree: (p) => {
    const g = new THREE.Group();
    const count = 1 + (p.variant % 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + p.variant;
      const r = count === 1 ? 0 : 0.22;
      const s = count === 1 ? 1 : 0.72;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      g.add(at(cyl(0.05 * s, 0.07 * s, 0.24 * s, C.trunk, 8), x, 0.12 * s, z));
      g.add(at(ball(0.2 * s, i % 2 ? C.leafDeep : C.leaf), x, 0.38 * s, z));
      g.add(at(ball(0.13 * s, C.leafLime), x + 0.08 * s, 0.48 * s, z + 0.06 * s));
    }
    return g;
  },
  pine: (p) => {
    const g = new THREE.Group();
    const s = 0.9 + (p.variant % 3) * 0.1;
    g.add(at(cyl(0.05, 0.07, 0.2, C.trunk, 8), 0, 0.1, 0));
    for (let i = 0; i < 3; i++) {
      g.add(at(cyl(0, 0.26 - i * 0.06, 0.26, i % 2 ? C.leafDeep : C.leaf, 10), 0, (0.26 + i * 0.2) * s, 0));
    }
    return g;
  },
  bush: (p) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + p.variant;
      g.add(at(ball(0.13, i % 2 ? C.leaf : C.leafDeep), Math.cos(a) * 0.16, 0.1, Math.sin(a) * 0.16));
    }
    return g;
  },
  flower: (p) => {
    const g = new THREE.Group();
    g.add(at(rbox(0.7, 0.08, 0.7, C.trunk, 0.03), 0, 0.04, 0));
    const petals = [C.pink, C.mustard, C.lilac, C.white];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p.variant;
      const x = Math.cos(a) * 0.2;
      const z = Math.sin(a) * 0.2;
      g.add(at(cyl(0.012, 0.012, 0.12, C.leafDeep, 5), x, 0.14, z));
      g.add(at(ball(0.055, petals[(i + p.variant) % 4]), x, 0.22, z));
    }
    return g;
  },
  rock: (p) => {
    const g = new THREE.Group();
    const big = at(ball(0.2, C.stone), 0, 0.14, 0);
    big.scale.set(1, 0.75, 0.9);
    g.add(big);
    if (p.variant % 2) g.add(at(ball(0.11, C.stone), 0.22, 0.08, 0.14));
    return g;
  },

  // --- props ---------------------------------------------------------------
  car: (p) => {
    const g = new THREE.Group();
    const body = [C.coral, C.sky, C.mustard, C.mint][p.variant % 4];
    g.add(at(rbox(0.5, 0.16, 0.26, body, 0.07), 0, 0.14, 0));
    g.add(at(rbox(0.26, 0.14, 0.24, C.glass, 0.06), -0.02, 0.27, 0));
    for (const [x, z] of [[-0.16, 0.14], [0.16, 0.14], [-0.16, -0.14], [0.16, -0.14]]) {
      const w = at(cyl(0.06, 0.06, 0.05, C.dark, 10), x, 0.06, z);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
    return g;
  },
  bus: (p) => {
    const g = new THREE.Group();
    const body = [C.mustard, C.teal, C.coral, C.lilac][p.variant % 4];
    g.add(at(rbox(0.78, 0.32, 0.32, body, 0.09), 0, 0.24, 0));
    for (const x of [-0.22, 0, 0.22]) g.add(at(rbox(0.16, 0.14, 0.34, C.glass, 0.05), x, 0.3, 0));
    for (const [x, z] of [[-0.24, 0.17], [0.24, 0.17], [-0.24, -0.17], [0.24, -0.17]]) {
      const w = at(cyl(0.07, 0.07, 0.05, C.dark, 10), x, 0.07, z);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
    return g;
  },
  lamp: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.03, 0.04, 0.6, C.slate, 8), 0, 0.3, 0));
    g.add(at(rbox(0.22, 0.04, 0.05, C.slate, 0.02), 0.1, 0.6, 0));
    g.add(at(ball(0.07, C.mustard), 0.2, 0.56, 0));
    return g;
  },
  bench: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.46, 0.05, 0.16, C.trunk, 0.02), 0, 0.14, 0));
    g.add(at(rbox(0.46, 0.16, 0.04, C.trunk, 0.02), 0, 0.24, -0.07));
    for (const x of [-0.18, 0.18]) g.add(at(rbox(0.04, 0.14, 0.14, C.slate, 0.02), x, 0.07, 0));
    return g;
  },
  fountain: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.34, 0.36, 0.14, C.plaza, 16), 0, 0.07, 0));
    g.add(at(cyl(0.27, 0.27, 0.06, C.water, 16), 0, 0.13, 0));
    g.add(at(cyl(0.05, 0.07, 0.24, C.plaza, 10), 0, 0.24, 0));
    g.add(at(ball(0.1, C.water), 0, 0.4, 0));
    return g;
  },
  sign: (p) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.025, 0.03, 0.34, C.trunk, 8), 0, 0.17, 0));
    g.add(at(rbox(0.34, 0.2, 0.04, [C.mint, C.pink, C.sky, C.mustard][p.variant % 4], 0.05), 0, 0.42, 0));
    return g;
  },
};

export function buildPlacementMesh(placement: Placement, layer: 'ground' | 'object') {
  const builders = layer === 'ground' ? GROUND_BUILDERS : OBJECT_BUILDERS;
  const build = builders[placement.id];
  if (!build) return null;

  const group = build(placement);
  group.rotation.y = (placement.rotation * Math.PI) / 2;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = layer === 'object';
      o.receiveShadow = true;
    }
  });
  return group;
}
