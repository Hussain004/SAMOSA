# Exact check (fractions) of SAMOSA's rational quadrature rules and of the worked guarantee bound in §3.3.
# Run: python3 quadrature_check.py
from fractions import Fraction as F

def moments(rule, kmax):
    return [sum(w * a**k for a, w in rule) for k in range(kmax + 1)]

gauss = [1, 0, 1, 0, 3, 0, 15, 0, 105]  # E z^k for z ~ N(0,1)
r5 = [(0, F(1, 2)), (1, F(1, 6)), (-1, F(1, 6)), (2, F(1, 12)), (-2, F(1, 12))]
r7 = [(0, F(7, 18)), (1, F(1, 4)), (-1, F(1, 4)), (2, F(1, 20)), (-2, F(1, 20)), (3, F(1, 180)), (-3, F(1, 180))]
simpson = [(F(0), F(1, 6)), (F(1, 2), F(2, 3)), (F(1), F(1, 6))]
boole = [(F(i, 4), F(w, 90)) for i, w in zip(range(5), [7, 32, 12, 32, 7])]

assert moments(r5, 5) == gauss[:6] and moments(r5, 6)[6] != 15          # exact through degree 5
assert moments(r7, 7) == gauss[:8] and moments(r7, 8)[8] != 105         # exact through degree 7
assert moments(simpson, 3) == [F(1, k + 1) for k in range(4)]           # U(0,1), exact through 3
assert moments(boole, 5) == [F(1, k + 1) for k in range(6)]             # U(0,1), exact through 5

print("rules ok")

# Degree-bound rules of §3.3 applied to Lecture 8 row 11:
#   (C^T Q^-1 C + Sb^-1)^-1 C^T Q^-1  =  Sb C^T (C Sb C^T + Q)^-1      (each node: (dN, dD))
def inv(a, n): dN, dD = a; return (dD + (n - 1) * dN, n * dN)
def mul(a, b): return (a[0] + b[0], a[1] + b[1])
def add(a, b): return (max(a[0] + b[1], b[0] + a[1]), a[1] + b[1])
def row11_degree(n, m):
    leaf = (1, 0)
    Qi = inv(leaf, m)
    lhs = mul(mul(inv(add(mul(mul(leaf, Qi), leaf), inv(leaf, n)), n), leaf), Qi)
    rhs = mul(mul(leaf, leaf), inv(add(mul(mul(leaf, leaf), leaf), leaf), m))
    return max(lhs[0] + rhs[1], rhs[0] + lhs[1])

p1, p2, k = 2147483647, 2147483629, 3
worst = 0
for n, m in [(3, 2), (2, 3), (4, 3)]:            # default size settings, 3 trials x 2 primes at EACH
    d = row11_degree(n, m)
    b = (F(d, p1) ** k) * (F(d, p2) ** k)
    worst = max(worst, b)
    print(f"  sizes (n,m)=({n},{m}): d = {d:3d}, false-pass bound at this setting <= {float(b):.2e}")
assert row11_degree(3, 2) == 25 and float(worst) < 1e-46
print("worst setting bound:", f"{float(worst):.2e}")
