/**
 * The ASCII samosa (F20).
 *
 * A samosa shaped like the nabla symbol, sphere traced into a character
 * grid. The module is pure and dependency free, so it runs in the browser, in
 * Node (for the frame that is inlined at build time) and in the tests.
 *
 * The values match the approved prototype in `prototypes/ascii-samosa`.
 */

const RAMP = ' .:-=+*#%@';
const STEAM = ['∂', '∂', '~', '~', '·', '·', '.'];

// The tetrahedron: A and B are the top corners, C the bottom apex (the front
// view reads as a nabla), D the back.
const V = {
  A: [-1.05, 0.55, 0.32],
  B: [1.05, 0.55, 0.32],
  C: [0, -1.0, 0.12],
  D: [0, 0.42, -0.85],
};

type Vec = [number, number, number];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const centroid: Vec = [0, 1, 2].map((i) => (V.A[i] + V.B[i] + V.C[i] + V.D[i]) / 4) as Vec;

const PLANES: Array<[number, number, number, number]> = [
  [V.A, V.B, V.C],
  [V.A, V.B, V.D],
  [V.B, V.C, V.D],
  [V.C, V.A, V.D],
].map(([a, b, c]) => {
  let n = norm(cross(sub(b, a), sub(c, a)));
  if (dot(n, sub(a, centroid)) < 0) n = [-n[0], -n[1], -n[2]];
  return [n[0], n[1], n[2], dot(n, a)];
});

const AB = sub(V.B, V.A);
const AB2 = dot(AB, AB);

/**
 * The signed distance function.
 *
 * A smooth max of the four face planes gives puffy rounded edges, then the
 * fried bumps and the crimped top seam.
 */
function sdf(x: number, y: number, z: number): number {
  const k = 9;
  let m = -Infinity;
  const d: number[] = [];
  for (const [nx, ny, nz, h] of PLANES) {
    const v = nx * x + ny * y + nz * z - h;
    d.push(v);
    if (v > m) m = v;
  }
  let s = 0;
  for (const v of d) s += Math.exp(k * (v - m));
  let dist = m + Math.log(s) / k - 0.04;
  dist += 0.012 * Math.sin(9 * x) * Math.sin(9 * y + 1.3) * Math.sin(9 * z + 2.1);
  const u = Math.max(0, Math.min(1, ((x - V.A[0]) * AB[0] + (y - V.A[1]) * AB[1] + (z - V.A[2]) * AB[2]) / AB2));
  const ex = x - (V.A[0] + u * AB[0]);
  const ey = y - (V.A[1] + u * AB[1]);
  const ez = z - (V.A[2] + u * AB[2]);
  const e = Math.hypot(ex, ey, ez);
  if (e < 0.25) dist -= 0.03 * Math.max(0, Math.sin(46 * u)) * (1 - e / 0.25);
  return dist;
}

export interface SamosaOptions {
  w?: number;
  h?: number;
  aspect?: number;
  seed?: number;
}

export interface SamosaState {
  w: number;
  h: number;
  aspect: number;
  yaw: number;
  pitch: number;
  vyaw: number;
  particles: Array<{ x: number; y: number; age: number; life: number }>;
  rng: number;
  lastT?: number;
}

export interface Samosa {
  state: SamosaState;
  render: (t: number, opts?: { light?: Vec; steam?: boolean }) => string;
  resize: (w: number, h: number) => void;
}

export function createSamosa(options: SamosaOptions = {}): Samosa {
  const { w = 72, h = 34, aspect = 0.5, seed = 7 } = options;
  const state: SamosaState = {
    w,
    h,
    aspect,
    yaw: 0.35,
    pitch: -0.32,
    vyaw: 0,
    particles: [],
    rng: seed,
  };
  const rand = () => ((state.rng = (state.rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  return {
    state,
    render: (t, opts) => render(state, rand, t, opts),
    resize(nw, nh) {
      state.w = nw;
      state.h = nh;
    },
  };
}

function render(
  st: SamosaState,
  rand: () => number,
  t: number,
  { light = [-0.45, 0.55, -0.75], steam = true }: { light?: Vec; steam?: boolean } = {},
): string {
  const { w, h, aspect } = st;
  const cw = 2.7 / w;
  const ch = cw / aspect;
  const cy = Math.cos(st.yaw);
  const sy = Math.sin(st.yaw);
  const cp = Math.cos(st.pitch);
  const sp = Math.sin(st.pitch);
  const L = norm(light);
  const toObj = (x: number, y: number, z: number): Vec => {
    const y1 = cp * y + sp * z;
    const z1 = -sp * y + cp * z;
    return [cy * x - sy * z1, y1, sy * x + cy * z1];
  };
  const toWorldN = (n: Vec): Vec => {
    const x1 = cy * n[0] + sy * n[2];
    const z1 = -sy * n[0] + cy * n[2];
    return [x1, cp * n[1] - sp * z1, sp * n[1] + cp * z1];
  };

  const rows: string[] = [];
  for (let j = 0; j < h; j++) {
    const y = (h / 2 - j - 0.5) * ch;
    let row = '';
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5 - w / 2) * cw;
      if (x * x + y * y > 1.7 * 1.7) {
        row += ' ';
        continue;
      }
      let z = -2.2;
      let hit = false;
      for (let k = 0; k < 40 && z < 2.2; k++) {
        const [px, py, pz] = toObj(x, y, z);
        const d = sdf(px, py, pz);
        if (d < 1e-3) {
          hit = true;
          break;
        }
        z += d * 0.9;
      }
      if (!hit) {
        row += ' ';
        continue;
      }
      const [px, py, pz] = toObj(x, y, z);
      const e = 2e-3;
      const a = sdf(px + e, py - e, pz - e);
      const b = sdf(px - e, py - e, pz + e);
      const c = sdf(px - e, py + e, pz - e);
      const d = sdf(px + e, py + e, pz + e);
      const n = toWorldN(norm([a - b - c + d, -a - b + c + d, -a + b - c + d]));
      const diff = Math.max(0, dot(n, L));
      const H = norm([L[0], L[1], L[2] - 1]);
      const spec = Math.pow(Math.max(0, dot(n, H)), 24);
      const rim = Math.pow(1 - Math.abs(n[2]), 3);
      const lum = Math.min(0.999, 0.14 + 0.7 * diff + 0.5 * spec + 0.25 * rim);
      row += RAMP[Math.floor(lum * RAMP.length)];
    }
    rows.push(row);
  }
  if (steam) drawSteam(st, rand, t, rows, cw, ch);
  return rows.join('\n');
}

/** The steam: particles rise from the top seam and fade from ∂ to a dot. */
function drawSteam(st: SamosaState, rand: () => number, t: number, rows: string[], cw: number, ch: number): void {
  const { w, h } = st;
  const ps = st.particles;
  const dt = st.lastT === undefined ? 0.033 : Math.min(0.1, t - st.lastT);
  st.lastT = t;
  while (ps.length < 26) ps.push({ x: (rand() - 0.5) * 1.4, y: 0.75 + rand() * 0.2, age: rand(), life: 1.6 + rand() });
  for (const p of ps) {
    p.age += dt / p.life;
    p.y += dt * 0.55;
    p.x += dt * 0.25 * Math.sin(3 * p.y + t + p.life * 7);
    if (p.age >= 1) {
      p.x = (rand() - 0.5) * 1.4;
      p.y = 0.75;
      p.age = 0;
    }
    const i = Math.round(p.x / cw + w / 2 - 0.5);
    const j = Math.round(h / 2 - 0.5 - p.y / ch);
    if (i < 0 || i >= w || j < 0 || j >= h || rows[j][i] !== ' ') continue;
    const r = rows[j];
    rows[j] = r.slice(0, i) + STEAM[Math.floor(p.age * STEAM.length)] + r.slice(i + 1);
  }
}
