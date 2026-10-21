# The CLI

```bash
npx samosa-math check paper.tex notes.md
cat derivation.tex | npx samosa-math check - --format json
```

The CLI lints the math of a document. It finds the math environments, reads
the rows, checks every row, and prints the verdicts.

## The options

| Option | Meaning |
| --- | --- |
| `--decls "<declarations>"` | the declarations, in the compact syntax |
| `--preset <id>` | one of the presets |
| `--format <pretty\|json\|sarif\|github>` | the output format |
| `--fail-on <wrong,shape>` | the verdicts that make the command fail |
| `--seed <number>` | the seed of the sampling, so the run is reproducible |
| `--trials <number>` | the trials per size, three by default |
| `--layout <denominator\|numerator>` | the layout convention for gradients |

The exit code is 0 when nothing is found, 1 when a verdict reaches
`--fail-on`, and 2 for a usage error.

## The formats

`pretty` is the human readable one, in the style of a linter:

```
paper/appendix.tex
  132:18  ✗ wrong    align@130 row 3  not equal: the RHS is missing + K Q Kᵀ  samosa/not-equal
  141:5   ⊘ shape    align@140 row 2  (n×n)(m×n): inner sizes n ≠ m  samosa/shape
✗ 1 wrong · ⊘ 1 shape · ? 1 unchecked · ✓ 41 · 38 ms
```

`json` is the report of the engine, the same one the web app and the MCP
server produce.

`sarif` is SARIF 2.1.0, for a code scanner.

`github` prints workflow commands, so a paper gets inline annotations in the
pull request without any plumbing:

```
::error file=paper/appendix.tex,line=132,col=18,title=SAMOSA ✗ wrong::not equal: the RHS is missing + K Q Kᵀ
```

## The declarations in a document

Three ways to write them, and they can be mixed:

```latex
% samosa: A: n×n; \Sigma: spd n; x: n
```

```latex
where $A \in \mathbb{R}^{n\times n}$ and $\Sigma \succ 0$
```

```bash
npx samosa-math check paper.tex --decls "A: n×n; \Sigma: spd n"
```

## In a pipeline

The GitHub Action runs the same CLI:

```yaml
- uses: Hussain004/SAMOSA@v1
  with:
    path: "paper/**/*.tex"
    fail-on: "wrong,shape"
```

## From Node

```ts
import { check } from 'samosa-math';

const report = check(source, { decls: 'A: n×n' });
for (const step of report.steps) {
  console.log(step.row, step.verdict, step.message);
}
```

The engine is the same one the web app uses, so the verdicts never disagree.
