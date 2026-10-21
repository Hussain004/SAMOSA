// Spike: check every algebraic line of Mobile Robotics Lecture 8 (Kalman measurement update, Thrun notation)
// exactly over GF(p), including the gradient/Hessian claims via dual numbers (forward-mode AD).
// Run: node lecture8_probe.mjs
const P = 2147483647;
const mod = (a) => ((a % P) + P) % P;
const mul = (a, b) => mod(mod(a * (b >>> 16)) * 65536 + a * (b & 65535)); // exact in float64
const inv = (a) => { let r = 1, e = P - 2; a = mod(a); while (e) { if (e & 1) r = mul(r, a); a = mul(a, a); e = Math.floor(e / 2); } return r; };
const rnd = () => Math.floor(Math.random() * P);

const M = (r, c, f) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => f(i, j)));
const rand = (r, c) => M(r, c, rnd);
const sym = (n) => { const A = rand(n, n); return M(n, n, (i, j) => (i <= j ? A[i][j] : A[j][i])); };
const I = (n) => M(n, n, (i, j) => +(i === j));
const Z = (r, c) => M(r, c, () => 0);
const T = (A) => M(A[0].length, A.length, (i, j) => A[j][i]);
const add = (A, B) => M(A.length, A[0].length, (i, j) => mod(A[i][j] + B[i][j]));
const neg = (A) => M(A.length, A[0].length, (i, j) => mod(-A[i][j]));
const sub = (A, B) => add(A, neg(B));
const scale = (s, A) => M(A.length, A[0].length, (i, j) => mul(s, A[i][j]));
const mm = (A, B) => { if (A[0].length !== B.length) throw new Error("shape"); return M(A.length, B[0].length, (i, j) => { let s = 0; for (let k = 0; k < B.length; k++) s = mod(s + mul(A[i][k], B[k][j])); return s; }); };
const minv = (A) => {
  const n = A.length, X = A.map((r, i) => [...r, ...I(n)[i]]);
  for (let c = 0; c < n; c++) {
    const p = X.findIndex((r, i) => i >= c && r[c] !== 0); if (p < 0) throw new Error("singular -> resample");
    [X[c], X[p]] = [X[p], X[c]]; const s = inv(X[c][c]); X[c] = X[c].map((v) => mul(v, s));
    for (let r = 0; r < n; r++) if (r !== c && X[r][c]) { const f = X[r][c]; X[r] = X[r].map((v, j) => mod(v - mul(f, X[c][j]))); }
  }
  return X.map((r) => r.slice(n));
};
const eq = (A, B) => A.every((r, i) => r.every((v, j) => v === B[i][j]));

// Dual matrices {v, t}: value + tangent. Constants have zero tangent.
const D = (v, t = Z(v.length, v[0].length)) => ({ v, t });
const dadd = (A, B) => D(add(A.v, B.v), add(A.t, B.t));
const dsub = (A, B) => D(sub(A.v, B.v), sub(A.t, B.t));
const dmm = (A, B) => D(mm(A.v, B.v), add(mm(A.t, B.v), mm(A.v, B.t)));
const dT = (A) => D(T(A.v), T(A.t));
const dscale = (s, A) => D(scale(s, A.v), scale(s, A.t));
const HALF = inv(2);

function run(symmetricQ) {
  const n = 3, m = 2; // state dim n, measurement dim m (distinct on purpose)
  const Sb = sym(n), Q = symmetricQ ? sym(m) : rand(m, m), C = rand(m, n);
  const z = rand(m, 1), mub = rand(n, 1), x = rand(n, 1), v = rand(n, 1), w = rand(n, 1);
  const Qi = minv(Q), Sbi = minv(Sb);

  // J_t = 1/2 (z - Cx)^T Q^-1 (z - Cx) + 1/2 (x - mub)^T Sb^-1 (x - mub), evaluated on dual x = x + eps v
  const J = (xd) => { const u = dsub(D(z), dmm(D(C), xd)), r = dsub(xd, D(mub));
    return dadd(dscale(HALF, dmm(dmm(dT(u), D(Qi)), u)), dscale(HALF, dmm(dmm(dT(r), D(Sbi)), r))); };
  const grad = (xv) => add(neg(mm(mm(T(C), Qi), sub(z, mm(C, xv)))), mm(Sbi, sub(xv, mub))); // claimed dJ/dx
  const gradD = (xd) => dadd(dmm(D(neg(mm(T(C), Qi))), dsub(D(z), dmm(D(C), xd))), dmm(D(Sbi), dsub(xd, D(mub))));
  const H = add(mm(mm(T(C), Qi), C), Sbi); // claimed d2J/dx2

  const St = minv(H);                                   // Sigma_t := (C^T Q^-1 C + Sb^-1)^-1
  const K = mm(mm(St, T(C)), Qi);                       // K_t := Sigma_t C^T Q^-1
  const K2 = mm(mm(Sb, T(C)), minv(add(mm(mm(C, Sb), T(C)), Q)));  // "after some algebraic manipulation"
  const mu = add(mub, mm(K, sub(z, mm(C, mub))));       // "setting dJ/dx = 0 and solving for x_t"
  const IKC = sub(I(n), mm(K2, C));

  return [
    ["dJ/dx = -C^T Q^-1 (z - Cx) + Sb^-1 (x - mub)   [dual numbers, direction v]", eq(J(D(x, v)).t, mm(T(grad(x)), v))],
    ["d2J/dx2 = C^T Q^-1 C + Sb^-1                   [dual of the gradient, dir w]", eq(gradD(D(x, w)).t, mm(H, w))],
    ["stationarity: dJ/dx at x = mu_t is 0", eq(grad(mu), Z(n, 1))],
    ["K = (C^T Q^-1 C + Sb^-1)^-1 C^T Q^-1 = Sb C^T (C Sb C^T + Q)^-1", eq(K, K2)],
    ["Sigma_t = (I - K C) Sb", eq(St, mm(IKC, Sb))],
    ["Joseph: Sigma_t = (I-KC) Sb (I-KC)^T + K Q K^T", eq(St, add(mm(mm(IKC, Sb), T(IKC)), mm(mm(K2, Q), T(K2))))],
    ["PLANTED: Joseph without + K Q K^T", eq(St, mm(mm(IKC, Sb), T(IKC)))],
    ["PLANTED: K = Sb C^T (C Sb C^T + Q^-1)^-1", eq(K, mm(mm(Sb, T(C)), minv(add(mm(mm(C, Sb), T(C)), Qi))))],
  ];
}

console.log("Q symmetric (as declared in the lecture):");
for (const [k, ok] of run(true)) console.log(`  ${ok ? "EQUAL    " : "NOT EQUAL"}  ${k}`);
console.log("Q NOT declared symmetric (missing-assumption demo):");
for (const [k, ok] of run(false).slice(0, 3)) console.log(`  ${ok ? "EQUAL    " : "NOT EQUAL"}  ${k}`);
