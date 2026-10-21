// ASCII samosa: a ∇-shaped samosa, sphere-traced into a character grid. Pure and dependency-free:
// render(t, state) -> string works in the browser, in Node (build-time frame) and in tests.

const RAMP = " .:-=+*#%@";
const STEAM = ["∂", "∂", "~", "~", "·", "·", "."];

// Tetrahedron: A, B top corners, C bottom apex (front view reads as ∇), D back.
const V = { A: [-1.05, 0.55, 0.32], B: [1.05, 0.55, 0.32], C: [0, -1.0, 0.12], D: [0, 0.42, -0.85] };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

const centroid = [0, 1, 2].map((i) => (V.A[i] + V.B[i] + V.C[i] + V.D[i]) / 4);
const PLANES = [[V.A, V.B, V.C], [V.A, V.B, V.D], [V.B, V.C, V.D], [V.C, V.A, V.D]].map(([a, b, c]) => {
  let n = norm(cross(sub(b, a), sub(c, a)));
  if (dot(n, sub(a, centroid)) < 0) n = [-n[0], -n[1], -n[2]];   // outward
  return [n[0], n[1], n[2], dot(n, a)];
});
const AB = sub(V.B, V.A), AB2 = dot(AB, AB);

// Smooth max of the four face planes (log-sum-exp) gives puffy rounded edges; then fried bumps + crimped top seam.
function sdf(x, y, z) {
  const k = 9;
  let m = -Infinity; const d = [];
  for (const [nx, ny, nz, h] of PLANES) { const v = nx * x + ny * y + nz * z - h; d.push(v); if (v > m) m = v; }
  let s = 0; for (const v of d) s += Math.exp(k * (v - m));
  let dist = m + Math.log(s) / k - 0.04;
  dist += 0.012 * Math.sin(9 * x) * Math.sin(9 * y + 1.3) * Math.sin(9 * z + 2.1);          // fried surface
  const u = Math.max(0, Math.min(1, ((x - V.A[0]) * AB[0] + (y - V.A[1]) * AB[1] + (z - V.A[2]) * AB[2]) / AB2));
  const ex = x - (V.A[0] + u * AB[0]), ey = y - (V.A[1] + u * AB[1]), ez = z - (V.A[2] + u * AB[2]);
  const e = Math.hypot(ex, ey, ez);
  if (e < 0.25) dist -= 0.03 * Math.max(0, Math.sin(46 * u)) * (1 - e / 0.25);                // crimp
  return dist;
}

export function createSamosa({ w = 72, h = 34, aspect = 0.5, seed = 7 } = {}) {
  const st = { w, h, aspect, yaw: 0.35, pitch: -0.32, vyaw: 0, particles: [], rng: seed };
  const rand = () => ((st.rng = (st.rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  return { state: st, render: (t, opts) => render(st, rand, t, opts), resize(nw, nh) { st.w = nw; st.h = nh; } };
}

function render(st, rand, t, { light = [-0.45, 0.55, -0.75], steam = true } = {}) {
  const { w, h, aspect } = st;
  const cw = 2.7 / w, ch = cw / aspect;                    // world units per cell
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
  const L = norm(light);
  const toObj = (x, y, z) => {                             // world -> object (inverse of yaw·pitch)
    const y1 = cp * y + sp * z, z1 = -sp * y + cp * z;
    return [cy * x - sy * z1, y1, sy * x + cy * z1];
  };
  const toWorldN = (n) => {                                // object normal -> world
    const x1 = cy * n[0] + sy * n[2], z1 = -sy * n[0] + cy * n[2];
    return [x1, cp * n[1] - sp * z1, sp * n[1] + cp * z1];
  };
  const rows = [];
  for (let j = 0; j < h; j++) {
    const y = (h / 2 - j - 0.5) * ch;
    let row = "";
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5 - w / 2) * cw;
      if (x * x + y * y > 1.7 * 1.7) { row += " "; continue; }       // bounding circle
      let z = -2.2, hit = false;
      for (let k = 0; k < 40 && z < 2.2; k++) {
        const [px, py, pz] = toObj(x, y, z);
        const d = sdf(px, py, pz);
        if (d < 1e-3) { hit = true; break; }
        z += d * 0.9;
      }
      if (!hit) { row += " "; continue; }
      const [px, py, pz] = toObj(x, y, z), e = 2e-3;              // tetrahedral 4-tap normal
      const a = sdf(px + e, py - e, pz - e), b = sdf(px - e, py - e, pz + e), c = sdf(px - e, py + e, pz - e), d = sdf(px + e, py + e, pz + e);
      const n = toWorldN(norm([a - b - c + d, -a - b + c + d, -a + b - c + d]));
      const diff = Math.max(0, dot(n, L));
      const H = norm([L[0], L[1], L[2] - 1]);                      // view dir is -z
      const spec = Math.pow(Math.max(0, dot(n, H)), 24);
      const rim = Math.pow(1 - Math.abs(n[2]), 3);
      const lum = Math.min(0.999, 0.14 + 0.7 * diff + 0.5 * spec + 0.25 * rim);
      row += RAMP[Math.floor(lum * RAMP.length)];
    }
    rows.push(row);
  }
  if (steam) drawSteam(st, rand, t, rows, cw, ch);
  return rows.join("\n");
}

// Steam: particles rise from the top seam, drift, fade ∂ → ~ → · .
function drawSteam(st, rand, t, rows, cw, ch) {
  const { w, h } = st, ps = st.particles;
  const dt = st.lastT === undefined ? 0.033 : Math.min(0.1, t - st.lastT); st.lastT = t;
  while (ps.length < 26) ps.push({ x: (rand() - 0.5) * 1.4, y: 0.75 + rand() * 0.2, age: rand(), life: 1.6 + rand() });
  for (const p of ps) {
    p.age += dt / p.life; p.y += dt * 0.55; p.x += dt * 0.25 * Math.sin(3 * p.y + t + p.life * 7);
    if (p.age >= 1) { p.x = (rand() - 0.5) * 1.4; p.y = 0.75; p.age = 0; }
    const i = Math.round(p.x / cw + w / 2 - 0.5), j = Math.round(h / 2 - 0.5 - p.y / ch);
    if (i < 0 || i >= w || j < 0 || j >= h || rows[j][i] !== " ") continue;
    const r = rows[j]; rows[j] = r.slice(0, i) + STEAM[Math.floor(p.age * STEAM.length)] + r.slice(i + 1);
  }
}

// Node: print one frame (used for the build-time no-JS frame).
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const s = createSamosa();
  console.log(s.render(0, { steam: false }));
}
