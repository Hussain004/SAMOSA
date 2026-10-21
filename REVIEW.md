# SAMOSA: code review and the next round of work

A review of everything in `~/SAMOSA` against `IMPLEMENTATION_PLAN.md`: the engine, the app, the landing page, the CLI, MCP, the Action, tests, CI and docs. Every finding below was reproduced. The repro is written inline, so you don't need anything from the reviewer's machine.

Work top to bottom. **§3 (must fix) blocks launch.** §4–§5 are polish. §6 is the next round of features, once §3 is done.

---

## 1. Verdict: did he cook?

**Yes, mostly.** In one pass, this went from a plan to a working product covering the whole surface:
- the engine
- the app
- the landing page
- the CLI, MCP server and Skill
- the Action
- the docs
- the measured coverage number
- the launch video and GIFs

The code is clean and well commented. Lint, typecheck and the 57 tests pass. The build takes under 1 s. The look matches the approved prototype. That's a strong result.

**But it isn't launch-ready, for two reasons:**

1. **The marketing promises more than the engine delivers.**
   - The landing page and the typed demo both show the Joseph-form bug getting the fix `+ K_t Q_t K_tᵀ` and a counterexample with `n=2, m=1`.
   - The engine gives **no fix** for that bug, and its counterexample is **3×3 and not a valid instance**.
   - The plan's top rule is "the demo can never lie" (Principle 4, F21), and right now it does.
2. **Launch gates G1 and G2 were never measured.**
   - The plan defines *done* as G1–G7 passing.
   - The Cookbook corpus, the mutation tests, the property tests, the kernel oracle and the benchmarks don't exist yet.
   - So the "zero false ✗" and "≥ 95% of bugs caught" claims are unmeasured.

The verdict engine itself looks trustworthy: every golden row and every planted bug gets the right ✓ / ✗ / ⊘. The problems are in what surrounds the verdict: **counterexamples, fixes, share links, and the claims made about them**.

---

## 2. Launch gates (§6.3), as they stand

| Gate | Status | Evidence / what's missing |
|---|---|---|
| G1: zero false ✗ (golden + Cookbook) | **Not measured** | Golden + menu pass. There is no Cookbook corpus (`corpus/` holds only `menu.ts`). |
| G2: ≥ 95% planted bugs on the right row, **expected repair in top 3** | **Fails** | Only 4 bugs are tested, and only for verdict + row (`tests/bugs.test.ts`); repairs are never asserted. B2 and B4 get no fix at all (§3.2). There are no Cookbook mutants. |
| G3: parse coverage ≥ 70% | **Passes** (78.3%) | 39 papers, against the plan's ~1,000. Re-measure on a bigger sample before quoting it. Checkable coverage is 54.6%, and `docs/COVERAGE.md` is honest about it. |
| G4: p95 latency budgets | **Not measured** | No `*.bench.ts` files exist, even though `pnpm bench` is defined. |
| G5: share links on 100% of the Menu; Lighthouse a11y ≥ 95 | **Partial** | One e2e share test. No Lighthouse run. MCP share links are broken (§3.4). |
| G6: no derivation text in any request | **Weak** | `tests/e2e/app.spec.ts:46` only searches URLs for `J_t`/`Sigma`. It must also check request bodies, and fail on *any* non-same-origin request from `/app`. |
| G7: CLI = MCP = web | **Passes for verdicts** | `tests/parity.test.ts`. But counterexamples and fixes differ between surfaces (§3.3), so extend parity to them. |

---

## 3. Must fix before launch

### 3.1 The counterexample shrinker produces invalid counterexamples
`src/core/shrink.ts:61` samples **every** matrix symbol, including the ones defined with `:=`. Then `src/core/evaluate.ts:81` reads `env.values` *before* `env.defs`. So the defined symbols (`\Sigma_t`, `K_t`) are random values, not their definitions.

**Consequences:**
- The "counterexample" doesn't satisfy the derivation's own definitions. Even a *correct* Joseph form would "fail" on it.
- A user who pastes it into NumPy and computes K from its definition gets a different answer, and stops trusting the tool.
- Declared structure isn't respected either. The shown `Q_t = [[1,2,-2],[2,3,1],[-2,1,5]]` is declared SPD, but its leading 2×2 minor is −1, so it isn't positive definite.
- An internal dimension name `#1` leaks into the output's `dims`.

**Fix:**
- Exclude every name in `defs` from the sampled set, and compute those values from their definitions.
- Integer search: make SPD samples PD (e.g. `LLᵀ + I` with small integer L) and symmetric samples symmetric.
- Show the defined symbols as *derived* values (computed, clearly labeled), not as inputs.

**Repro:** in the app, Menu → Joseph form → spot the bug → click row 4 → scroll the inspector.

### 3.2 Counterexamples aren't shrunk to small sizes, and the flagship fixes are missing
`src/core/index.ts:153` fixes every dimension at **3** (`sizes.set(v, 3)`). The plan and the landing page promise *2×2*, `n=2, m=1`. The shrinker should try sizes in increasing order (1, 2, 3) and keep the smallest that still breaks the step.

`explain()` on the Appendix A bugs gives:

| Bug | Fixes returned | Expected (plan F9 / landing) |
|---|---|---|
| B1: `+Q_t^{-1}` | "an inverse where there should be none…", **listed twice** | that fix, once |
| B2: Joseph form missing noise | **none** | "off by exactly `+ K_t Q_t K_tᵀ`" (residual fingerprint, F9b). This is the landing page's headline fix card. |
| B3: missing transpose | #1 "holds if C_t is symmetric" (**impossible**: C_t is m×n), #2 "a transpose is missing" | the transpose fix first; never propose symmetric for a non-square matrix |
| B4: Q not symmetric | **none** | "declare Q symmetric" (F9c missing-assumption repair). The TL;DR names this as the core story. |
| `(AB)ᵀ = AᵀBᵀ` | "two factors are swapped" ✓ | ✓ |

**Fix:**
- Implement the single-term residual fingerprint: evaluate `lhs − rhs`, then test it against `± (products of in-scope symbols)` for a match.
- Make the F9c assumption repair fire on the gradient rows.
- Filter out repairs whose preconditions can't hold (symmetric needs square).
- Dedupe repairs by their resulting expression.
- Then add the assertion G2 requires: **the expected repair is in the top 3 for every planted bug**.

### 3.3 The CLI and MCP never return fixes or counterexamples
`check()` leaves `counterexample.numpy` empty (`""`) and has no fixes. Only the web app calls `explain()`. So:
- the MCP tool `check_derivation` advertises "the counterexamples, the fixes" (`mcp/server.ts:77`) but returns only "the two sides are not equal";
- the CLI's JSON output carries raw GF(p) residues (`1969121660, …`), which are useless to a human.

**This guts the agent story.** The demo shows the agent getting `missing + K_t Q_t K_tᵀ` and fixing row 12. A real agent gets nothing it can act on.

**Fix:**
- In CLI/MCP, run `explain()` for every ✗/⊘ row (with a cap and a time budget).
- Include `fixes` + the shrunk counterexample + NumPy.
- Drop the raw field residues from the JSON, or move them under a `debug` key.

### 3.4 MCP share links are broken
`mcp/server.ts:62` has two bugs:
- It builds `https://samosa-math.vercel.app/#v1.<base64 of plain JSON>`, which points at the **landing page**, and the landing page has no hash handler.
- The app's `decodeShare` (`src/app/store.ts:247`) expects **deflated** bytes, so the link would fail even at `/app`.

It also drops the declarations, so the shared derivation would be checked without them.

**Fix:**
- Move `encodeShare`/`decodeShare` into `src/core/share.ts` and use them from the app, the CLI and MCP.
- Point links at `/app/#v1.…`.
- Add the landing → `/app` redirect when a `#v1.` hash is present (old links).
- Add a test: a link from MCP opens in the app with identical verdicts.

### 3.5 The demo and the mock cards are hand-written, not generated
`src/landing/demo-scripts.ts` and the feature-grid mocks (`src/landing/App.tsx`, "Six things") are literal strings. F21 requires generating them **at build time by running the engine on the menu bug**, plus a test that fails the build if they disagree.

Today they disagree:
- The fix card claims a fix the engine doesn't produce (§3.2).
- The counterexample card shows `C = [[1, 0]]` 2×1 values the engine never produced.
- The card is labeled "row 12" while showing the row 11 formula.

**Fix:** add `scripts/gen-demo.ts`, which runs `check` + `explain` on the menu bugs and writes `src/landing/generated.json`. Render the demo lines and the six mocks from it. Add a vitest test that regenerates the file and diffs it.

### 3.6 The GitHub Action is broken in two ways
- **Recursive globs don't work.** `action.yml` passes `${{ inputs.path }}` unquoted into bash. Without `shopt -s globstar`, `**/*.tex` doesn't recurse, and if nothing matches, the literal string reaches the CLI, which has no glob expansion (`cli/bin.ts`). Expand globs in the CLI (`fs.glob` on Node ≥ 22, or a tiny walker) and quote the input.
- **SARIF upload can't work.** With `format: sarif`, the upload step expects `samosa.sarif`, but the CLI prints to stdout. Also, when the check fails, the upload step is skipped. Fix: add `> samosa.sarif` (or an `--output` flag), and run the upload under `if: always() && …`.
- Add an end-to-end workflow that runs the Action on `corpus/` fixtures.

### 3.7 The landing page bundle is over budget, and the budget check doesn't count everything
`scripts/check-bundle-budget.mjs` only counts `<script src>`. It ignores `<link rel="modulepreload">`.

What the landing page really loads:

| Chunk | gzip |
|---|---|
| `landing` | 10 KB |
| `styles-*.js` | 72 KB |
| katex | 78 KB |
| decimal.js | 13 KB |
| **total** | **≈ 172 KB**, against the 120 KB budget |

**Root causes:**
- `src/landing/App.tsx:6` imports `PRESETS` from `../core/index.ts`, which drags the engine (and decimal.js) into the landing page. It's only used for the misplaced preset chips (§4.1).
- KaTeX is loaded eagerly for the marquee and menu cards. The plan says to lazy-load it, or better, to prerender the KaTeX HTML at build time (it's static).

**Fix both, then make the budget script follow the modulepreloads** (or read Vite's `manifest.json`).

### 3.8 The missing test layers (they're what makes G1/G2 measurable)
Plan §6.1/§6.2, none of which exist yet:
- **Cookbook corpus.** Transcribe ~300 identities into `corpus/cookbook/`, with mutants generated automatically. `package.json` already points `check:corpus` at `scripts/check-corpus.mjs`, **which doesn't exist**.
- **Metamorphic property tests with fast-check.** It's installed and never imported. Generate random typed expressions, apply a true rewrite → ✓, and apply a mistake mutation → ✗ (unless the exact oracle says the mutant is still equal).
- **Kernel oracle.** `GFp` ops must match a BigInt-rational oracle reduced mod p. Also test the 16-bit-limb modmul at the edges (p−1, 2³⁰, …).
- **Parser.** Golden IR snapshots (~300) + an IR→LaTeX→IR round-trip, plus fuzzing that never throws and always carries a span. `tests/parse.test.ts` has 6 tests.
- **ASCII samosa frame-0 snapshot** (F20).
- **Bench.** `*.bench.ts` per mode, with a > 20% regression failing CI.
- **E2E.** Cover these:
  - a quick-fix applies (there's no such test yet)
  - mobile viewport
  - keyboard-only flow
  - every Menu item's share link round-trips (G5)
  - a stronger no-leak test (G6, see §2)

### 3.9 Repo hygiene
- **Uncommitted changes:** `src/core/steps.ts` and `src/core/verdict.ts` (sensible fixes), plus a rebuilt `pkg/dist/*`. Commit them.
- **Stale built CLI risk.** `pkg/dist/*.mjs` is checked in (the Action needs it), so it can go stale. Add a CI step: `pnpm build:pkg && git diff --exit-code pkg/dist`.
- **CI's Node version.** CI uses Node 20, and `engines` says `>=20`. The Vite 8 / Vitest 5 toolchain wants ≥ 20.19. Pin CI to Node 22 LTS and say so in `engines`.
- **`AGENTS.md` is gitignored.** The plan wanted it public (§4.7), since contributors use agents too. Your call.

---

## 4. UI: landing page

Measured at 1440×900 and at 390×844 (iPhone width).

### 4.1 Bugs
1. **The page scrolls sideways on mobile.** `scrollWidth` is 500 px on a 390 px screen.
   - The header nav doesn't collapse: "How it works" wraps onto 3 lines, and **Open app** is cut off.
   - Below 860 px, keep only the logo + ★ + Open app (as the prototype did: `nav a:not(.open){display:none}`).
2. **The samosa is in the wrong place on mobile.** The spec says it sits **above** the headline at 60% size, but it's below the CTAs.
3. **The hero video won't autoplay.** `<video autoplay loop playsinline>` (`App.tsx:238`) has no `muted`, so Chrome and Safari block it and show a poster. Add `muted` and `preload="none"`, and start it with an IntersectionObserver. It's 1 MB downloaded eagerly.
4. **Section counts are wrong.**
   - "Five ideas, no magic" (`App.tsx:519`) lists **six** items.
   - "Fifteen derivations to try" (`App.tsx:555`) lists **sixteen**.
   - Derive both counts from the arrays.
5. **The Install section is incomplete.**
   - It contains the three preset chips (Kalman (Thrun) / Kalman (H,P,R) / Linear regression), which belong to the app (`App.tsx:648`). Remove them; this also fixes most of §3.7.
   - The **Skill** tab is missing.
   - The Web tab's text starts with a stray `$ `.
   - Each tab needs a real copyable snippet (Claude Code `claude mcp add …`, Codex TOML, Cursor JSON, Action YAML) with a ✓ flash on copy.
6. **"read more →" links download raw Markdown.** They point to `/docs/*.md` (served as `text/markdown`). The plan says to render the docs at build time in the site's theme, with anchors (`/docs/how-it-works#exact`). A small Vite plugin with `marked` + KaTeX, or a `docs.html` page that renders the Markdown, is enough.
7. **The ★ count shows "GitHub 1".** A tiny star count is anti-social-proof at launch. Hide the number below ~50.
8. **There's no `og:image` or Twitter card.** HN, Reddit and X links will unfurl blank. Make the 1280×640 social image (an F20 frame + the headline) and add `og:image`, `twitter:card=summary_large_image` and `og:url`.
9. **The hero is blank until JS runs.** `#root` is empty, so there's no hero before the JS loads and CLS is likely. Do the F20 build-time pre-rendered frame: prerender at least the header + hero HTML with the ASCII frame inlined.

### 4.2 Gaps against the spec (F19–F21)

**Typed demo:**
- no **↻ replay / skip ⏭** controls
- no pause on hover/focus
- no screen-reader transcript (visually hidden `<ol>`)
- no ✗ glow pulse
- no `~` scanline toggle
- Codex/CLI/CI tabs don't have their own styling (the CI tab should show a PR annotation on a diff line)
- the status bar says "12/12 … exact", but row 3 used dual numbers

**Feature grid:**
- the mocks are raw LaTeX source in `<pre>` instead of KaTeX
- the Fixes diff overflows its card at 1440 px
- no 2° pointer tilt
- regenerate the mocks from the engine (§3.5)

**samosa-servations:** the spec calls for 16×16 pixel-art samosa sprites (crispy / soggy / burnt / raw = verdict states) with cycling speech bubbles. It currently uses emoji (🥟🥠🔥🫓), including a fortune cookie. This is the most "memorable" bit of the page, so it's worth doing properly.

**Hall of Bugs:**
- Only 4 bugs, repeated. Use the ~12 from Appendix B, each with the red underline on the wrong part.
- Mark the duplicated track `aria-hidden` (screen readers currently read every bug twice).
- Add pause on hover.

**Deep-dives:**
- The right half of every block is empty. The spec wants alternating left/right layouts with a visual each:
  - an animated bound counter (01)
  - a 4×4 → 2×2 shrink animation (03)
  - an MCP transcript (04)
  - a PR annotation mock (05)
- The current "staggered indent" reads as a layout bug.

**Menu cards:** add the `12 rows · 1 bug` meta line.

**Section reveals:** add the fade + 8 px rise once, via IntersectionObserver.

**Header:** add the **Docs** and **Changelog** nav links.

**Footer:** add the tiny ASCII samosa next to the copyright.

**ASCII samosa:**
- the `✦` sparkles
- the `∇` steam wisp
- +10% brightness on hover
- measure the cell aspect from the font
- shrink the grid by 15% when frames are slow
- It renders noticeably smaller than in the prototype. Match the prototype's size (80×38 filling the right column).

---

## 5. UI: the checker app

### 5.1 Bugs
1. **A stray scrollbar shows up on tall rows.** `src/app/RenderedRows.tsx:118`: a math row with `\partial^2` overflows by 1 px vertically, so `overflow-x-auto` draws a scroll spinner next to the badge (row 3 of the default derivation). Fix: add `overflow-y-hidden` and a few px of vertical padding.
2. **The ✗ card shows meaningless guarantee fields.** It shows "degree bound 0", "false checkmark ≤ 0" and an empty "sizes tested" (`Inspector.tsx:65`). For ✗, hide those fields and lead with what matters:
   - the counterexample (as a KaTeX matrix, not ASCII brackets)
   - lhs/rhs/diff, with the nonzero diff cells glowing
   - the fixes, each with **Apply**
   - Copy as NumPy
3. **Duplicate assumption.** "I is the identity matrix" and "I is the identity" both appear (`src/core/types.ts:379` + another site). Dedupe.
4. **Raw LaTeX in the card.** The "checked assuming" list shows `\bar\Sigma_t`. Render symbol names with KaTeX.
5. **Mobile app is unusable.** The header buttons overflow (`scrollWidth` 568 / 390), the status bar wraps into a 3-line mess, and three stacked panes leave about 200 px each. For mobile, show **rendered rows + badges only**, with the source behind a tab and the inspector as a bottom sheet.
6. **Runaway checks freeze the app.** A pathological input can hang the worker forever: the 500 ms `budgetMs` is checked cooperatively. The store should `terminate()` and respawn the worker if a request runs longer than about 3 s, then show "? not checked — timed out".

### 5.2 Polish
1. **Pane titles.** Use the box-drawing pane-title style from F22 (`┌ SOURCE ─┐` via CSS borders). The current titles are plain small caps.
2. **Two-way link between source and rendered rows.** Clicking a rendered row should highlight and scroll to its source line, and vice versa. The gutter markers are **purple**, which isn't in the palette: use chutney / tamarind / saffron / slate by verdict.
3. **Number rows by source line.** Rendered rows are numbered 1–8 while the source lines are 3–10, so the user has to translate. Show the source line number.
4. **Spot-the-bug needs a game loop:**
   - "✓ you found it", or "✗ that row holds, try again"
   - a streak counter
   - "next bug →"
   - hide the badges until a guess
   - a share card ("I found the Joseph-form bug in 1 try 🥟")
5. **Menu in the app:**
   - no KaTeX thumbnails
   - "The KL of two Gaussians" has no spot-the-bug
   - use the same cards as the landing page
6. **Empty inspector.** "Pick a row to see its card" wastes a third of the screen. Make the inspector collapsible, or show a report summary there (counts, the first ✗ row, the seed, "re-roll").
7. **✓ badges.** Add the 6 px glow from F22.
8. **Light ("paper") theme** for the app and docs (F22).

---

## 6. Next upgrades (after §3 is done)

Ranked by what real users will hit first. The parser items come from the measured failure buckets in `docs/COVERAGE.md`.

### 6.1 Read more real papers (coverage 54.6% → 70%+ checkable)
1. **`\|` as the KL / divergence separator** (168 failing rows): `D(P\|Q)`, `\mathrm{KL}(p\|q)`. Treat it as an opaque binary function of distributions when it sits inside `D(…)`/`KL(…)`.
2. **Single-argument angle brackets** `\langle x\rangle` (101 rows): expectation or average notation; map it to 𝔼.
3. **`\mid` and `\middle|`** (59 rows): conditioning, as in `p(x \mid y)` and `\mathbb{E}[x \mid y]`.
4. **Unsquared norms** `\|x\|` (26 rows): check them numerically in 50-digit mode (∥x∥ = √(xᵀx)), with the guarantee card saying "numeric".
5. **Relations inside expressions** `\le`, `\leq` (21 rows): ship the §1 "Later" counterexample search for `≤ < ⪯`, i.e. look for an instance that violates it.
6. **Paper macros** (`\norm`, …): read the user's preamble `\newcommand`s automatically in the CLI. The parser already supports them.
7. Then re-run coverage on **~1,000 papers** (the plan's sample size) and publish the new number.

### 6.2 Make ✗ actionable everywhere
- **Rule naming:** "this step is Woodbury" / "push-through" / "cyclic trace". Match a ✓ step against the Cookbook corpus (§3.8). This also makes the guarantee card friendlier.
- **Multi-term residual fits:** extend the single-term fingerprint to sums of 2–3 terms (a small linear solve over GF(p)).
- **A PNG report card.** Share an image of the ✗ step + counterexample + fix. It's great for X and Reddit.

### 6.3 Meet people where they write
- **VS Code extension / LSP.** It runs the same core and shows verdicts as diagnostics in `.tex`/`.md` files. This is the most-requested shape for linters.
- **Overleaf** browser extension: a badge per `align` row.
- **Jupyter** `%%samosa` cell magic, plus a Python wrapper (`pip install samosa-math` shelling out to the npm CLI) for ML researchers.
- **Drop a whole `.tex` file into the browser:** reuse `cli/extract.ts`, with no upload.
- **Embed iframe** for course pages and blog posts.

### 6.4 More math
- Monte Carlo 𝔼 for non-polynomial integrands, with confidence intervals on the card.
- Distributional claims: `Ax + b ∼ 𝒩(Aμ+b, AΣAᵀ)` by matching the first two moments exactly.
- Einstein summation / index notation, then complex numbers (ᴴ, conj).
- General `⇒` via Newton (non-affine implications).
- `≈` with a stated tolerance.

### 6.5 Community and growth
- **SAMOSA-Bench:** ~100 derivation prompts × 3 LLMs, with human step labels and SAMOSA's precision/recall reported. A strong follow-up post after launch (plan §6.2).
- **"Paper of the week":** run the CLI over new arXiv cs.LG papers and post the real bugs found, after emailing the authors first and with their permission.
- **Course packs:** Menu packs for DL4STG backprop, mobile robotics (EKF, the Riccati recursion) and TA solution keys. Practice mode with drills.
- **Opt-in, bring-your-own-key LLM narration** of an already-computed verdict, clearly labeled and never in the verdict path.

---

## 7. Order of work

1. **§3.1–3.4** (counterexample validity, sizes, fixes, CLI/MCP explain, share codec). These are the core trust issues.
2. **§3.5** (generated demo + test), so the landing page can't drift again.
3. **§3.8** (Cookbook + mutants + fast-check + oracle + bench), then **measure G1, G2, G4**, and write README caveats for anything that misses.
4. **§3.6, §3.7, §3.9** (Action, bundle, hygiene).
5. **§4.1 and §5.1** (UI bugs), especially mobile overflow, `og:image`, the video and the pre-rendered hero.
6. **§4.2 and §5.2** (spec gaps and polish), with the Spot-the-bug game loop and the pixel samosas first, since they're the most shareable.
7. Re-run all gates, tag `v1.0.0`, launch (plan §8). Then **§6**, driven by what launch users ask for.
