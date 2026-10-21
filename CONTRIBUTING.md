# Contributing to SAMOSA

Thank you for wanting to help. The most valuable contribution is a
derivation that SAMOSA gets wrong.

## The three kinds of bug

| Kind | What it means | How to report it |
| --- | --- | --- |
| **A notation SAMOSA cannot read** | The row comes back as `?` or as a parse error, but you think it should be readable. | Open an issue with the LaTeX and the declarations. |
| **A wrong step SAMOSA misses** | The row comes back as a checkmark, but the step is wrong. | Open an issue with the derivation, the declarations and the seed. This is the worst kind of bug, and the most valuable thing you can find. |
| **A false alarm** | The row comes back as `wrong`, but the step is right. | Open an issue with the derivation, the declarations and the seed. |

## How to reproduce

The seed is in every report, and the same seed always gives the same
verdict, so a report is a complete reproduction:

```bash
npx samosa-math check derivation.tex --decls "A: n×n" --seed 5910618
```

## Working on the engine

The engine is in `src/core` and it is pure TypeScript: it may not import
the DOM or Node, and it may not use `Math.random`. That is what lets the
same code run in the browser worker, in the CLI and in the MCP server, and
why the three of them never disagree.

```bash
pnpm install
pnpm test
pnpm lint
```

The golden suite is the Menu: every derivation in `corpus/menu.ts`, with its
correct version and its planted bug. If you add an operator, a
distribution, a preset or a Menu item, add it to the suite too.

## The house style

* No em dashes, anywhere. Use a comma, a colon or parentheses.
* Comments explain why, not what.
* A verdict without a guarantee is a bug. Every checkmark needs its card.
