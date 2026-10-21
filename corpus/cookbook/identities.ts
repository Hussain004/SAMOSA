/**
 * The Cookbook.
 *
 * The identities people write in matrix algebra, matrix calculus and
 * stochastics. Each one is checked exactly, and each one is checked with the
 * mutants the mistake catalog can make of it, so a mutant that is caught on
 * the wrong row is a failure of the engine and not of the corpus.
 *
 * The numbers this corpus produces are the ones the launch gates are
 * measured with: the false checkmarks and the caught mutants.
 */

export interface Identity {
  id: string;
  name: string;
  /** the declarations, in the compact syntax */
  decls: string;
  /** the derivation, in LaTeX */
  source: string;
}

const N = 'A, B, C, D: n×n';

export const IDENTITIES: Identity[] = [
  // ------------------------------------------------------------- the algebra
  {
    id: 'transpose-of-sum',
    name: 'the transpose of a sum',
    decls: N,
    source: String.raw`\begin{align*}
(A + B)^\top &= A^\top + B^\top
\end{align*}`,
  },
  {
    id: 'transpose-of-product',
    name: 'the transpose of a product',
    decls: N,
    source: String.raw`\begin{align*}
(A B)^\top &= B^\top A^\top
\end{align*}`,
  },
  {
    id: 'transpose-of-transpose',
    name: 'the transpose of a transpose',
    decls: N,
    source: String.raw`\begin{align*}
(A^\top)^\top &= A
\end{align*}`,
  },
  {
    id: 'product-of-sums',
    name: 'a product of two sums',
    decls: N,
    source: String.raw`\begin{align*}
(A + B)(C + D) &= AC + AD + BC + BD
\end{align*}`,
  },
  {
    id: 'inverse-of-product',
    name: 'the inverse of a product',
    decls: N,
    source: String.raw`\begin{align*}
(A B)^{-1} &= B^{-1} A^{-1}
\end{align*}`,
  },
  {
    id: 'inverse-of-inverse',
    name: 'the inverse of an inverse',
    decls: N,
    source: String.raw`\begin{align*}
(A^{-1})^{-1} &= A
\end{align*}`,
  },
  {
    id: 'inverse-of-transpose',
    name: 'the inverse of a transpose',
    decls: N,
    source: String.raw`\begin{align*}
(A^\top)^{-1} &= (A^{-1})^\top
\end{align*}`,
  },
  {
    id: 'left-inverse',
    name: 'a left inverse is a left inverse',
    decls: N,
    source: String.raw`\begin{align*}
A^{-1} A &= I
\end{align*}`,
  },
  {
    id: 'right-inverse',
    name: 'a right inverse is a right inverse',
    decls: N,
    source: String.raw`\begin{align*}
A A^{-1} &= I
\end{align*}`,
  },
  {
    id: 'inverse-of-sum',
    name: 'the inverse of a sum, in the Woodbury form',
    decls: 'A: n×n; U: n×m; C: m×m; V: m×n',
    source: String.raw`\begin{align*}
(A + U C V)^{-1} &= A^{-1} - A^{-1}U\left(C^{-1} + V A^{-1}U\right)^{-1}V A^{-1}
\end{align*}`,
  },
  {
    id: 'det-of-product',
    name: 'the determinant of a product',
    decls: N,
    source: String.raw`\begin{align*}
\det(A B) &= \det(A) \det(B)
\end{align*}`,
  },
  {
    id: 'det-of-transpose',
    name: 'the determinant of a transpose',
    decls: N,
    source: String.raw`\begin{align*}
\det(A^\top) &= \det(A)
\end{align*}`,
  },
  {
    id: 'det-of-inverse',
    name: 'the determinant of an inverse',
    decls: N,
    source: String.raw`\begin{align*}
\det(A^{-1}) &= \frac{1}{\det(A)}
\end{align*}`,
  },
  {
    id: 'det-lemma',
    name: 'the matrix determinant lemma',
    decls: 'A: n×n; u: n; v: n; c: pos',
    source: String.raw`\begin{align*}
\det(A + c u v^\top) &= \det(A)\left(1 + c\,v^\top A^{-1}u\right)
\end{align*}`,
  },
  {
    id: 'sherman-morrison',
    name: 'the Sherman-Morrison formula',
    decls: 'A: n×n; u: n; v: n; c: pos',
    source: String.raw`\begin{align*}
(A + c u v^\top)^{-1} &= A^{-1} - \frac{c\,A^{-1}u v^\top A^{-1}}{1 + c\,v^\top A^{-1}u}
\end{align*}`,
  },
  {
    id: 'trace-cyclic',
    name: 'the trace of a product is cyclic',
    decls: N,
    source: String.raw`\begin{align*}
\operatorname{tr}(A B C) &= \operatorname{tr}(B C A)
\end{align*}`,
  },
  {
    id: 'trace-of-sum',
    name: 'the trace of a sum',
    decls: N,
    source: String.raw`\begin{align*}
\operatorname{tr}(A + B) &= \operatorname{tr}(A) + \operatorname{tr}(B)
\end{align*}`,
  },
  {
    id: 'trace-of-transpose',
    name: 'the trace of a transpose',
    decls: N,
    source: String.raw`\begin{align*}
\operatorname{tr}(A^\top) &= \operatorname{tr}(A)
\end{align*}`,
  },
  {
    id: 'trace-of-product-of-transpose',
    name: 'the trace of a product with a transpose',
    decls: N,
    source: String.raw`\begin{align*}
\operatorname{tr}(A^\top B) &= \operatorname{tr}(B A^\top)
\end{align*}`,
  },
  {
    id: 'frob-norm-of-transpose',
    name: 'the Frobenius norm of a transpose',
    decls: N,
    source: String.raw`\begin{align*}
\|A^\top\|_F^2 &= \|A\|_F^2
\end{align*}`,
  },
  {
    id: 'spectral-norm-of-transpose',
    name: 'the spectral norm of a transpose',
    decls: N,
    source: String.raw`\begin{align*}
\|A^\top\| &= \|A\|
\end{align*}`,
  },
  {
    id: 'quadratic-form',
    name: 'the transpose of a quadratic form',
    decls: N,
    source: String.raw`\begin{align*}
(A^\top B)^\top &= B^\top A
\end{align*}`,
  },
  {
    id: 'assoc',
    name: 'the product is associative',
    decls: N,
    source: String.raw`\begin{align*}
(A B) C &= A (B C)
\end{align*}`,
  },
  {
    id: 'identity-product',
    name: 'the identity is the neutral element',
    decls: N,
    source: String.raw`\begin{align*}
I A &= A
\end{align*}`,
  },
  {
    id: 'zero-product',
    name: 'zero times anything is zero',
    decls: N,
    source: String.raw`\begin{align*}
0 A &= 0
\end{align*}`,
  },
  {
    id: 'transpose-of-scalar-product',
    name: 'the transpose of a product of three',
    decls: N,
    source: String.raw`\begin{align*}
(A B C)^\top &= C^\top B^\top A^\top
\end{align*}`,
  },
  {
    id: 'kron-of-sum',
    name: 'the Kronecker product of a sum',
    decls: 'A: n×n; B: m×m; C: p×p',
    source: String.raw`\begin{align*}
A \otimes (B + C) &= A \otimes B + A \otimes C
\end{align*}`,
  },
  {
    id: 'hadamard-of-sum',
    name: 'the Hadamard product of a sum',
    decls: N,
    source: String.raw`\begin{align*}
A \circ (B + C) &= A \circ B + A \circ C
\end{align*}`,
  },
  {
    id: 'diag-of-product',
    name: 'the diagonal of a product',
    decls: N,
    source: String.raw`\begin{align*}
\operatorname{diag}(A B) &= \operatorname{diag}(A B)
\end{align*}`,
  },

  // -------------------------------------------------------- the matrix calculus
  {
    id: 'gradient-of-quadratic',
    name: 'the gradient of a quadratic form',
    decls: 'X: n×n; b: n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x + b^\top x \\
\frac{\partial J}{\partial x} &= A x + b
\end{align*}`,
  },
  {
    id: 'gradient-of-quadratic-matrix',
    name: 'the gradient of a matrix quadratic form',
    decls: 'X: m×n; a: m; b: n',
    source: String.raw`\begin{align*}
J &:= a^\top X b \\
\frac{\partial J}{\partial X} &= a b^\top
\end{align*}`,
  },
  {
    id: 'hessian-of-quadratic',
    name: 'the Hessian of a quadratic form',
    decls: 'X: n×n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x \\
\frac{\partial^2 J}{\partial x^2} &= A
\end{align*}`,
  },
  {
    id: 'gradient-of-scaled',
    name: 'the gradient of a scaled function',
    decls: 'X: n×n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x \\
\frac{\partial (2 J)}{\partial x} &= A x
\end{align*}`,
  },
  {
    id: 'chain-rule',
    name: 'the chain rule',
    decls: 'X: n×n; W: n×n',
    source: String.raw`\begin{align*}
f &:= \sigma(X W) \\
\frac{\partial f}{\partial W} &= X^\top \sigma'(X W)
\end{align*}`,
  },
  {
    id: 'gradient-of-transpose',
    name: 'the gradient of a transpose',
    decls: 'X: m×n; a: m; b: n',
    source: String.raw`\begin{align*}
J &:= a^\top X^\top b \\
\frac{\partial J}{\partial X} &= b a^\top
\end{align*}`,
  },
  {
    id: 'gradient-of-sum',
    name: 'the gradient of a sum',
    decls: 'X: n×n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x + \frac{1}{2} x^\top B x \\
\frac{\partial J}{\partial x} &= (A + B) x
\end{align*}`,
  },
  {
    id: 'stationary-point',
    name: 'a stationary point',
    decls: 'X: n×n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x \\
\frac{\partial J}{\partial x} = 0 &\implies x = 0
\end{align*}`,
  },

  // ------------------------------------------------------------- the stochastics
  {
    id: 'variance-of-sum',
    name: 'the variance of a sum',
    decls: 'x: n; y: n; Sigma: spd n',
    source: String.raw`\begin{align*}
\operatorname{Var}(x + y) &= \operatorname{Var}(x) + \operatorname{Var}(y)
\end{align*}`,
  },
  {
    id: 'covariance-of-scaled',
    name: 'the covariance of a scaled variable',
    decls: 'x: n; a: n',
    source: String.raw`\begin{align*}
\operatorname{Var}(a x) &= a \operatorname{Var}(x) a^\top
\end{align*}`,
  },
  {
    id: 'gaussian-moment',
    name: 'the second moment of a Gaussian',
    decls: 'x: n; Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x x^\top] &= \Sigma
\end{align*}`,
  },
  {
    id: 'gaussian-mean',
    name: 'the mean of a Gaussian',
    decls: 'x: n; mu: n; Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x] &= \mu
\end{align*}`,
  },
  {
    id: 'gaussian-trace',
    name: 'the trace of a Gaussian covariance',
    decls: 'x: n; Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x^\top x] &= \operatorname{tr}(\Sigma)
\end{align*}`,
  },
  {
    id: 'kalman-covariance',
    name: 'the covariance of the Kalman update',
    decls: 'x: n; z: m; C: m×n; Q: spd m; R: spd n',
    source: String.raw`\begin{align*}
\Sigma &:= \left(C^\top Q^{-1} C + R^{-1}\right)^{-1}
\end{align*}`,
  },
  {
    id: 'kalman-gain',
    name: 'the Kalman gain',
    decls: 'C: m×n; Q: spd m; Sigma: spd n',
    source: String.raw`\begin{align*}
K &:= \Sigma C^\top Q^{-1}
\end{align*}`,
  },
  {
    id: 'joseph-form',
    name: 'the Joseph form',
    decls: 'C: m×n; Q: spd m; Sigma: spd n; K: n×m',
    source: String.raw`\begin{align*}
\Sigma &= (I - K C)\, \Sigma (I - K C)^\top + K Q K^\top
\end{align*}`,
  },
  {
    id: 'push-through',
    name: 'the push-through identity',
    decls: 'C: m×n; Q: spd m; Sigma: spd n',
    source: String.raw`\begin{align*}
\Sigma - \Sigma C^\top\left(Q + C \Sigma C^\top\right)^{-1} C \Sigma
&= \left(C^\top Q^{-1} C + \Sigma^{-1}\right)^{-1}
\end{align*}`,
  },
  {
    id: 'woodbury',
    name: 'the Woodbury identity',
    decls: 'A: n×n; U: n×m; C: m×m; V: m×n',
    source: String.raw`\begin{align*}
(A + U C V)^{-1} &= A^{-1} - A^{-1}U\left(C^{-1} + V A^{-1}U\right)^{-1}V A^{-1}
\end{align*}`,
  },
  {
    id: 'riccati',
    name: 'the Riccati recursion',
    decls: 'A: n×n; B: n×m; Q: spd n; R: spd m; Sigma: spd n',
    source: String.raw`\begin{align*}
\Sigma &:= A \Sigma A^\top + Q - A \Sigma B \left(R + B^\top \Sigma B\right)^{-1} B^\top \Sigma A^\top
\end{align*}`,
  },
  {
    id: 'least-squares',
    name: 'the normal equations',
    decls: 'X: n×p; y: n',
    source: String.raw`\begin{align*}
\frac{\partial}{\partial \beta} \frac{1}{2}\|y - X\beta\|^2 &= X^\top(X\beta - y)
\end{align*}`,
  },
  {
    id: 'ridge-gradient',
    name: 'the gradient of a ridge regression',
    decls: 'X: n×p; y: n; beta: p; Sigma: spd p',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2}\|y - X\beta\|^2 + \frac{\lambda}{2}\beta^\top \Sigma \beta \\
\frac{\partial J}{\partial \beta} &= X^\top(X\beta - y) + \lambda \Sigma \beta
\end{align*}`,
  },
  {
    id: 'softmax',
    name: 'the gradient of the softmax cross entropy',
    decls: 'z: n; p: n',
    source: String.raw`\begin{align*}
J &:= -\sum_i p_i \log \frac{e^{z_i}}{\sum_j e^{z_j}} \\
\frac{\partial J}{\partial z} &= \frac{e^z}{\sum_j e^{z_j}} - p
\end{align*}`,
  },
  {
    id: 'kl-of-gaussians',
    name: 'the KL of two Gaussians',
    decls: 'mu: n; nu: n; Sigma: spd n; Tau: spd n',
    source: String.raw`\begin{align*}
D &= \frac{1}{2}\operatorname{tr}\left(\Sigma^{-1}\left(\tau + (\mu - \nu)(\mu - \nu)^\top\right)\right)
- \frac{n}{2} + \frac{1}{2}\log\frac{\det(\Sigma)}{\det(\tau)}
\end{align*}`,
  },
];
