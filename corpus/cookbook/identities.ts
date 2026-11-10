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
(A B) C &= A \cdot (B C)
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
    decls: 'A: n×n; B: n×n; C: n×n',
    source: String.raw`\begin{align*}
A \otimes (B + C) &= A \otimes B + A \otimes C
\end{align*}`,
  },
  {
    id: 'hadamard-of-sum',
    name: 'the Hadamard product of a sum',
    decls: N,
    source: String.raw`\begin{align*}
A \odot (B + C) &= A \odot B + A \odot C
\end{align*}`,
  },

  // -------------------------------------------------------- the matrix calculus
  {
    id: 'gradient-of-quadratic',
    name: 'the gradient of a quadratic form',
    decls: 'A: sym n×n; b: n; x: n',
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
    decls: 'A: sym n×n; x: n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x \\
\frac{\partial^2 J}{\partial x^2} &= A
\end{align*}`,
  },
  {
    id: 'gradient-of-transpose',
    name: 'the gradient of a transpose',
    decls: 'X: m×n; a: n; b: m',
    source: String.raw`\begin{align*}
J &:= a^\top X^\top b \\
\frac{\partial J}{\partial X} &= b a^\top
\end{align*}`,
  },
  {
    id: 'gradient-of-sum',
    name: 'the gradient of a sum',
    decls: 'A: sym n×n; B: sym n×n; x: n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x + \frac{1}{2} x^\top B x \\
\frac{\partial J}{\partial x} &= (A + B) x
\end{align*}`,
  },
  {
    id: 'stationary-point',
    name: 'a stationary point',
    decls: 'A: n×n; x: n',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2} x^\top A x \\
\frac{\partial J}{\partial x} = 0 &\implies x = 0
\end{align*}`,
  },

  // ------------------------------------------------------------- the stochastics
  {
    id: 'variance-of-sum',
    name: 'the variance of a sum',
    // two Gaussians declared apart are independent, which is what the
    // identity needs
    decls: 'x ~ N(\\mu, \\Sigma); y ~ N(\\nu, \\Lambda); \\mu, \\nu: n; \\Sigma, \\Lambda: spd n',
    source: String.raw`\begin{align*}
\operatorname{Var}(x + y) &= \operatorname{Var}(x) + \operatorname{Var}(y)
\end{align*}`,
  },
  {
    id: 'covariance-of-scaled',
    name: 'the covariance of a scaled variable',
    decls: 'x ~ N(\\mu, \\Sigma); \\mu: n; \\Sigma: spd n; A: m×n',
    source: String.raw`\begin{align*}
\operatorname{Var}(A x) &= A \operatorname{Var}(x) A^\top
\end{align*}`,
  },
  {
    id: 'gaussian-moment',
    name: 'the second moment of a Gaussian',
    decls: 'x ~ N(0, \\Sigma); \\Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x x^\top] &= \Sigma
\end{align*}`,
  },
  {
    id: 'gaussian-mean',
    name: 'the mean of a Gaussian',
    decls: 'x ~ N(\\mu, \\Sigma); \\mu: n; \\Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x] &= \mu
\end{align*}`,
  },
  {
    id: 'gaussian-trace',
    name: 'the trace of a Gaussian covariance',
    decls: 'x ~ N(0, \\Sigma); \\Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x^\top x] &= \operatorname{tr}(\Sigma)
\end{align*}`,
  },
  {
    id: 'kalman-covariance',
    name: 'the covariance of the Kalman update',
    decls: 'C: m×n; Q: spd m; R: spd n',
    source: String.raw`\begin{align*}
\Sigma &:= \left(C^\top Q^{-1} C + R^{-1}\right)^{-1} \\
\Sigma^{-1} &= C^\top Q^{-1} C + R^{-1}
\end{align*}`,
  },
  {
    id: 'kalman-gain',
    name: 'the Kalman gain',
    decls: 'C: m×n; Q: spd m; \\bar\\Sigma: spd n',
    source: String.raw`\begin{align*}
\Sigma &:= \left(C^\top Q^{-1} C + \bar\Sigma^{-1}\right)^{-1} \\
K &:= \Sigma C^\top Q^{-1} \\
K &= \bar\Sigma C^\top \left(C \bar\Sigma C^\top + Q\right)^{-1}
\end{align*}`,
  },
  {
    id: 'joseph-form',
    name: 'the Joseph form',
    decls: 'C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n; \\Sigma_t: spd n; K_t: n×m',
    source: String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top + K_t Q_t K_t^\top
\end{align*}`,
  },
  {
    id: 'push-through',
    name: 'the push-through identity',
    decls: 'C: m×n; Q: spd m; \\Sigma: spd n',
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
    decls: 'A: n×n; B: n×m; Q: spd n; R: spd m; \\Sigma: spd n',
    source: String.raw`\begin{align*}
\Sigma &:= A \Sigma A^\top + Q - A \Sigma B \left(R + B^\top \Sigma B\right)^{-1} B^\top \Sigma A^\top
\end{align*}`,
  },
  {
    id: 'least-squares',
    name: 'the normal equations',
    decls: 'X: n×p; y: n; \\beta: p',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2}\|y - X\beta\|^2 \\
\frac{\partial J}{\partial \beta} &= X^\top(X\beta - y)
\end{align*}`,
  },
  {
    id: 'ridge-gradient',
    name: 'the gradient of a ridge regression',
    decls: 'X: n×p; y: n; \\beta: p; \\Sigma: spd p; \\lambda: pos',
    source: String.raw`\begin{align*}
J &:= \frac{1}{2}\|y - X\beta\|^2 + \frac{\lambda}{2}\beta^\top \Sigma \beta \\
\frac{\partial J}{\partial \beta} &= X^\top(X\beta - y) + \lambda \Sigma \beta
\end{align*}`,
  },
  {
    id: 'softmax',
    name: 'the gradient of the softmax cross entropy',
    decls: '',
    source: String.raw`\begin{align*}
J &:= -\sum_i p_i \log \frac{e^{z_i}}{\sum_j e^{z_j}} \\
\frac{\partial J}{\partial z} &= \frac{e^z}{\sum_j e^{z_j}} - p
\end{align*}`,
  },
  {
    id: 'kl-of-gaussians',
    name: 'the KL of two Gaussians',
    decls: '\\mu: n; \\nu: n; \\Sigma: spd n; T: spd n',
    source: String.raw`\begin{align*}
D &:= \frac{1}{2}\left(\operatorname{tr}\left(\Sigma^{-1}\left(T + (\mu - \nu)(\mu - \nu)^\top\right)\right) - \operatorname{tr}(\Sigma^{-1}\Sigma) + \log\frac{\det\Sigma}{\det T}\right) \\
D - \frac{1}{2}(\mu - \nu)^\top \Sigma^{-1}(\mu - \nu) &= \frac{1}{2}\left(\operatorname{tr}(\Sigma^{-1}T) - \operatorname{tr}(\Sigma^{-1}\Sigma) + \log\frac{\det\Sigma}{\det T}\right)
\end{align*}`,
  },
  // ---------------------------------------------------------- the Kronecker
  {
    id: 'kron-mixed-product',
    name: 'the mixed product of Kronecker products',
    decls: 'A: m×n; B: p×q; C: n×k; D: q×l',
    source: String.raw`\begin{align*}
(A \otimes B)(C \otimes D) &= (A C) \otimes (B D)
\end{align*}`,
  },
  {
    id: 'kron-transpose',
    name: 'the transpose of a Kronecker product',
    decls: 'A: m×n; B: p×q',
    source: String.raw`\begin{align*}
(A \otimes B)^\top &= A^\top \otimes B^\top
\end{align*}`,
  },
  {
    id: 'kron-trace',
    name: 'the trace of a Kronecker product',
    decls: 'A: m×m; B: n×n',
    source: String.raw`\begin{align*}
\operatorname{tr}(A \otimes B) &= \operatorname{tr}(A) \operatorname{tr}(B)
\end{align*}`,
  },
  {
    id: 'kron-inverse',
    name: 'the inverse of a Kronecker product',
    decls: 'A: m×m; B: n×n',
    source: String.raw`\begin{align*}
(A \otimes B)^{-1} &= A^{-1} \otimes B^{-1}
\end{align*}`,
  },
  {
    id: 'kron-conjugate-inverse',
    name: 'the inverse of a conjugated Kronecker product',
    decls: 'A: m×m',
    source: String.raw`\begin{align*}
(I \otimes A)^{-1} &= I \otimes A^{-1}
\end{align*}`,
  },
  // -------------------------------------------------------- the determinant
  {
    id: 'det-of-product-of-transpose',
    name: 'the determinant of a Gram matrix',
    decls: 'A: n×n',
    source: String.raw`\begin{align*}
\det(A A^\top) &= \det(A)^2
\end{align*}`,
  },
  {
    id: 'det-of-householder',
    name: 'the determinant of a Householder reflection',
    decls: 'v: n',
    source: String.raw`\begin{align*}
P &:= I - 2 \frac{v v^\top}{v^\top v} \\
\det P &= -1
\end{align*}`,
  },
  {
    id: 'schur-complement-determinant',
    name: 'the Schur complement determinant lemma',
    decls: 'A: spd n; B: n×m; C: m×n; D: spd m',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ C & D \end{bmatrix} \\
\det M &= \det(A) \det(D - C A^{-1} B)
\end{align*}`,
  },
  {
    id: 'schur-complement-determinant-of-d',
    name: 'the Schur complement determinant lemma, the other way round',
    decls: 'A: spd n; B: n×m; C: m×n; D: spd m',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ C & D \end{bmatrix} \\
\det M &= \det(D) \det(A - B D^{-1} C)
\end{align*}`,
  },
  {
    id: 'block-triangular-determinant',
    name: 'the determinant of a block triangular matrix',
    decls: 'A: spd n; B: n×n; D: spd n; Z: zero n',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ Z & D \end{bmatrix} \\
\det M &= \det A \det D
\end{align*}`,
  },
  {
    id: 'logdet-of-inverse',
    name: 'the log determinant of an inverse',
    decls: '\\Sigma: spd n',
    source: String.raw`\begin{align*}
\log\det \Sigma^{-1} &= -\log\det \Sigma
\end{align*}`,
  },
  {
    id: 'logdet-of-product',
    name: 'the log determinant of a product',
    decls: 'A: spd n; B: spd n',
    source: String.raw`\begin{align*}
\log\det(A B) &= \log\det A + \log\det B
\end{align*}`,
  },
  // ------------------------------------------------------------ the calculus
  {
    id: 'logdet-gradient',
    name: 'the gradient of the log determinant',
    decls: '\\Sigma: spd n',
    source: String.raw`\begin{align*}
L &:= \log\det \Sigma \\
\frac{\partial L}{\partial \Sigma} &= \Sigma^{-1}
\end{align*}`,
  },
  {
    id: 'det-gradient',
    name: 'the gradient of the determinant',
    decls: '\\Sigma: spd n',
    source: String.raw`\begin{align*}
M &:= \det \Sigma \\
\frac{\partial M}{\partial \Sigma} &= M \Sigma^{-1}
\end{align*}`,
  },
  {
    id: 'frobenius-gradient',
    name: 'the gradient of the squared Frobenius norm',
    decls: 'A: m×n',
    source: String.raw`\begin{align*}
F &:= \|A\|_F^2 \\
\frac{\partial F}{\partial A} &= 2 A
\end{align*}`,
  },
  {
    id: 'quadratic-symmetric-gradient',
    name: 'the gradient of a quadratic form',
    decls: 'A: n×n; x: n',
    source: String.raw`\begin{align*}
Q &:= x^\top A x \\
\frac{\partial Q}{\partial x} &= (A + A^\top) x
\end{align*}`,
  },
  {
    id: 'quadratic-norm-gradient',
    name: 'the gradient of a squared norm',
    decls: 'x: n',
    source: String.raw`\begin{align*}
N &:= x^\top x \\
\frac{\partial N}{\partial x} &= 2 x
\end{align*}`,
  },
  {
    id: 'trace-gradient',
    name: 'the gradient of a trace',
    decls: 'A: m×n; B: n×m',
    source: String.raw`\begin{align*}
T &:= \operatorname{tr}(A B) \\
\frac{\partial T}{\partial A} &= B^\top
\end{align*}`,
  },
  {
    id: 'trace-inverse-gradient',
    name: 'the gradient of the trace of an inverse',
    decls: 'A: spd n; B: spd n',
    source: String.raw`\begin{align*}
L &:= \operatorname{tr}(A^{-1} B) \\
\frac{\partial L}{\partial A} &= -A^{-1} B^\top A^{-1}
\end{align*}`,
  },
  {
    id: 'inverse-trace-gradient',
    name: 'the gradient of the trace of an inverse, the simple one',
    decls: 'A: spd n',
    source: String.raw`\begin{align*}
T &:= \operatorname{tr}(A^{-1}) \\
\frac{\partial T}{\partial A} &= -A^{-1} A^{-1}
\end{align*}`,
  },
  {
    id: 'bilinear-gradient',
    name: 'the gradient of a bilinear form',
    decls: 'A: m×n; x: n; y: m',
    source: String.raw`\begin{align*}
B &:= x^\top A^\top y \\
\frac{\partial B}{\partial x} &= A^\top y
\end{align*}`,
  },
  // ------------------------------------------------------------- the blocks
  {
    id: 'block-trace',
    name: 'the trace of a block matrix',
    decls: 'A: m×m; B: m×n; C: n×m; D: n×n',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ C & D \end{bmatrix} \\
\operatorname{tr} M &= \operatorname{tr} A + \operatorname{tr} D
\end{align*}`,
  },
  {
    id: 'block-transpose',
    name: 'the transpose of a block matrix',
    decls: 'A: m×m; B: m×n; C: n×m; D: n×n',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ C & D \end{bmatrix} \\
M^\top &= \begin{bmatrix} A^\top & C^\top \\ B^\top & D^\top \end{bmatrix}
\end{align*}`,
  },
  {
    id: 'block-sum',
    name: 'a block matrix is the sum of its blocks',
    decls: 'A: m×m; B: m×n; C: n×m; D: n×n; U: zero m; V: zero n; X: zero n×m; Y: zero m×n',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ C & D \end{bmatrix} \\
M &= \begin{bmatrix} A & Y \\ X & D \end{bmatrix} + \begin{bmatrix} U & B \\ C & V \end{bmatrix}
\end{align*}`,
  },
  {
    id: 'block-triangular-inverse',
    name: 'the inverse of a block triangular matrix',
    decls: 'A: spd n; B: n×m; D: spd m; Z: zero m×n',
    source: String.raw`\begin{align*}
M &:= \begin{bmatrix} A & B \\ Z & D \end{bmatrix} \\
M^{-1} &= \begin{bmatrix} A^{-1} & -A^{-1} B D^{-1} \\ Z & D^{-1} \end{bmatrix}
\end{align*}`,
  },
  // ------------------------------------------------------------- the geometry
  {
    id: 'skew-symmetric',
    name: 'a difference with its transpose is skew symmetric',
    decls: 'A: n×n',
    source: String.raw`\begin{align*}
S &:= A - A^\top \\
S^\top &= -S
\end{align*}`,
  },
  {
    id: 'symmetrized-sum',
    name: 'a sum with its transpose is symmetric',
    decls: 'A: n×n',
    source: String.raw`\begin{align*}
S &:= A + A^\top \\
S^\top &= S
\end{align*}`,
  },
  {
    id: 'householder-symmetric',
    name: 'a Householder matrix is symmetric',
    decls: 'v: n',
    source: String.raw`\begin{align*}
P &:= I - 2 \frac{v v^\top}{v^\top v} \\
P^\top &= P
\end{align*}`,
  },
  {
    id: 'householder-orthogonal',
    name: 'a Householder matrix is orthogonal',
    decls: 'v: n',
    source: String.raw`\begin{align*}
P &:= I - 2 \frac{v v^\top}{v^\top v} \\
P^\top P &= I
\end{align*}`,
  },
  {
    id: 'householder-annihilates-vector',
    name: 'a Householder matrix flips its own vector',
    decls: 'v: n',
    source: String.raw`\begin{align*}
P &:= I - 2 \frac{v v^\top}{v^\top v} \\
P v &= -v
\end{align*}`,
  },
  {
    id: 'projection-idempotent',
    name: 'an orthogonal projection is idempotent',
    decls: 'A: n×p',
    source: String.raw`\begin{align*}
P &:= A (A^\top A)^{-1} A^\top \\
P^2 &= P
\end{align*}`,
  },
  {
    id: 'projection-symmetric',
    name: 'an orthogonal projection is symmetric',
    decls: 'A: n×p',
    source: String.raw`\begin{align*}
P &:= A (A^\top A)^{-1} A^\top \\
P^\top &= P
\end{align*}`,
  },
  {
    id: 'projection-annihilates',
    name: 'an orthogonal projection leaves its own range alone',
    decls: 'A: n×p',
    source: String.raw`\begin{align*}
P &:= A (A^\top A)^{-1} A^\top \\
P A &= A
\end{align*}`,
  },
  {
    id: 'residual-projection',
    name: 'the residual of a projection is zero',
    decls: 'A: n×p',
    source: String.raw`\begin{align*}
P &:= A (A^\top A)^{-1} A^\top \\
(I - P) A &= 0
\end{align*}`,
  },
  {
    id: 'projection-complement',
    name: 'the complement of a projection is a projection',
    decls: 'A: n×p',
    source: String.raw`\begin{align*}
P &:= A (A^\top A)^{-1} A^\top \\
(I - P)^2 &= I - P
\end{align*}`,
  },
  {
    id: 'orthogonal-transpose-inverse',
    name: 'an orthogonal matrix is its transpose inverse',
    decls: 'Q: orth n',
    source: String.raw`\begin{align*}
Q^\top Q &= I
\end{align*}`,
  },
  {
    id: 'hadamard-transpose',
    name: 'the transpose of a Hadamard product',
    decls: N,
    source: String.raw`\begin{align*}
(A \odot B)^\top &= A^\top \odot B^\top
\end{align*}`,
  },
  {
    id: 'outer-product-square',
    name: 'an outer product squared is a multiple of itself',
    decls: 'v: n',
    source: String.raw`\begin{align*}
X &:= v v^\top \\
X X &= (v^\top v) X
\end{align*}`,
  },
  {
    id: 'outer-product-trace',
    name: 'the trace of an outer product',
    decls: 'v: n',
    source: String.raw`\begin{align*}
X &:= v v^\top \\
\operatorname{tr} X &= v^\top v
\end{align*}`,
  },
  // ------------------------------------------------------------ the stochastics
  {
    id: 'expectation-quadratic-of-normal',
    name: 'the second moment of a normal vector',
    decls: 'x ~ N(0, \\Sigma); \\Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x^\top x] &= \operatorname{tr}(\Sigma)
\end{align*}`,
  },
  {
    id: 'expectation-of-normal-vector',
    name: 'the mean of a normal vector',
    decls: 'x ~ N(\\mu, \\Sigma); \\mu: n; \\Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}[x] &= \mu
\end{align*}`,
  },
];
