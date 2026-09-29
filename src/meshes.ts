import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Placement } from './city';

export const GROUND_H = 0.12;

const C = {
  grass: 0xa9dd8b,
  grassDeep: 0x93d173,
  pitch: 0x86cf76,
  water: 0x8ad4f2,
  waterDeep: 0x6ec2e8,
  road: 0xcfc6b8,
  roadLine: 0xfff7e8,
  path: 0xf3e7d3,
  concrete: 0xe3ddd2,
  asphalt: 0xc4bdb5,
  clay: 0xf0a878,
  line: 0xfffdf6,
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
  flagRed: 0xef5b5b,
  flagBlue: 0x4a58a0,
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

// a campus fills ~900 cells; without sharing, each would upload its own geometry
const geometries = new Map<string, THREE.BufferGeometry>();
const geo = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g as T;
};

const rbox = (w: number, h: number, d: number, color: number, r = 0.05) => {
  const radius = Math.min(r, Math.min(w, h, d) / 2.05);
  return new THREE.Mesh(
    geo(`rb:${w},${h},${d},${radius}`, () => new RoundedBoxGeometry(w, h, d, 3, radius)),
    m(color),
  );
};

const ball = (r: number, color: number) =>
  new THREE.Mesh(geo(`sp:${r}`, () => new THREE.SphereGeometry(r, 12, 10)), m(color));

const cyl = (rTop: number, rBottom: number, h: number, color: number, seg = 12) =>
  new THREE.Mesh(
    geo(`cy:${rTop},${rBottom},${h},${seg}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg)),
    m(color),
  );

const torus = (r: number, tube: number, seg: number, color: number) =>
  new THREE.Mesh(geo(`to:${r},${tube},${seg}`, () => new THREE.TorusGeometry(r, tube, 6, seg)), m(color));

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};

const flat = (o: THREE.Object3D) => {
  o.rotation.x = -Math.PI / 2;
  return o;
};

// --- ground tiles ----------------------------------------------------------
// a slab slightly smaller than the cell leaves a hairline gap, which reads as
// soft stitched patchwork rather than one flat plane
function slab(color: number, height = GROUND_H) {
  const g = new THREE.Group();
  g.add(at(rbox(0.98, height, 0.98, color, 0.05), 0, height / 2, 0));
  return g;
}

const stripe = (w: number, d: number, x: number, z: number, color = C.line) =>
  at(rbox(w, 0.02, d, color, 0.008), x, GROUND_H, z);

/** ground patterns take the cell coordinates so markings line up tile to tile */
type GroundBuilder = (p: Placement, x: number, y: number) => THREE.Group;

const GROUND_BUILDERS: Record<string, GroundBuilder> = {
  grass: (p) => {
    const g = slab(p.variant % 2 ? C.grassDeep : C.grass);
    if (p.variant === 0) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.add(at(cyl(0.01, 0.018, 0.08, C.leafDeep, 5), Math.cos(a) * 0.26, GROUND_H + 0.04, Math.sin(a) * 0.26));
      }
    }
    return g;
  },
  concrete: () => slab(C.concrete),
  road: () => {
    const g = slab(C.road);
    g.add(stripe(0.26, 0.08, 0, 0, C.roadLine));
    return g;
  },
  path: () => {
    const g = slab(C.path);
    for (const x of [-0.24, 0.24]) g.add(stripe(0.3, 0.3, x, 0, C.concrete));
    return g;
  },
  parking: (_p, x) => {
    const g = slab(C.asphalt);
    // one stall line per cell edge, so neighbours read as a continuous row of bays
    g.add(stripe(0.03, 0.9, -0.49, 0));
    if (x % 2 === 0) g.add(stripe(0.03, 0.9, 0, 0));
    g.add(stripe(0.98, 0.03, 0, -0.49));
    return g;
  },
  field: (_p, x) => {
    // mown stripes run the length of the pitch instead of per-tile decoration
    const g = slab(x % 2 ? C.pitch : C.grassDeep);
    g.add(stripe(0.03, 0.98, -0.49, 0));
    return g;
  },
  court: () => {
    const g = slab(C.clay);
    g.add(stripe(0.03, 0.98, -0.49, 0));
    g.add(stripe(0.98, 0.03, 0, -0.49));
    return g;
  },
  water: () => {
    const g = slab(C.water, GROUND_H * 0.7);
    g.add(at(flat(torus(0.16, 0.018, 16, C.waterDeep)), 0, GROUND_H * 0.7 + 0.01, 0.06));
    return g;
  },
};

const gableRoof = (color: number, width: number, height: number) => {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.78, height, 4), m(color));
  roof.rotation.y = Math.PI / 4;
  return roof;
};

function pillars(g: THREE.Group, w: number, d: number, h: number, color: number) {
  for (const x of [-w, w]) {
    for (const z of [-d, d]) g.add(at(cyl(0.035, 0.04, h, color, 8), x, h / 2, z));
  }
}

// --- objects ---------------------------------------------------------------
const OBJECT_BUILDERS: Record<string, GroundBuilder> = {
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
  palm: (p) => {
    const g = new THREE.Group();
    const h = 0.5 + (p.variant % 3) * 0.08;
    g.add(at(cyl(0.04, 0.06, h, C.trunk, 8), 0, h / 2, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = at(cyl(0.01, 0.06, 0.3, i % 2 ? C.leafDeep : C.leaf, 6), Math.cos(a) * 0.14, h + 0.06, Math.sin(a) * 0.14);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(frond);
    }
    g.add(at(ball(0.05, C.leafLime), 0, h + 0.08, 0));
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
  flagpole: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.3, 0.34, 0.06, C.concrete, 16), 0, 0.03, 0));
    g.add(at(cyl(0.22, 0.26, 0.06, C.white, 16), 0, 0.09, 0));
    g.add(at(cyl(0.022, 0.028, 0.9, C.white, 8), 0, 0.57, 0));
    for (const [i, color] of [C.flagRed, C.white, C.flagBlue].entries()) {
      g.add(at(rbox(0.26, 0.055, 0.015, color, 0.006), 0.15, 0.93 - i * 0.055, 0));
    }
    g.add(at(ball(0.03, C.mustard), 0, 1.03, 0));
    return g;
  },
  statue: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.5, 0.1, 0.5, C.white, 0.03), 0, 0.05, 0));
    g.add(at(rbox(0.34, 0.12, 0.34, C.concrete, 0.03), 0, 0.16, 0));
    const body = at(cyl(0.06, 0.15, 0.24, C.mustard, 12), 0, 0.34, 0);
    g.add(body);
    g.add(at(ball(0.075, C.mustard), 0, 0.5, 0));
    g.add(at(ball(0.02, C.mustard), 0, 0.58, 0));
    return g;
  },
  sala: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.66, 0.08, 0.66, C.concrete, 0.03), 0, 0.04, 0));
    pillars(g, 0.25, 0.25, 0.34, C.coral);
    g.add(at(gableRoof(C.coral, 0.74, 0.22), 0, 0.46, 0));
    g.add(at(gableRoof(C.mustard, 0.5, 0.18), 0, 0.62, 0));
    for (const z of [-0.2, 0.2]) g.add(at(rbox(0.5, 0.04, 0.12, C.trunk, 0.02), 0, 0.14, z));
    return g;
  },
  gate: () => {
    const g = new THREE.Group();
    for (const x of [-0.34, 0.34]) g.add(at(rbox(0.16, 0.6, 0.16, C.cream, 0.04), x, 0.3, 0));
    g.add(at(rbox(0.84, 0.1, 0.12, C.coral, 0.04), 0, 0.64, 0));
    g.add(at(rbox(0.5, 0.14, 0.04, C.white, 0.03), 0, 0.64, 0.08));
    for (const x of [-0.16, 0.16]) g.add(at(rbox(0.28, 0.4, 0.04, C.slate, 0.02), x, 0.2, 0));
    return g;
  },
  fence: () => {
    const g = new THREE.Group();
    for (const y of [0.16, 0.3]) g.add(at(rbox(0.98, 0.04, 0.04, C.white, 0.015), 0, y, 0));
    for (let i = -2; i <= 2; i++) g.add(at(rbox(0.04, 0.38, 0.04, C.white, 0.015), i * 0.22, 0.19, 0));
    return g;
  },
  sign: (p) => {
    const g = new THREE.Group();
    for (const x of [-0.22, 0.22]) g.add(at(rbox(0.07, 0.3, 0.07, C.stone, 0.02), x, 0.15, 0));
    g.add(at(rbox(0.62, 0.26, 0.06, [C.mint, C.pink, C.sky, C.mustard][p.variant % 4], 0.04), 0, 0.36, 0));
    g.add(at(rbox(0.5, 0.05, 0.02, C.white, 0.01), 0, 0.36, 0.035));
    return g;
  },
  bench: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.46, 0.05, 0.16, C.trunk, 0.02), 0, 0.14, 0));
    g.add(at(rbox(0.46, 0.16, 0.04, C.trunk, 0.02), 0, 0.24, -0.07));
    for (const x of [-0.18, 0.18]) g.add(at(rbox(0.04, 0.14, 0.14, C.slate, 0.02), x, 0.07, 0));
    return g;
  },
  lamp: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.03, 0.04, 0.6, C.slate, 8), 0, 0.3, 0));
    g.add(at(rbox(0.22, 0.04, 0.05, C.slate, 0.02), 0.1, 0.6, 0));
    g.add(at(ball(0.07, C.mustard), 0.2, 0.56, 0));
    return g;
  },
  bin: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.11, 0.09, 0.22, C.teal, 10), 0, 0.11, 0));
    g.add(at(cyl(0.12, 0.12, 0.04, C.mint, 10), 0, 0.24, 0));
    return g;
  },
  schoolbus: () => {
    const g = new THREE.Group();
    g.add(at(rbox(0.78, 0.32, 0.32, C.mustard, 0.09), 0, 0.24, 0));
    for (const x of [-0.22, 0, 0.22]) g.add(at(rbox(0.16, 0.14, 0.34, C.glass, 0.05), x, 0.3, 0));
    g.add(at(rbox(0.8, 0.05, 0.05, C.flagRed, 0.02), 0, 0.16, 0));
    for (const [x, z] of [[-0.24, 0.17], [0.24, 0.17], [-0.24, -0.17], [0.24, -0.17]]) {
      const w = at(cyl(0.07, 0.07, 0.05, C.dark, 10), x, 0.07, z);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
    return g;
  },
  car: (p) => {
    const g = new THREE.Group();
    const body = [C.coral, C.sky, C.white, C.mint][p.variant % 4];
    g.add(at(rbox(0.5, 0.16, 0.26, body, 0.07), 0, 0.14, 0));
    g.add(at(rbox(0.26, 0.14, 0.24, C.glass, 0.06), -0.02, 0.27, 0));
    for (const [x, z] of [[-0.16, 0.14], [0.16, 0.14], [-0.16, -0.14], [0.16, -0.14]]) {
      const w = at(cyl(0.06, 0.06, 0.05, C.dark, 10), x, 0.06, z);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
    return g;
  },
};

export function buildPlacementMesh(placement: Placement, layer: 'ground' | 'object', x: number, y: number) {
  const build = layer === 'ground' ? GROUND_BUILDERS[placement.id] : OBJECT_BUILDERS[placement.id];
  if (!build) return null;

  const group = build(placement, x, y);
  group.rotation.y = (placement.rotation * Math.PI) / 2;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = layer === 'object';
      o.receiveShadow = true;
    }
  });
  return group;
}
