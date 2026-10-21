// Probe: does unified-latex keep source offsets inside math, and how does it tokenize ^T, ^{-1}, \hat, subscripts?
import { createRequire } from "node:module";
const require = createRequire(process.argv[2] + "/package.json");
const { parse } = require("@unified-latex/unified-latex-util-parse");

const src = String.raw`\begin{align}
P^+ &= (I - K H) P^- \\
    &= P^- - K\,H P^{-\top} + \hat{x}_{k|k-1}^{T} \Sigma^{-1}
\end{align}`;

const ast = parse(src);
const seen = [];
(function walk(n, d) {
  if (!n || typeof n !== "object") return;
  if (n.type) {
    const p = n.position ? `${n.position.start.offset}-${n.position.end.offset}` : "NOPOS";
    const label = n.type === "string" ? JSON.stringify(n.content) : n.type === "macro" ? "\\" + n.content : n.type;
    seen.push(`${" ".repeat(d)}${label} [${p}]${n.position ? " src=" + JSON.stringify(src.slice(n.position.start.offset, n.position.end.offset)) : ""}`);
  }
  for (const k of ["content", "args"]) if (Array.isArray(n[k])) n[k].forEach((c) => walk(c, d + 1));
})(ast, 0);
console.log(seen.slice(0, 70).join("\n"));
