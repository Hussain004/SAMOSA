// Spike: exact identity testing over GF(p), p = 2^31-1, float64-only modmul via 16-bit split.
const P = 2147483647;
const mod = (a) => ((a % P) + P) % P;
const mul = (a, b) => mod(mod(a * (b >>> 16)) * 65536 + a * (b & 65535));
const inv = (a) => { let r = 1, e = P - 2; a = mod(a); while (e) { if (e & 1) r = mul(r, a); a = mul(a, a); e = Math.floor(e / 2); } return r; };
const rnd = () => Math.floor(Math.random() * P);

const M = (r, c, f) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => f(i, j)));
const rand = (r, c) => M(r, c, rnd);
const sym = (n) => { const A = rand(n, n); return M(n, n, (i, j) => (i <= j ? A[i][j] : A[j][i])); };
const I = (n) => M(n, n, (i, j) => +(i === j));
const T = (A) => M(A[0].length, A.length, (i, j) => A[j][i]);
const add = (A, B) => M(A.length, A[0].length, (i, j) => mod(A[i][j] + B[i][j]));
const neg = (A) => M(A.length, A[0].length, (i, j) => mod(-A[i][j]));
const sub = (A, B) => add(A, neg(B));
const mm = (A, B) => M(A.length, B[0].length, (i, j) => { let s = 0; for (let k = 0; k < B.length; k++) s = mod(s + mul(A[i][k], B[k][j])); return s; });
const minv = (A) => { // Gauss-Jordan mod p
  const n = A.length, X = A.map((r, i) => [...r, ...I(n)[i]]);
  for (let c = 0; c < n; c++) {
    const p = X.findIndex((r, i) => i >= c && r[c] !== 0); if (p < 0) throw new Error("singular -> resample");
    [X[c], X[p]] = [X[p], X[c]]; const s = inv(X[c][c]); X[c] = X[c].map((v) => mul(v, s));
    for (let r = 0; r < n; r++) if (r !== c && X[r][c]) { const f = X[r][c]; X[r] = X[r].map((v, j) => mod(v - mul(f, X[c][j]))); }
  }
  return X.map((r) => r.slice(n));
};
const eq = (A, B) => A.every((r, i) => r.every((v, j) => v === B[i][j]));

// exactness check of mul against BigInt
for (let t = 0; t < 1e5; t++) { const a = rnd(), b = rnd(); if (BigInt(mul(a, b)) !== (BigInt(a) * BigInt(b)) % BigInt(P)) throw new Error("modmul wrong"); }

const n = 3, m = 2, checks = [];
const A = rand(n, n), B = rand(n, n);
checks.push(["(AB)^T = B^T A^T  (true)", eq(T(mm(A, B)), mm(T(B), T(A)))]);
checks.push(["(AB)^T = A^T B^T  (false)", eq(T(mm(A, B)), mm(T(A), T(B)))]);
// Kalman: P+ = (I-KH)P-  vs Joseph form with and without KRK^T, K optimal
const Pm = sym(n), H = rand(m, n), R = sym(m);
const S = add(mm(mm(H, Pm), T(H)), R), K = mm(mm(Pm, T(H)), minv(S));
const IKH = sub(I(n), mm(K, H)), Pplus = mm(IKH, Pm);
const joseph = add(mm(mm(IKH, Pm), T(IKH)), mm(mm(K, R), T(K)));
checks.push(["Joseph form = (I-KH)P  (true, K optimal)", eq(Pplus, joseph)]);
checks.push(["Joseph form w/o KRK^T  (false)", eq(Pplus, mm(mm(IKH, Pm), T(IKH)))]);
// Woodbury: (A + U C V)^-1 = A^-1 - A^-1 U (C^-1 + V A^-1 U)^-1 V A^-1
const U = rand(n, m), C = rand(m, m), V = rand(m, n), Ai = minv(A);
const lhs = minv(add(A, mm(mm(U, C), V)));
const rhs = sub(Ai, mm(mm(mm(Ai, U), minv(add(minv(C), mm(mm(V, Ai), U)))), mm(V, Ai)));
checks.push(["Woodbury identity  (true)", eq(lhs, rhs)]);
console.log(checks.map(([k, v]) => `${v ? "EQUAL    " : "NOT EQUAL"}  ${k}`).join("\n"));
