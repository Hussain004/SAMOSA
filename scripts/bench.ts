/**
 * The benchmarks.
 *
 * They are the numbers the plan asks for (gate G4): how long a check takes,
 * in the mode people use. The numbers are stored in `bench/baseline.json`,
 * and a regression of more than a fifth fails the build.
 *
 * The absolute time depends on the machine, so the baseline stores the time
 * of the engine together with the time of a calibration loop, and the gate
 * compares the two ratios. A shared runner and a laptop then give the same
 * answer.
 *
 *   pnpm bench
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { check } from '../src/core/index.ts';

const root = resolve(import.meta.dirname, '..');
const baselineFile = resolve(root, 'bench/baseline.json');

const KALMAN = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}
`;

const DECLS = String.raw`x_t, \bar\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \bar\Sigma_t: spd n`;

const WOODBURY = String.raw`\begin{align*}
(A + U C V)^{-1} &= A^{-1} - A^{-1}U\left(C^{-1} + VA^{-1}U\right)^{-1}VA^{-1}
\end{align*}
`;

const WOODBURY_DECLS = 'A: n×n; U: n×m; C: m×m; V: m×n';

const CASES: Array<{ name: string; run: () => void }> = [
  {
    name: 'the Kalman update, seven rows',
    run: () => {
      check(KALMAN, { decls: DECLS });
    },
  },
  {
    name: 'the Woodbury identity, one row',
    run: () => {
      check(WOODBURY, { decls: WOODBURY_DECLS });
    },
  },
];

/**
 * The calibration.
 *
 * A loop of arithmetic that the machine does at a speed of its own, so the
 * engine's time can be read as a ratio and not as a number of milliseconds.
 */
function calibration(): number {
  let x = 0.123456789;
  const started = performance.now();
  for (let i = 0; i < 300_000; i++) {
    // The engine allocates a matrix for every instance it evaluates, so the
    // calibration allocates as well: a machine that is slow at allocating
    // makes both slower, and the ratio stays the same.
    const scratch = new Float64Array(16);
    for (let j = 0; j < scratch.length; j++) scratch[j] = (x * 1.0000001 + j) % 1;
    x = scratch[3] + scratch[11];
  }
  const elapsed = performance.now() - started;
  // the loop is not optimised away
  if (x < 0) throw new Error('the calibration went wrong');
  return elapsed;
}

/** The best of five rounds, in milliseconds per run. */
function measure(run: () => void, rounds = 5): number {
  let best = Infinity;
  for (let round = 0; round < rounds; round++) {
    const runs = 100;
    const started = performance.now();
    for (let i = 0; i < runs; i++) run();
    const each = (performance.now() - started) / runs;
    if (each < best) best = each;
  }
  return Math.round(best * 1000) / 1000;
}

interface Measurement {
  /** the milliseconds per run */
  engine: number;
  /** the milliseconds of the calibration loop */
  calibration: number;
  /** the engine's time per millisecond of calibration */
  ratio: number;
}

const reference = Math.min(calibration(), calibration(), calibration());
const measured: Record<string, Measurement> = {};
for (const item of CASES) {
  const engine = measure(item.run);
  measured[item.name] = {
    engine,
    calibration: Math.round(reference * 1000) / 1000,
    ratio: Math.round((engine / reference) * 1e6) / 1e6,
  };
  console.log(`  ${item.name}: ${engine} ms (${measured[item.name].ratio} per calibration ms)`);
}

const write = process.argv.includes('--write');
const check_ = process.argv.includes('--check');

if (write) {
  writeFileSync(baselineFile, `${JSON.stringify(measured, null, 2)}\n`);
  console.log(`the baseline is written in ${baselineFile}`);
} else if (check_ && existsSync(baselineFile)) {
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')) as Record<string, Measurement>;
  const tolerance = Number(process.env.BENCH_TOLERANCE ?? '1.25');
  let failed = false;
  for (const [name, before] of Object.entries(baseline)) {
    const now = measured[name];
    if (!now || !before.ratio) continue;
    if (now.ratio > before.ratio * tolerance) {
      failed = true;
      console.error(
        `  ${name}: ${now.ratio} per calibration millisecond, the baseline is ${before.ratio}, so it got more than a fifth slower`,
      );
    }
  }
  if (failed) {
    console.error('the engine got slower');
    process.exit(1);
  }
  console.log('the engine is not slower than the baseline');
}
