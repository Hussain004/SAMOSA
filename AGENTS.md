# AGENTS.md

SAMOSA is a step auditor for matrix algebra, stochastics and algebra.
The full design lives in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## The three rules that never bend

1. **No AI in the verdict path.** A verdict comes from evaluating the
   expression on sampled instances, over a finite field or at 50 digits.
   Nothing is ever "judged" by a language model.
2. **Never a checkmark without a guarantee.** A verdict of `ok` must carry a
   filled `GuaranteeCard`: the sizes tested, the trials, the primes, the
   degree bound and the assumptions. This is enforced by a type guard and a
   test.
3. **Nothing leaves the browser.** The core, the CLI and the MCP server make
   no network calls. Share links live in the URL fragment.

## Repo invariants

1. `src/core/**` imports nothing from the DOM or from Node. It must run in a
   Web Worker, in the CLI and in the MCP server unchanged. ESLint enforces
   this with `no-restricted-imports` and `no-restricted-globals`.
2. No `Math.random` in the core. Only the seeded PRNG in `src/core/prng.ts`.
   The same input and seed always give the same verdicts.
3. Every heuristic interpretation emits a `Chip`. Nothing is guessed
   silently.
4. The golden suite and the Cookbook corpus run on every PR. A new false
   checkmark fails CI.
5. No network calls from the core, the CLI or the MCP server.

## Layout

| Path | What lives there |
|---|---|
| `src/core` | the engine: lexer, parser, types, sampling, evaluation, verdicts |
| `src/app` | the React checker |
| `src/landing` | the landing page and the ASCII samosa |
| `cli` | the `samosa` command line tool |
| `mcp` | the MCP server |
| `skill` | the Agent Skill |
| `corpus` | the golden derivations and the Cookbook identities |
| `docs` | the documentation that is rendered on the site |

## Working on this repo

- `pnpm test` runs the unit tests, `pnpm test:e2e` the browser tests.
- `pnpm lint` must be clean.
- `pnpm build` builds the site, `pnpm build:cli` the single file CLI.
- Keep the commit messages short and factual. No em dashes.
