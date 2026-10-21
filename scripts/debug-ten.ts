import { check } from '../src/core/verdict.ts';
const src = String.raw`\begin{align*}
h_1 &= \sigma(W_1 x + b_1) \\
\hat y &= W_2 h_1 + b_2 \\
\frac{\partial \hat y}{\partial h_1} &= W_2
\end{align*}`;
const r = check(src, { decls: 'x: d; W_1: h×d; b_1: h; h_1: h; W_2: k×h; b_2: k; y: k' });
for (const s of r.steps) console.log(s.verdict, s.mode ?? '-', '|', s.message.slice(0, 90));
