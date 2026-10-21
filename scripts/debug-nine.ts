import { check } from '../src/core/verdict.ts';
const src = String.raw`\begin{align*}
L(z) &:= -y\log\sigma(z) - (1 - y)\log\left(1 - \sigma(z)\right) \\
\frac{\partial L}{\partial z} &= \sigma(z) - y
\end{align*}`;
const r = check(src, { decls: 'z: scalar; y: scalar; L: fn 1→1' });
for (const s of r.steps) console.log(s.verdict, s.mode ?? '-', '|', s.message.slice(0, 90));
