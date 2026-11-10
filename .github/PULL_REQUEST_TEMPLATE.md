# Pull requests

The most valuable contribution is a trap: a false identity SAMOSA checks
as ok, or a true identity it flags.

## Bringing a trap

1. Open an issue with the `trap` label ("A false friend, caught in your
   practice"). The claim alone is enough to start.
2. Add it to `corpus/false-friends.ts`, in the same shape as the existing
   entries: the name, the LaTeX, the declarations, and nothing else.
3. Run `pnpm check:corpus`, `pnpm sweep` and `pnpm test`. A wrong verdict
   on a false checkmark fails CI, by design.
4. If the claim is one people meet in papers, say so in the PR description;
   the Cookbook measurement takes new entries as it grows.

## Adding an identity to the Cookbook

`corpus/cookbook/identities.ts` holds the identities SAMOSA is measured
against. Add the id, the name, the declarations and the row; the numbers
(`docs/COOKBOOK.md`, `README.md`) are regenerated with
`pnpm gen:readme` and CI fails on drift.

## The rules that never bend

- No AI in the verdict path. A verdict comes from evaluating the
  expression on sampled instances, over a finite field or at 50 digits.
- A checkmark carries a guarantee card. If your change cannot fill the
  card, it cannot ship as a check.
- Nothing leaves the browser, the CLI or the MCP server.
- `src/core` imports nothing from the DOM or from Node.

## Before you open the PR

- [ ] `pnpm lint` is clean
- [ ] `pnpm test` is green
- [ ] `pnpm check:corpus` shows zero false checkmarks
- [ ] `pnpm sweep` is clean at thirty seeds
- [ ] `pnpm gen:readme && git diff --exit-code` is clean, if you touched the corpus or the numbers
