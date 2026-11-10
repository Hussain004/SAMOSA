/**
 * The false friends: the mistakes people actually write.
 *
 * None of these may ever come back ok. This is the single source of the
 * list: the structures test holds the engine to it, and the ledger the
 * landing page shows is generated from it (scripts/gen-ledger.ts).
 * Where the surface syntax of an operator is still missing the step is
 * unchecked, which is honest, never a checkmark.
 */
export interface FalseFriend {
  name: string;
  src: string;
  decls?: string;
  /** true when the step is caught with a wrong or a shape error today */
  caught?: boolean;
  /** the handle to credit, when a trap was contributed by someone */
  handle?: string;
}

export const FALSE_FRIENDS: Array<FalseFriend> = [
  { name: 'the determinant of an orthogonal matrix is not one', src: String.raw`\det(Q) = 1`, decls: 'Q: orth n×n', caught: true },
  { name: 'two orthogonal matrices do not commute', src: String.raw`Q_1 Q_2 = Q_2 Q_1`, decls: 'Q_1, Q_2: orth n×n', caught: true },
  { name: 'the absolute value is not the identity', src: String.raw`|x| = x`, decls: 'x: scalar', caught: true },
  { name: 'the absolute value does not split a sum', src: String.raw`|a + b| = |a| + |b|`, decls: 'a: scalar; b: scalar', caught: true },
  { name: 'the square root of a square is not the number', src: String.raw`\sqrt{x^2} = x`, decls: 'x: scalar', caught: true },
  { name: 'the square root of a square is not the negative, for a positive one', src: String.raw`\sqrt{x^2} = -x`, decls: 'x: pos', caught: true },
  { name: 'the inverse of a sum is not the sum of the inverses', src: String.raw`(A + B)^{-1} = A^{-1} + B^{-1}`, decls: 'A, B: n×n', caught: true },
  { name: 'the trace of a product is not the product of the traces', src: String.raw`\operatorname{tr}(A B) = \operatorname{tr}(A)\operatorname{tr}(B)`, decls: 'A, B: n×n', caught: true },
  { name: 'the determinant of a sum is not the sum of the determinants', src: String.raw`\det(A + B) = \det(A) + \det(B)`, decls: 'A, B: n×n', caught: true },
  { name: 'the exponential does not split a sum of matrices', src: String.raw`e^{A + B} = e^A e^B`, decls: 'A, B: n×n', caught: true },
  { name: 'the inverse of a product is not the product of the inverses', src: String.raw`(A B)^{-1} = A^{-1} B^{-1}`, decls: 'A, B: n×n', caught: true },
  { name: 'the transpose of a product is not the product of the transposes', src: String.raw`(A B)^\top = A^\top B^\top`, decls: 'A, B: n×n', caught: true },
  { name: 'the inverse of the transpose is not the inverse', src: String.raw`(A^\top)^{-1} = A^{-1}`, decls: 'A: n×n', caught: true },
  { name: 'a square is not twice the matrix', src: String.raw`A^2 = 2 A`, decls: 'A: n×n', caught: true },
  { name: 'subtraction does not commute', src: String.raw`A - B = B - A`, decls: 'A, B: n×n', caught: true },
  { name: 'a quotient is not the product', src: String.raw`A / B = A B`, decls: 'A, B: n×n', caught: true },
  { name: 'the squared norm does not split a sum', src: String.raw`\|u + v\|^2 = \|u\|^2 + \|v\|^2`, decls: 'u, v: n', caught: true },
  { name: 'the unsquared norm does not split a sum', src: String.raw`\|u + v\| = \|u\| + \|v\|`, decls: 'u, v: n', caught: true },
  { name: 'an inner product is not the product of the norms', src: String.raw`\langle u, v \rangle = \|u\| \|v\|`, decls: 'u, v: n' },
  { name: 'a squared inner product is not the product of the squared norms', src: String.raw`\langle u, v \rangle^2 = \|u\|^2 \|v\|^2`, decls: 'u, v: n', caught: true },
  { name: 'the Frobenius norm does not split a sum', src: String.raw`\|A + B\|_F^2 = \|A\|_F^2 + \|B\|_F^2`, decls: 'A, B: n×n', caught: true },
  { name: 'a Kronecker product does not commute', src: String.raw`A \otimes B = B \otimes A`, decls: 'A, B: n×n', caught: true },
  { name: 'an element wise product is not a matrix product', src: String.raw`A \odot B = A B`, decls: 'A, B: n×n', caught: true },
  { name: 'a lower triangular matrix is not symmetric', src: String.raw`L^\top = L`, decls: 'L: tril n×n', caught: true },
  { name: 'a triangular matrix does not commute with its transpose', src: String.raw`U^\top U = U U^\top`, decls: 'U: triu n×n', caught: true },
  { name: 'the log of a square is not twice the log, for a scalar', src: String.raw`\log(x^2) = 2 \log x`, decls: 'x: scalar' },
  { name: 'the exponential does not split a sum of scalars', src: String.raw`e^{a + b} = e^a + e^b`, decls: 'a: scalar; b: scalar', caught: true },
  { name: 'a cube root is not a square root', src: String.raw`\sqrt[3]{8} = 3`, caught: true },
  { name: 'two fractional powers do not multiply their exponents', src: String.raw`x^{1/3} x^{2/3} = x^{2/9}`, decls: 'x: pos', caught: true },
  { name: 'the variance of an affine map is not taken on the other side', src: String.raw`\operatorname{Var}(A x) = A^\top \operatorname{Var}(x) A`, decls: 'x ~ N(\\mu, \\Sigma); \\mu: n; \\Sigma: spd n; A: n×n', caught: true },
  { name: 'the second moment of a Gaussian with a mean is not its covariance', src: String.raw`\mathbb{E}[x x^\top] = \Sigma`, decls: 'x ~ N(\\mu, \\Sigma); \\mu: n; \\Sigma: spd n', caught: true },
  { name: 'the cross product does not commute', src: String.raw`a \times b = b \times a`, decls: 'a, b: 3', caught: true },
  { name: 'the cross product is not associative', src: String.raw`a \times (b \times c) = (a \times b) \times c`, decls: 'a, b, c: 3', caught: true },
  { name: 'a reflection flips a cross product', src: String.raw`Q (a \times b) = (Q a) \times (Q b)`, decls: 'Q: orth 3; a, b: 3', caught: true },
  // a matrix power other than a half is not read: a question, never a guess
  { name: 'a cube root of a matrix is not read', src: String.raw`\Sigma^{1/3} = \Sigma`, decls: '\\Sigma: spd n' },
  { name: 'the matrix square root is not the identity', src: String.raw`\Sigma^{1/2} = I`, decls: '\\Sigma: spd n', caught: true },
  { name: 'a square of a Gaussian is not its mean', src: String.raw`E[x^2] = E[x]`, decls: 'x ~ N(\\mu, 1); \\mu: scalar', caught: true },
  { name: 'the adjugate of a product is not the product of the adjugates', src: String.raw`\operatorname{adj}(A B) = \operatorname{adj}(A)\operatorname{adj}(B)`, decls: 'A, B: n×n' },
  { name: 'the vectorisation does not survive a transpose', src: String.raw`\operatorname{vec}(A^\top) = \operatorname{vec}(A)`, decls: 'A: n×n' },
  {
    name: 'block rows do not commute',
    src: String.raw`\begin{pmatrix} A & B \end{pmatrix} = \begin{pmatrix} B & A \end{pmatrix}`,
    decls: 'A, B: n×n',
  },
];
