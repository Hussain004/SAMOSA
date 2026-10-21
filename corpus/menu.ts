/**
 * The Menu (F11).
 *
 * Fifteen derivations that people actually write, each with a correct version
 * and one or two planted bugs. They are the golden test suite, the demo
 * material of the landing page and the examples of the app.
 */

export interface MenuItem {
  id: string;
  title: string;
  /** one line, for the card */
  blurb: string;
  /** the declarations, in the compact syntax */
  decls: string;
  /** the derivation, in LaTeX */
  source: string;
  /** the row the bug is planted in, for the spot the bug game */
  bugRow?: number;
  /** the planted bug, for the spot the bug game */
  bugSource?: string;
  /** the bug of the second variant */
  bugSource2?: string;
}

export const MENU: MenuItem[] = [
  {
    id: 'woodbury',
    title: 'Woodbury',
    blurb: 'The inverse of a sum, in the form everybody uses it.',
    decls: 'A: n×n; U: n×m; C: m×m; V: m×n',
    source: String.raw`\begin{align*}
(A + UCV)^{-1} &= A^{-1} - A^{-1}U\left(C^{-1} + VA^{-1}U\right)^{-1}VA^{-1}
\end{align*}`,
    bugSource: String.raw`\begin{align*}
(A + UCV)^{-1} &= A^{-1} - A^{-1}U\left(C^{-1} + VA^{-1}U\right)^{-1}UA^{-1}
\end{align*}`,
  },
  {
    id: 'sherman-morrison',
    title: 'Sherman-Morrison',
    blurb: 'The rank one update of an inverse.',
    decls: 'A: n×n; u: n; v: n; c: pos',
    source: String.raw`\begin{align*}
(A + cuv^\top)^{-1} &= A^{-1} - \frac{c\,A^{-1}uv^\top A^{-1}}{1 + c\,v^\top A^{-1}u}
\end{align*}`,
    bugSource: String.raw`\begin{align*}
(A + cuv^\top)^{-1} &= A^{-1} - \frac{c\,A^{-1}uv^\top A^{-1}}{1 + v^\top A^{-1}u}
\end{align*}`,
  },
  {
    id: 'det-lemma',
    title: 'Matrix determinant lemma',
    blurb: 'How a rank one update changes a determinant.',
    decls: 'A: n×n; u: n; v: n; c: pos',
    source: String.raw`\begin{align*}
\det(A + cuv^\top) &= \det(A)\left(1 + c\,v^\top A^{-1}u\right)
\end{align*}`,
    bugSource: String.raw`\begin{align*}
\det(A + cuv^\top) &= \det(A)\left(1 + c\,v^\top A u\right)
\end{align*}`,
  },
  {
    id: 'trace',
    title: 'Trace identities',
    blurb: 'The cyclic property of the trace, and the trace of a product.',
    decls: 'A: n×n; B: n×n; C: n×n',
    source: String.raw`\begin{align*}
\operatorname{tr}(ABC) &= \operatorname{tr}(BCA) \\
\operatorname{tr}(A B) &= \operatorname{tr}(B A)
\end{align*}`,
    bugSource: String.raw`\begin{align*}
\operatorname{tr}(ABC) &= \operatorname{tr}(BAC) \\
\operatorname{tr}(A B) &= \operatorname{tr}(B A)
\end{align*}`,
  },
  {
    id: 'kalman',
    title: 'Kalman update',
    blurb: 'The measurement update, from Mobile Robotics Lecture 8.',
    decls: 'x_t, \\bar\\mu_t, \\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t, \\Sigma_t: spd n; K_t: n×m',
    source: String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
\frac{\partial J_t}{\partial x_t} = 0 &\implies x_t = \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}`,
    bugRow: 8,
    bugSource: String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
\frac{\partial J_t}{\partial x_t} = 0 &\implies x_t = \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t^{-1}\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}`,
    bugSource2: String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
\frac{\partial J_t}{\partial x_t} = 0 &\implies x_t = \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}`,
  },
  {
    id: 'joseph',
    title: 'Joseph form',
    blurb: 'The numerically stable covariance update, with the noise term.',
    decls: 'x: n; z: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t, \\Sigma_t: spd n; K_t: n×m',
    source: String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top + K_t Q_t K_t^\top
\end{align*}`,
    bugSource: String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}`,
  },
  {
    id: 'least-squares',
    title: 'Least squares',
    blurb: 'The normal equations, and the pseudo inverse that solves them.',
    decls: 'X: n×p; y: n; w: p',
    source: String.raw`\begin{align*}
w^\star &:= (X^\top X)^{-1}X^\top y \\
X^\top X w^\star &= X^\top X (X^\top X)^{-1}X^\top y
\end{align*}`,
    bugSource: String.raw`\begin{align*}
w^\star &:= (X^\top X)^{-1}X^\top y \\
X^\top X w^\star &= X^\top X (X^\top X)^{-1}X y
\end{align*}`,
  },
  {
    id: 'ridge',
    title: 'Ridge regression',
    blurb: 'The normal equations with a penalty.',
    decls: 'X: n×p; y: n; w: p; \\lambda: pos',
    source: String.raw`\begin{align*}
w^\star &:= (X^\top X + \lambda I)^{-1}X^\top y \\
(X^\top X + \lambda I)w^\star &= X^\top y
\end{align*}`,
    bugSource: String.raw`\begin{align*}
w^\star &:= (X^\top X + \lambda I)^{-1}X^\top y \\
(X^\top X + \lambda I)w^\star &= X y
\end{align*}`,
  },
  {
    id: 'logistic',
    title: 'Logistic regression',
    blurb: 'The gradient and the Hessian of the cross entropy.',
    decls: 'X: 1×p; w: p; y: scalar; J: fn p→1',
    source: String.raw`\begin{align*}
J(w) &:= \log\left(1 + e^{-Xw y}\right) \\
\frac{\partial J}{\partial w} &= -X^\top y\,\sigma(-Xw y)
\end{align*}`,
    bugSource: String.raw`\begin{align*}
J(w) &:= \log\left(1 + e^{-Xw y}\right) \\
\frac{\partial J}{\partial w} &= -X^\top y\,\sigma(-Xw)
\end{align*}`,
  },
  {
    id: 'softmax-ce',
    title: 'Softmax cross entropy',
    blurb: 'The gradient everybody writes from memory.',
    decls: 'z: scalar; y: scalar; L: fn 1→1',
    source: String.raw`\begin{align*}
L(z) &:= -y\log\sigma(z) - (1 - y)\log\left(1 - \sigma(z)\right) \\
\frac{\partial L}{\partial z} &= \sigma(z) - y
\end{align*}`,
    bugSource: String.raw`\begin{align*}
L(z) &:= -y\log\sigma(z) - (1 - y)\log\left(1 - \sigma(z)\right) \\
\frac{\partial L}{\partial z} &= y - \sigma(z)
\end{align*}`,
  },
  {
    id: 'mlp',
    title: 'Two layer network',
    blurb: 'Backpropagation through one hidden layer.',
    decls: 'x: d; W_1: h×d; b_1: h; h_1: h; W_2: k×h; b_2: k; y: k',
    source: String.raw`\begin{align*}
h_1 &= \sigma(W_1 x + b_1) \\
\hat y &= W_2 h_1 + b_2 \\
\frac{\partial \hat y}{\partial h_1} &= W_2
\end{align*}`,
    bugSource: String.raw`\begin{align*}
h_1 &= \sigma(W_1 x + b_1) \\
\hat y &= W_2 h_1 + b_2 \\
\frac{\partial \hat y}{\partial h_1} &= W_2^\top
\end{align*}`,
  },
  {
    id: 'gauss-cond',
    title: 'The variance of a Gaussian',
    blurb: 'The variance of a normal variable, computed by the exact quadrature.',
    decls: 'x ~ N(\\mu, \\Sigma); \\mu: n; \\Sigma: spd n',
    source: String.raw`\begin{align*}
\operatorname{Var}(x) &= \Sigma
\end{align*}`,
    bugSource: String.raw`\begin{align*}
\operatorname{Var}(x) &= \mu^\top \mu
\end{align*}`,
  },
  {
    id: 'quadratic',
    title: 'The expectation of a quadratic form',
    blurb: 'E[x^T A x] for a Gaussian, exactly.',
    decls: 'x ~ N(\\mu, \\Sigma); A: n×n; \\mu: n; \\Sigma: spd n',
    source: String.raw`\begin{align*}
\mathbb{E}_{x}\left[x^\top A x\right] &= \operatorname{tr}(A\Sigma) + \mu^\top A \mu
\end{align*}`,
    bugSource: String.raw`\begin{align*}
\mathbb{E}_{x}\left[x^\top A x\right] &= \mu^\top A \mu
\end{align*}`,
  },
  {
    id: 'kl-gauss',
    title: 'The KL of two Gaussians',
    blurb: 'The formula everybody copies.',
    decls: 'p: n; q: n; \\mu_p: n; \\mu_q: n; \\Sigma_p: spd n; \\Sigma_q: spd n; D: fn n→1',
    source: String.raw`\begin{align*}
D(p \Vert q) &:= \frac{1}{2}\left(\operatorname{tr}(\Sigma_q^{-1}\Sigma_p) - \operatorname{tr}(I) + \log\frac{\det\Sigma_q}{\det\Sigma_p} + (\mu_p - \mu_q)^\top\Sigma_q^{-1}(\mu_p - \mu_q)\right)
\end{align*}`,
  },
  {
    id: 'lqr',
    title: 'The Riccati recursion',
    blurb: 'One step of the infinite horizon LQR.',
    decls: 'A: n×n; B: n×m; Q: spd n; R: spd m; P: spd n; K: m×n',
    source: String.raw`\begin{align*}
K &:= (R + B^\top P B)^{-1}B^\top P A \\
(R + B^\top P B)K &= B^\top P A
\end{align*}`,
    bugSource: String.raw`\begin{align*}
K &:= (R + B^\top P B)^{-1}B^\top P A \\
(R + B^\top P B)K &= B^\top P A^\top
\end{align*}`,
  },
  {
    id: 'rotation',
    title: 'Rotations and the cross product',
    blurb: 'R^T R = I, and the skew symmetric form of the cross product.',
    decls: 'R: orth n',
    source: String.raw`\begin{align*}
R^\top R &= I \\
R^{-1} &= R^\top
\end{align*}`,
  },
];

export function menuItem(id: string): MenuItem | undefined {
  return MENU.find((m) => m.id === id);
}
