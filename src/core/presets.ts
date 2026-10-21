import { parseDeclarations, type SymbolDecl } from './decl.ts';

/**
 * Presets: one click of well known notation, editable afterwards.
 *
 * Each preset is a block of declarations in the compact syntax. They exist
 * because "which symbol is the measurement noise" is the first thing that
 * stops a Kalman derivation from being checked.
 */

export interface Preset {
  id: string;
  label: string;
  /** the compact declarations */
  decls: string;
  /** a one line hint shown in the UI */
  hint: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'kalman-thrun',
    label: 'Kalman (Thrun)',
    hint: 'Q is the measurement noise, R is the process noise',
    decls:
      'x_t, \\bar\\mu_t, \\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t, \\Sigma_t: spd n; K_t: n×m',
  },
  {
    id: 'kalman-hpr',
    label: 'Kalman (H, P, R)',
    hint: 'H is the measurement matrix, P the covariance, R the noise',
    decls:
      'x, \\hat x, \\mu: n; z: m; H: m×n; R: spd m; P, \\bar P: spd n; K: n×m',
  },
  {
    id: 'linreg',
    label: 'Linear regression',
    hint: 'y = Xw + b, with the normal equations',
    decls: 'X: n×p; w: p; b: scalar; y: n; \\beta: p; \\lambda: pos',
  },
  {
    id: 'logreg',
    label: 'Logistic regression',
    hint: 'p = sigmoid(Xw + b)',
    decls: 'X: n×p; w: p; b: scalar; y: n; p: n; \\lambda: pos',
  },
  {
    id: 'mlp',
    label: 'MLP backprop',
    hint: 'one hidden layer, W1, W2 and the deltas',
    decls:
      'x: d; W_1: h×d; b_1: h; h_1: h; W_2: k×h; b_2: k; y: k; \\delta_1: h; \\delta_2: k',
  },
  {
    id: 'attention',
    label: 'Attention',
    hint: 'softmax(QK^T / sqrt(d) V)',
    decls: 'Q, K, V: n×d; d_k: scalar; A: n×n; O: n×d',
  },
  {
    id: 'gauss-cond',
    label: 'Gaussian conditioning',
    hint: 'joint Gaussian, its precision matrix and the conditional mean',
    decls:
      'x: n; y: m; \\Sigma_{xx}: spd n; \\Sigma_{yy}: spd m; \\Sigma_{xy}: n×m; \\mu_x: n; \\mu_y: m',
  },
  {
    id: 'lqr',
    label: 'LQR',
    hint: 'the Riccati recursion',
    decls: 'A: n×n; B: n×m; Q: spd n; R: spd m; P: spd n; K: m×n',
  },
  {
    id: 'pca',
    label: 'PCA',
    hint: 'eigen decomposition of a covariance matrix',
    decls: '\\Sigma: spd n; U: n×n; \\Lambda: n×n; x: n',
  },
];

export function getPreset(id: string | undefined): Preset | undefined {
  if (!id) return undefined;
  return PRESETS.find((p) => p.id === id);
}

/** The declarations of a preset, already parsed. */
export function presetDecls(id: string | undefined): SymbolDecl[] {
  const preset = getPreset(id);
  if (!preset) return [];
  return parseDeclarations(preset.decls).decls;
}
