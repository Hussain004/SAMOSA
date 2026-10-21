# SAMOSA — Implementation Plan

```
   ∇   SAMOSA
       Step Auditor for Matrix Operations, Stochastics & Algebra
       "A ∇ is just a samosa with filling."
```

**Owner:** Hussain · **Status:** plan v1 · **Goal:** a polished v1.0 launched on Show HN
**Repo:** `Hussain004/SAMOSA` (free) · **npm:** `samosa-math` (free; `samosa` itself is taken) · **App:** `samosa-math.vercel.app`
**Evidence so far:** three spikes in `spikes/` (§G). The core idea already checks your own Lecture 8 derivation exactly.

**Contents**
Handoff notes · 0. TL;DR · 1. Scope cut line · 2. Product · 3. How checking works · 4. Architecture · 5. Feature specs (F1–F22, incl. website F19–F22) · 6. Quality & launch gates · 7. Build checklist · 8. Launch playbook · 9. Risks · 10. Open decisions · Appendices A–H

---

## Handoff notes (for the engineer)

The plan was written to Hussain, so "you" means him. You report to him.

- **Read in this order:** §0 → §1 (what ships) → §3 (how checking works) → §4–5 (architecture and feature specs) → §6.3 (launch gates) → §7 (checklist) → Appendix A (the first test case).
- **What counts as spec:**
  - §1, §3–6 and the appendices.
  - **Done = gates G1–G7 pass (§6.3)** and every §1 "ships at launch" item exists.
- **What counts as reference, to port and match visually:**
  - `prototypes/ascii-samosa/`: the approved hero and look (F19, F20, F22).
  - `spikes/`: proof the math works (Appendix G). These are probes, not production code. Rewrite them inside `src/core`.
- **Settle with Hussain before starting:** the open decisions in §10.
- **Designed in words only, so mock them up and get sign-off before building:**
  - landing sections 3–12 (F19)
  - the checker app layout (F10 + F22)
  - the typed agent demo (F21)

  Use the F22 tokens and the prototype as the visual anchor.
- **Standing rules:** the §2.4 principles and the §4.7 invariants (put them in `AGENTS.md`). The non-negotiables:
  - no AI in the verdict path
  - never ✓ without a guarantee card
  - nothing leaves the browser

---

## 0. TL;DR

- **What it is.** A linter for math derivations that runs in the browser. You paste or type a derivation: LaTeX, an Overleaf `align` block, or a ChatGPT answer in Markdown. Every step gets one of these:
  - **✓ holds**
  - **✗ wrong**, with a *2×2 counterexample* and a *"did you mean …"* fix
  - **⊘ shape error**
  - **? not checked**, with the reason
- **How it checks.** No symbolic algebra and no AI. SAMOSA samples random instances of your declared objects (shapes plus structure: symmetric, orthogonal, …) and evaluates both sides of every step.
  - Rational steps are evaluated *exactly over a finite field GF(p)*. The Schwartz–Zippel lemma then gives each ✓ a *computed* error bound.
  - Gradients use dual numbers.
  - Gaussian, uniform and discrete expectations of polynomials use a small *rational* quadrature rule, so they are exact too.
  - Everything else is evaluated in 50-digit arithmetic.
- **Where it runs.**
  - A static web app (Vercel, like BAGEL).
  - The npm package `samosa-math`, which provides:
    - a CLI (`npx samosa-math check paper.tex`)
    - a GitHub Action
    - an MCP server plus an Agent Skill, so Claude Code and Codex can check their own math.
- **It already works on real math.** `spikes/lecture8_probe.mjs` takes the Kalman measurement update from your handwritten Mobile Robotics Lecture 8 and checks it exactly over GF(2³¹−1).
  - Checked: the gradient and Hessian (via dual numbers), the zero-gradient (stationarity) step, both "after some algebraic manipulation" steps, and the Joseph form.
  - It rejects both planted bugs.
  - If Q is left unsymmetric, the gradient check fails. Declaring Q symmetric fixes it, and that is exactly what the missing-assumption repair (F9c) suggests.
- **What's hard to copy.** Evaluating at random points is an old idea: WeBWorK grades final answers this way. The product is everything around it:
  - a notation-tolerant parser
  - shape inference
  - chain semantics
  - computed guarantees
  - counterexample shrinking
  - deterministic fix search
  - agent integration
- **Plan.** No schedule: §7 is a checklist grouped by area, with only the real dependencies noted. Build in whatever order you like; launch when the §6.3 gates pass.

---

## 1. Scope cut line

Anything not in the left column waits until after launch, no matter how tempting it is.

| Area | Ships at launch (v1.0) | Later (post-launch, by demand) |
|---|---|---|
| Input | LaTeX source editor (CodeMirror); paste LaTeX/Markdown (`$$`, `\[`, `align`); Unicode math (ᵀ ⁻¹ ∑ ∇ ℝ) | MathLive visual input; drop a whole `.tex` file in the browser; handwriting OCR |
| Parsing | Own tokenizer + Pratt parser; declarations; `\newcommand` (incl. `#1`–`#9`), `\DeclareMathOperator`; presets | Einstein summation; complex numbers (ᴴ, conj); tensor index notation |
| Exact checks | GF(p) mode with computed bound; `:=` definitions; chains; affine `⇒`; stationarity | General `⇒` via Newton; rule naming ("this step is Woodbury") |
| Calculus | Gradients/Jacobians (duals), Hessians (hyper-duals), differentials, layout hints, symmetric-gradient caveat, abstract functions as random polynomials | Higher-order tensors, integrals with symbolic limits |
| Probability | Exact 𝔼/Var/Cov of polynomial integrands under Gaussian/uniform/discrete variables (rational quadrature); density identities and `∝` (numeric) | Monte Carlo for non-polynomial integrands; other distributions; distributional claims (`Ax+b ∼ 𝒩(…)`) |
| Other relations | `=`, `:=`, `⇒`, `⟺`, `∝` | `≤ < ⪯` counterexample search; `≈` with tolerance |
| Feedback | ✓ ✗ ⊘ ⚠ ? verdicts; guarantee card; shrunk counterexample; Copy as NumPy; lazy mutation fixes (capped); single-term residual fingerprint; missing-assumption repair; shape repair | Multi-term residual fits; LLM-narrated explanations (opt-in, BYOK) |
| UI | Landing page (F19) with ASCII samosa hero (F20) and typed agent demo (F21); terminal-style visual system (F22); split view (source + KaTeX), inspector, command palette, ~15-item Menu, Spot-the-bug, mobile reading | Practice/drill authoring; embed iframe; PNG report cards |
| Distribution | Share links (URL fragment); Markdown/LaTeX/JSON export; CLI; GitHub Action; MCP server; Agent Skill | VS Code (LSP); Overleaf extension; Jupyter `%%samosa` |

**Deliberately not building:**
- accounts, a backend or a database
- AI anywhere in the verdict path
- our own renderer (use KaTeX) or editor (use CodeMirror)
- a multi-package monorepo: one repo and one published package, like BAGEL's single package
- a plugin system, i18n, or a theming engine (Tailwind tokens are enough)

---

## 2. Product

### 2.1 Problem

Derivations in ML, robotics, controls and statistics are long chains of matrix algebra, calculus and expectations. Errors are silent and local:
- a transpose in the wrong order
- a dropped `+ KQKᵀ`
- a factor of 2 from treating a non-symmetric A as symmetric
- a gradient in the wrong layout

Today's options all fall short:
- **Re-derive it by hand.** Slow, and you often repeat the same mistake.
- **Ask an LLM.** It judges plausibility, can be confidently wrong, and gives different answers each time.
- **Use a CAS.** It is scalar-centric, has no shapes, and can't follow a 12-line chain with definitions.
- **Use a proof assistant.** It's correct but takes hours of formalization.

Your own Lecture 8 notes say: *"after some algebraic manipulation we may obtain … (flash full calculation on projector)"*. Nobody checks the step everyone skips.

### 2.2 Users and jobs (honest frequency)

| User | Job | Frequency |
|---|---|---|
| ML / robotics / controls / EE / econometrics students | Check problem-set and quiz-prep derivations | Weekly in semester; daily before exams |
| TAs and instructors | Verify solution keys; triage "is this student's step wrong?" | Weekly |
| Researchers | Appendix derivations; lint `.tex` in CI before submission | Bursty, per paper |
| LLM users | Paste a ChatGPT/Claude derivation and find the wrong line | Ad hoc, frequent |
| Coding agents | Check their own math before presenting it (MCP/Skill) | Continuous |
| **You** | Mobile Robotics (KF/EKF), DL4STG (backprop, graph convs), MAS (VCG algebra), micro-TA keys (`HW1_A_Solution.tex`), AgriJEPA appendix | Weekly |

### 2.3 Positioning against prior art

| Tool | What it does | What SAMOSA adds |
|---|---|---|
| STACK "reasoning by equivalence" (Moodle) | Line-by-line equivalence for school algebra: single-variable polynomials, simple inequalities; no logs/trig | Matrices with shapes and structure, gradients, expectations; standalone, no LMS; counterexamples and fixes |
| CheckMySteps (Georgia Tech prototype) | Flags algebra mistakes line by line | Same gap: it is algebra-only |
| WeBWorK MathObjects | Grades a *final answer* by evaluating at random test points (scalar) | Whole step chains; matrix structure; exact finite-field mode with bound |
| matrixcalculus.org (Laue et al., NeurIPS 2018) | *Computes* matrix derivatives | *Checks yours*, inside a chain, with layout diagnosis |
| WolframAlpha / SymPy | One scalar equality at a time; symbolic | Non-commutative matrix chains with declared structure; deterministic counterexamples; offline |
| Lean / Isabelle (Nitpick, Quickcheck) | Formal proofs; counterexample generators for conjectures | Zero formalization; pen-and-paper notation; seconds, not hours |
| LLM chat | Judges plausibility | Deterministic verdicts with reproducible evidence |

**"Isn't this five lines of NumPy?"** The evaluation part is. The product isn't, because almost all the code goes elsewhere:
- **Parsing your notation.** Turning `\hat{x}_{k|k-1}^\top \bar\Sigma_t^{-1}` from someone's notes into a correctly typed random instance needs:
  - a parser that tolerates real notation
  - declarations
  - shape inference
- **Following a chain.** A derivation is a *chain*. It has definitions, `⇒` steps, and "set the gradient to zero and solve" steps.
- **Making ✗ useful.** A useful ✗ is a 2×2 counterexample plus a fix, not just a float mismatch.
- **Earning ✓.** A ✓ should carry an actual probability bound.

That's where ~95% of the code goes.

### 2.4 Principles (these settle design arguments)

1. **Never silently wrong.** Anything unsupported gets `?` with a reason. Nothing is ✓ by default. Every heuristic interpretation is shown as an editable chip.
2. **Deterministic.** The same input and seed always give the same verdicts. No AI in the verdict path.
3. **Local-first.** No server and no accounts. Derivation text never leaves the device; share links live in the URL fragment.
4. **Evidence over assertion.** Every verdict has a reproducible card (mode, seed, dims, bound), and every ✗ has *Copy as NumPy*.
5. **Lazy core.** Use numbers, not rewriting. Reuse KaTeX, CodeMirror, decimal.js and fflate; write only the parser, type checker and kernels.

### 2.5 Non-goals

- Proving theorems or general inequalities.
- Quantifier logic.
- Limits and series convergence.
- ε-δ arguments.
- Grading or LMS integration.
- Real-time collaboration.

---

## 3. How checking works

### 3.1 The reduction

A step `L ⊳ R` (⊳ ∈ {=, :=, ⇒, ⟺, ∝}) is checked under declarations Γ by:
1. sampling instances of the objects Γ describes
2. evaluating both sides on each instance

For `=`, the step is valid iff L − R ≡ 0 as a function of the free parameters on the set Γ describes. No term rewriting and no simplification: non-commutativity, structure and shapes all come for free from evaluating actual matrices.

### 3.2 Mode planner

The planner picks the cheapest *sound* mode per step. A step is exact iff every node, including nodes inside any definition it references, is in the "rational" row.

| Construct in step | Mode |
|---|---|
| `+ − × ÷`, ⁻¹, ᵀ, tr, det, adj, ⊗, ⊙, diag, vec, integer powers, block matrices, ‖·‖², ⟨·,·⟩, finite sums with symbolic bounds, derivatives of all of these | **exact** (GF(p)) |
| 𝔼 / Var / Cov of a *polynomial* integrand under Gaussian, uniform or discrete variables | **exact** (rational quadrature, §3.6) |
| √, exp, log, log det, trig, abs, ‖·‖ (unsquared), max/min, σ(·), softmax, ReLU, eig/SVD/matrix functions, π, e, densities 𝒩(x; μ, Σ), `∝` | **numeric** (50 digits) |
| 𝔼 of non-polynomial integrands; non-supported distributions | `?` in v1 (later: Monte Carlo → `≈`) |
| `≤ < ⪯ ≈ O(·)` | `?` in v1 (later: counterexample search) |
| `\text{(by assumption)}`, prose justifications | shown, not checked |

### 3.3 Exact mode over GF(p)

**Arithmetic**
- Two primes: p₁ = 2³¹−1 = 2147483647 and p₂ = 2147483629. Both were verified prime.
- Elements are JS numbers. `modmul` splits one operand into 16-bit limbs, so every intermediate value stays below 2⁵³. That makes it exact in float64, with no BigInt in the hot path. It was validated against BigInt on 10⁵ random pairs (`spikes/gfp_probe.mjs`).
- Inverses use Fermat: a^(p−2).
- A zero divisor (singular matrix) triggers a resample. That happens with probability ≤ deg/p.
- Decimals and fractions are exact: `0.5` ↦ 2⁻¹ mod p, and `\frac{a}{b}` ↦ a·b⁻¹.

**Why "SPD" or "σ > 0" don't matter here.** Suppose a rational identity holds on an open set, such as the SPD cone inside the symmetric matrices. Then it holds on that set's Zariski closure, which here is all symmetric matrices. So exact mode only has to realize *algebraic* structure:

| Declared | GF(p) recipe (exact) | Real recipe (numeric) |
|---|---|---|
| general A ∈ ℝ^{r×c} | iid uniform entries | iid 𝒩(0,1); if square, reject κ > 10³ |
| symmetric / SPD / PSD | mirror the upper triangle; or Σ = LLᵀ when the step takes 𝔼 under 𝒩(·, Σ) | SPD: QΛQᵀ, Λ ∼ U[0.5, 2]; PSD rank-k: BBᵀ |
| rank-k | UVᵀ (U: r×k, V: c×k) | same |
| orthogonal | Cayley: (I−S)(I+S)⁻¹, S skew (QᵀQ = I exactly) | QR of a Gaussian with sign fix (Haar) |
| diagonal / triangular / skew | pattern-filled | same |
| idempotent rank-k / orthogonal projector | A(BA)⁻¹B / A(AᵀA)⁻¹Aᵀ | same |
| unit vector | stereographic: (2t, ‖t‖²−1)/(‖t‖²+1) | normalized Gaussian |
| row-stochastic / simplex | normalize rows (resample on zero sum) | positive entries, normalized |
| commutes with A | c₀I + c₁A + c₂A² | same |
| positive scalar | any nonzero | log-uniform [¼, 4] |
| abstract f: ℝⁿ→ℝ | random polynomial of degree k+2 (§3.5) | same |
| definition `K := …` | evaluate the definition | same |

**Dimension policy** (this catches identities that are true only at special sizes):
- Each dimension variable gets at least 2 distinct sizes across trials, and at least one of them is ≥ 3. So the 2×2-only Cayley–Hamilton identity A² − tr(A)A + det(A)I = 0 fails at n = 3.
- Unconstrained distinct dimension variables get distinct sizes *within* a trial (n ≠ m). This catches transposes that only "work" when everything is square.
- Size 1 is never sampled unless declared, because scalars commute and hide errors.
- **Default schedule.** Three size settings: (n, m) = (3, 2), (2, 3), (4, 3). Three or more variables cycle through {2, 3, 4, 5}.
  - At **each** setting, run k = 3 independent trials in each of the two primes. That's 18 evaluations in total, still microseconds.
- **What ✓ certifies.** ✓ certifies the identity *at the sizes tested*, and the card names them. Declared sizes are always respected.
  - An identity that held at sizes 2–4 but failed only at larger sizes would pass. None exist in the corpus, and the docs say so.

**Computed guarantee: degree bounds.**

The type checker carries a degree bound (dN, dD) for each node, whose entries are N/D over one common denominator. The degree is in the independent sampled parameters.

| Node | dN | dD |
|---|---|---|
| leaf parameter | 1 | 0 |
| recipe-built symbol (not a leaf!) | Its recipe's own degree: Σ = LLᵀ → 2; UVᵀ → 2; Cayley Q → n; stereographic unit vector → 2; idempotent A(BA)⁻¹B → composed by these rules | LLᵀ, UVᵀ → 0; Cayley → n; stereographic → 2 |
| abstract f (random polynomial of degree D) applied to (dN, dD) | D·max(dN, dD) | D·dD |
| constant | 0 | 0 |
| A + B | max(dN_A + dD_B, dN_B + dD_A); just max(dN_A, dN_B) if both dD = 0 | dD_A + dD_B |
| AB, A⊗B, A⊙B, c·A | dN_A + dN_B | dD_A + dD_B |
| Aᵀ, tr A, vec, diag, block assembly | unchanged (block assembly combines like +) | unchanged |
| det A (n×n) | n·dN | n·dD |
| A⁻¹ (n×n) | dD + (n−1)·dN | n·dN |
| a / b (scalars) | dN_a + dD_b | dD_a + dN_b |
| dual tangent part | dN + dD | 2·dD |
| quadrature 𝔼 (§3.6) | max over nodes (atoms are constants) | same |
| **step L = R** | **d = max(dN_L + dD_R, dN_R + dD_L)** | — |

- **The bound.** Suppose a step is false at a given size setting. Then the numerator of L − R is a nonzero polynomial of degree ≤ d, where d depends on the sizes.
  - So one trial falsely agrees with probability ≤ d/p (Schwartz–Zippel).
  - With k trials per prime at that setting: Pr[false ✓ at that setting] ≤ (d/p₁)^k·(d/p₂)^k.
  - The card reports the **worst** setting.
- **Resampling.** Resampling on singular denominators conditions the draw, which multiplies the per-trial bound by 1/(1 − d_D/p). That's negligible.
- **Caveat** (stated in `HOW_IT_WORKS.md`). The argument assumes the numerator's integer coefficients aren't all divisible by p. Using two primes means they would have to be divisible by both (≈ 4.6×10¹⁸).
- **Worked example, from your Lecture 8.** Take the line (CᵀQ⁻¹C + Σ̄⁻¹)⁻¹CᵀQ⁻¹ = Σ̄Cᵀ(CΣ̄Cᵀ + Q)⁻¹. `spikes/quadrature_check.py` applies the rules:
  - (n, m) = (3, 2): d = 25, so one trial errs with probability ≤ 1.2×10⁻⁸, and the 6 trials at this setting give ≤ 2.5×10⁻⁴⁸.
  - (2, 3): d = 23, giving ≤ 1.5×10⁻⁴⁸.
  - (4, 3): d = 43, giving ≤ 6.5×10⁻⁴⁷. This is the worst setting.
  - The card shows: `exact · sizes (3,2) (2,3) (4,3) · 6 trials each · 2 primes · d ≤ 43 · false-✓ ≤ 10⁻⁴⁶ per size`.
- **Cost.** At n ≤ 4, a 30-node step takes ~10³–10⁴ modmuls per trial: microseconds.

### 3.4 Numeric mode (transcendental steps)

- **Instances.** Drawn from the real recipes above, using a seeded PRNG (`sfc32`), so results are reproducible.
- **Adaptive precision.** Steps are evaluated first in float64.
  - If δ < 10⁻¹², re-evaluate one instance with decimal.js at 50 digits to confirm.
  - If δ > 10⁻⁶, treat it as a candidate ✗.
  - Otherwise, re-evaluate all instances at 50 digits.
- **Scale.** S = max(‖L‖∞, ‖R‖∞, largest |intermediate value|), tracked during evaluation so that cancellation is visible. Then δ = ‖L − R‖∞ / S.
- **Decision at 50 digits** (k = 3 instances):
  - If every δ < 10⁻³⁵: **✓ numeric**.
  - If any δ > 10⁻²⁰: run 3 fresh instances; if the discrepancy is confirmed: **✗**.
  - Otherwise: **⚠ inconclusive**, and the card shows κ.
- **What ✓ means here.** L − R is real-analytic on the sampled domain, and a nonzero analytic function vanishes only on a measure-zero set. So the card says `numeric · 3 instances · 50 digits · agreement ≤ 10⁻⁴⁰`, without a probability (there is no finite-field bound in this mode).
- **Domain failures.** log or √ of a negative number, or division by ≈0, triggers a resample. If more than half of the draws fail: `?` "needs x > 0? → [add `x > 0`]".
- **Non-smooth functions** (abs, max, ReLU) are piecewise analytic, and random points avoid the kinks almost surely.

### 3.5 Derivatives

- **Forward-mode AD.** Dual numbers work in every field (GF(p), decimal, float). Each node carries (value, tangent):
  - (AB)˙ = ȦB + AḂ
  - (A⁻¹)˙ = −A⁻¹ȦA⁻¹
  - (det A)˙ = det A · tr(A⁻¹Ȧ)
  - (log a)˙ = ȧ/a
  - (exp a)˙ = eᵃȧ
  - Second order uses hyper-duals (ε₁, ε₂, ε₁ε₂), which give wᵀ∇²f v.
- **Claims recognized:** `\frac{\partial f}{\partial x} = g`, `\nabla_x f = g`, `\frac{\partial f}{\partial X} = G`, `\frac{\partial^2 f}{\partial x\,\partial x^\top} = H`, Jacobians `\frac{\partial y}{\partial x}`, and the differential form `\mathrm{d}f = \operatorname{tr}(G^\top \mathrm{d}X)`.
- **The check.** Draw a random direction V shaped like X, then compare:
  - gradient: tangent of f(X + εV) vs ⟨G, V⟩ = tr(GᵀV)
  - Jacobian: Df[v] vs Jv
  - Hessian: hyper-dual mixed part vs wᵀHv
- **Layout diagnosis.** If the check fails but ⟨Gᵀ, V⟩ matches, the verdict is ✗ with "you wrote the numerator-layout gradient. SAMOSA uses denominator layout (the gradient has X's shape). [Use Gᵀ] / [switch layout]".
- **Symmetric X.** Directions V are sampled symmetric, so both G and ½(G + Gᵀ) pass. The inspector explains the two conventions (Matrix Cookbook vs "symmetric gradient") rather than picking a side.
- **Abstract functions** (f: ℝⁿ→ℝ, ∇f, chain-rule steps).
  - SAMOSA instantiates f as a random polynomial of degree k+2, where k is the highest derivative order in the step.
  - Polynomials of that degree realize every k-jet at a point. So a jet identity (chain rule, product rule) holds for all smooth f iff it holds for the random polynomial, with high probability by Schwartz–Zippel on the coefficients.
  - Chain-rule steps therefore stay in exact mode.
- **Stationarity.**
  - For "setting ∂J/∂x = 0 and solving gives x* = e", SAMOSA checks ∇J(e) = 0 via duals. This is exact if the step is rational.
  - Numeric mode additionally samples vᵀ∇²J(e)v and labels the result "consistent with a minimum".
- **Tangent-only exact mode.** For claims about ∂ log det X, the tangent tr(X⁻¹V) is rational even though log det isn't. So only the tangent channel is evaluated, and it is evaluated exactly.
- **Spike evidence.**
  - Lecture 8 gradient: checked via a dual-number evaluation of J.
  - Hessian: checked via the dual of the (already verified) gradient. The product will use hyper-duals of J directly.
  - Stationarity at μₜ.
  - All exact (§G).

### 3.6 Probability and expectations

- **Declarations:** `x \sim \mathcal{N}(\mu, \Sigma)`, `u \sim \mathcal{U}(a, b)`, `b \sim \mathrm{Bern}(\pi)`, `c \sim \mathrm{Cat}(\pi)`. 𝔼, Var, Cov, Cov(x, y) and `\mathbb{E}_{x\sim p}[\cdot]` are operators over the declared random variables.
- **Exact expectations via rational quadrature.** This is the main trick of this section. A distribution on rational atoms that matches the moments of 𝒩(0, 1) integrates polynomials *exactly*:
  - **5-point rule:** atoms 0, ±1, ±2 with weights ½, ⅙, ¹⁄₁₂. It matches E z² = 1 and E z⁴ = 3, so it is exact up to degree 5.
  - **7-point rule:** atoms 0, ±1, ±2, ±3 with weights ⁷⁄₁₈, ¼, ¹⁄₂₀, ¹⁄₁₈₀. It also matches E z⁶ = 15, so it is exact up to degree 7.
  - Both rules, plus the Simpson and Boole rules for uniform variables, are verified with exact fractions in `spikes/quadrature_check.py`. Each matches the target moments exactly up to its stated degree and fails at the next one.
  - Rules of any order come from a small exact rational Vandermonde solve. Weights may be negative at high order, which doesn't matter in GF(p).
- **Using the rules.**
  - Write x = μ + Lz, with Σ := LLᵀ sampled through L. Everything is then rational in (μ, L, …), so 𝔼 becomes a weighted sum computed *in GF(p)* with a Schwartz–Zippel bound.
  - The tensor product costs K^dim nodes. The budget is 10⁵ nodes (n ≤ 5 at K = 7). Over budget gives `?`.
  - Uniform variables use Newton–Cotes rules, which are rational: Simpson is exact to degree 3, Boole to degree 5.
  - Bernoulli and categorical variables are finite sums with rational weights.
  - Static degree analysis in the random variables picks K. If the integrand isn't polynomial in the random variable, the result is `?` in v1.
- **Densities** (𝒩, Bernoulli, categorical) are checked pointwise in log space in numeric mode. This covers Bayes' rule, products of Gaussians, conditioning and marginals.
- **Proportionality.** `p(x | ·) ∝ g(x)` is checked by testing that log L − log R is constant in x: evaluate at 3 values of x with everything else fixed. The variable is the one before `|`, or it is declared with `\propto_x`.
- **Examples that become exact:**
  - E[xᵀAx] = tr(AΣ) + μᵀAμ
  - E[xxᵀ] = Σ + μμᵀ
  - Cov(Ax + b) = AΣAᵀ
  - the ELBO's quadratic terms
  - The log-ratio of two Gaussians is quadratic, so its rule evaluation is exact. The log-det constants then push the KL formula into numeric mode.

### 3.7 Definitions, chains and implications

- **Definitions** come from:
  - `K := …` or `\coloneqq`
  - "let" / "where" forms
  - an equation whose LHS is a *fresh bare symbol* (shown with a "defined here" chip)

  Definitions are memoized per instance.
- **Chains.**
  - `a &= b \\ &= c`: each continuation row (empty LHS before `&=`) compares against the previous right-hand expression.
  - `a = b = c` on one line works the same way.
  - If the first and last expressions agree but a middle step fails, the report adds the note **"two errors cancel"**.
- **New statements** (a row with its own LHS):
  1. Try the row as an identity under the current definitions.
  2. Otherwise, try it as an implication from the previous statement.
  3. Otherwise: `?` "not an identity, and I couldn't derive it from the previous line".

  A ✗ is given only when SAMOSA has a counterexample.
- **Implications** (`\Rightarrow`, `\implies`, "so", "hence", or the fallback above) are handled by **constraint completion**:
  1. Pick a pivot symbol v in the premise E₁, preferring one that isn't isolated in the conclusion E₂.
  2. Test whether E₁'s residual r(v) is *affine* in v: its second directional derivative is 0 (a dual-number test).
  3. If it is affine, set v = v₀ − J⁻¹r(v₀), building J column by column from duals. This needs |r| = |v| and J invertible. The result is exact in GF(p).
  4. Every instance now satisfies E₁. Evaluate E₂. It holds on all trials → ✓; otherwise ✗, with the counterexample (it satisfies E₁ and violates E₂).

  `\iff` checks both directions. v1 covers the affine case: Ax = b ⇒ x = A⁻¹b, normal equations, and K(CΣ̄Cᵀ+Q) = Σ̄Cᵀ ⇒ K = …. Non-affine implications give `?`.
- **Stationarity** is the special case "∇J = 0 ⇒ x = e" (§3.5).

### 3.8 Verdicts and the guarantee card

| Badge | Name | Meaning | Card shows |
|---|---|---|---|
| ✓ | holds (exact) | rational identity, verified in GF(p) at each tested size | sizes tested, trials per size, primes, worst d, bound |
| ✓ | holds (numeric) | analytic identity agrees at 50 digits | instances, max δ |
| ✗ | wrong | counterexample found and confirmed | shrunk instance, L vs R, diff, fixes, Copy as NumPy |
| ⊘ | shape error | static dimension mismatch | the unification chain in words |
| ⚠ | inconclusive | ill-conditioning or timeout | κ, δ, budget |
| ? | not checked | unsupported, approximation or assumption | reason, plus how to make it checkable |
| ≈ | consistent | *(post-launch)* statistical | N, z |

Every card also lists **"checked assuming: …"**, i.e. every default or inferred assumption. Hiding an assumption can produce a false ✓, which is the worst failure, so they are always shown.
*Snack mode* (an Easter-egg toggle, off by default): Crispy ✓ · Soggy ✗ · Burnt ⊘ · Lukewarm ⚠ · Raw ?.

---

## 4. Architecture

### 4.1 Pipeline

```
 source (LaTeX · Markdown · Unicode)              declarations · preset · seed
            │                                                │
            ▼                                                ▼
 lex.ts ── tokens with {from,to}                  decl.ts ── symbol table, chips
            │                                                │
            ▼                                                │
 parse.ts ── IR (Pratt) ◄────────────────────────────────────┘
            │
            ▼
 steps.ts ── statements · relations · chains · definitions · ⇒
            │
            ▼
 types.ts ── shapes (union-find) · structural props · degree bounds · ⊘
            │
            ▼
 verdict.ts ── mode planner ─┬─ exact:      fields/gfp.ts (+dual, hyper-dual) × 2 primes
                             ├─ numeric:    fields/f64.ts → fields/dec.ts (+dual)
                             └─ quadrature: rational rules, over either field
            │
            ▼
 shrink.ts · repair.ts   (run lazily, when a ✗/⊘ card is opened)
            │
            ▼
 Report ─► Worker → React UI │ CLI (pretty · json · sarif · github) │ MCP │ Action
```

### 4.2 Repo layout

This is a single repo, like BAGEL: the root is the private web app, and `pkg/` builds the one published npm package.

```
SAMOSA/
├─ IMPLEMENTATION_PLAN.md   AGENTS.md   README.md   LICENSE (MIT)   CITATION.cff
├─ index.html  vite.config.ts  package.json  playwright.config.ts  eslint.config.js
├─ src/
│  ├─ core/                     # pure TS — runs in Worker, Node CLI, MCP
│  │  ├─ lex.ts  parse.ts  notation.ts  steps.ts  decl.ts  presets.ts
│  │  ├─ types.ts               # shapes, props, degree bounds
│  │  ├─ fields/{gfp,f64,dec,dual,hyperdual}.ts
│  │  ├─ linalg.ts  sample.ts  prng.ts  quadrature.ts  evaluate.ts
│  │  ├─ verdict.ts  shrink.ts  repair.ts  catalog.ts (mistakes + true identities)
│  │  └─ index.ts               # check(), checkStep(), parse(), repairs()
│  ├─ app/                      # React UI (editor, render, inspector, menu)
│  └─ worker.ts
├─ cli/   bin.ts  extract.ts (unified-latex)  format/{pretty,json,sarif,github}.ts
├─ mcp/   server.ts
├─ skill/samosa/SKILL.md
├─ pkg/   package.json (name: samosa-math, bins: samosa, samosa-mcp) → dist/ via scripts/build-pkg.mjs
├─ action.yml                   # composite → node $GITHUB_ACTION_PATH/pkg/dist/cli.mjs
├─ corpus/  cookbook/*.samosa  golden/*.tex  arxiv-sample/ (gitignored)  menu/*.tex
├─ bench/   engine.bench.ts  samosa-bench/ (optional, §6.2)
├─ spikes/  gfp_probe.mjs  lecture8_probe.mjs  parse_probe.mjs  quadrature_check.py
└─ docs/    HOW_IT_WORKS.md  NOTATION.md  CLI.md  MCP.md  PRIVACY.md
```

### 4.3 Stack

Versions were current on npm when this plan was written.

| Concern | Choice | Why |
|---|---|---|
| App shell | Vite + React 19 + TS + Tailwind 4 + zustand | Identical to BAGEL, so the configs can be copied |
| Editor | CodeMirror 6 + `@codemirror/lint` 6.9.7 | Squiggles, lint gutter and quick-fix actions come built in |
| Math rendering | KaTeX 0.19.0 | Fast. `\htmlClass` highlights need `trust` (restricted to our class names) and `strict` relaxed for `htmlExtension` |
| High precision | decimal.js 10.6.0 | exp/ln/sqrt/trig at 50 digits; MIT |
| Share links | fflate 0.8.3 | Already a BAGEL dependency |
| CLI document extraction | `@unified-latex/unified-latex-util-parse` 1.8.4 | Environments, comments, offsets on leaf tokens; **CLI only** |
| MCP | `@modelcontextprotocol/sdk` 1.32.1 | Official TS SDK, stdio transport |
| Tests | Vitest + fast-check 4.10.2 + Playwright | BAGEL's setup plus property-based testing |
| Bundling | esbuild | BAGEL's `build-cli.mjs` pattern: single-file `.mjs` for the Action and npm |

Fonts follow BAGEL: Space Grotesk for the UI and JetBrains Mono for source, via @fontsource. KaTeX ships its own fonts.

### 4.4 Core API

```ts
// src/core/index.ts — no DOM, no Node built-ins (lint-enforced)
export function check(src: string, opts?: CheckOptions): Report;
export function checkStep(lhs: string, rhs: string, opts: StepOptions): StepResult;
export function parse(src: string, opts?: ParseOptions): ParseResult;
export function repairs(report: Report, stepId: string, budgetMs = 150): Fix[]; // lazy

export interface CheckOptions {
  decls?: string;                 // LaTeX or compact syntax (Appendix C)
  preset?: PresetId;              // 'kalman-thrun' | 'kalman-hpr' | 'linreg' | 'logreg' | 'mlp' | 'attention' | 'gauss-cond' | 'lqr' | 'pca'
  seed?: number;                  // default 0x5A305A; per-step seeds = hash(seed, step, trial)
  trials?: number;                // default 3 per prime at each size setting (numeric: 1 per size)
  budgetMs?: number;              // per step: 50 exact, 300 numeric/quadrature
  layout?: 'denominator' | 'numerator';
}
export interface Report { version: string; seed: number; steps: StepResult[]; symbols: SymbolInfo[]; chips: Chip[]; diagnostics: Diagnostic[] }
export interface StepResult {
  id: string; row: number; span: Span; lhsSpan: Span; rhsSpan: Span;
  relation: '=' | ':=' | '=>' | '<=>' | 'propto' | 'le' | 'approx' | 'other';
  verdict: 'ok' | 'wrong' | 'shape' | 'inconclusive' | 'unchecked';
  mode?: 'exact' | 'numeric' | 'quadrature';
  card: GuaranteeCard; counterexample?: Counterexample; message: string; reason?: string;
}
export interface GuaranteeCard {
  trialsPerSize: number; sizes: Record<string, number>[]; primes?: [number, number];
  degree?: number; bound?: number; maxDelta?: number; assumptions: string[]; seed: number;
}
export interface Counterexample { dims: Record<string, number>; values: Record<string, Rational[][]>; lhs: Rational[][]; rhs: Rational[][]; numpy: string }
export interface Fix { kind: 'mutation' | 'residual' | 'assumption' | 'shape'; title: string; edit?: { span: Span; insert: string }; addDecl?: string; verified: boolean }
export type Span = { from: number; to: number };   // UTF-16 offsets into src
```

### 4.5 IR and types

```ts
type Node =
  | { k: 'sym'; name: string; display: string; span: Span }        // A, x̂_{k|k−1}, P⁻ (labels fold into names)
  | { k: 'num'; value: Rational; span: Span }                       // 0.5 is stored as 1/2
  | { k: 'op'; op: Op; args: Node[]; span: Span }                   // add sub neg mul div pow inv T tr det adj kron had inner norm2 vec diag block
  | { k: 'call'; fn: string; args: Node[]; span: Span }             // exp log sqrt sigmoid softmax relu, densities, user fns
  | { k: 'deriv'; f: Node; wrt: Node; order: 1 | 2; form: 'grad' | 'jac' | 'hess' | 'diff'; span: Span }
  | { k: 'expect'; op: 'E' | 'Var' | 'Cov'; body: Node[]; over: string[]; span: Span }
  | { k: 'sum' | 'prod'; idx: string; lo: Node; hi: Node; body: Node; span: Span };
type Dim  = number | { v: number };                                  // union-find id
type Ty   = { t: 'scalar' } | { t: 'mat'; r: Dim; c: Dim } | { t: 'fn'; dom: Ty[]; cod: Ty } | { t: 'rv'; of: Ty; dist: Dist };
type Prop = 'sym' | 'spd' | 'psd' | 'orth' | 'diag' | 'triu' | 'tril' | 'skew' | 'idem' | 'proj' | 'unit' | 'stoch' | 'pos' | 'int'
          | { rank: Dim } | { commutes: string };
```

### 4.6 Execution model

- **Web.**
  - One module Worker hosts the engine.
  - The main thread sends `{gen, src, decls, preset, seed, settings}`. The Worker streams `{gen, stepId, result}` back in row order, and results with a stale `gen` are dropped.
  - Quadrature loops yield every ~10 ms, so later rows keep streaming.
- **Cache.**
  - Results are cached in a `Map` keyed by `hash(step IR + referenced definitions + decl env + seed + engine version)`.
  - Editing a row re-checks that row plus any rows that depend on definitions it changes.
- **CLI.** Same core on `worker_threads` (pool size = cores − 1), with an on-disk `.samosa-cache/`.

### 4.7 Repo invariants (`AGENTS.md`, since you build with coding agents)

1. `src/core/**` imports nothing from the DOM or Node. Enforced by ESLint `no-restricted-imports` / `no-restricted-globals`.
2. No `Math.random` in core. Only the seeded PRNG is allowed (lint rule).
3. A verdict of `ok` requires a filled `GuaranteeCard` (`trialsPerSize > 0`, `sizes` non-empty, `assumptions` present). Enforce it with a type guard plus a test.
4. Every heuristic interpretation emits a `Chip` (snapshot-tested).
5. The golden suite and the Cookbook corpus run on every PR, and any new false ✗ fails CI.
6. No network calls from core, CLI or MCP.

---

## 5. Feature specs

Each feature lists what it does, how to build it, the edge cases, and when it's done.

### F1 — Input and step splitting

- **What it accepts:**
  - LaTeX rows: `align`, `align*`, `aligned`, `gather`, `split`, `equation`, `eqnarray`, raw lines
  - Markdown: `$$…$$`, `\[…\]`, `\(…\)`, `$…$`, ```` ```math ```` fences
  - Unicode math
- **How.**
  - A cheap scanner (not full LaTeX) finds math regions in Markdown and turns them into LaTeX rows. The editor then shows those rows, so spans stay consistent.
  - Inside math:
    1. Split rows on `\\` at brace depth 0, outside matrix environments.
    2. Strip `&`, `\nonumber`, `\notag`, `\label{…}`, `\tag{…}`, and trailing `,` or `.`.
    3. Find relation tokens at depth 0.
    4. Keep `\text{…}` and `\quad\text{(…)}` tails as annotations.
  - Prose between equations is kept as context. It is also scanned for "where/with/let … ∈ …" declarations (F3).
- **Edge cases:**
  - `\\` inside `bmatrix`
  - `\left.\right|_{x=a}` evaluation bars, read as `?` in v1
  - `= &` vs `&=`
  - relations inside `\text`
  - several relations on one row
- **Done when:** 200 real `align` blocks from the corpus split identically to a hand-labeled answer key.

### F2 — Tokenizer and Pratt parser

- **Why our own.** The probe (§G) showed that unified-latex merges `k|k` into one string token and doesn't attach `\hat`'s argument. Squiggles and fixes need exact sub-expression spans. Budget: ~200 LOC tokenizer + ~800 LOC parser.
- **Tokenizer.** It produces:
  - control words and control symbols
  - `{}`, `^ _ & \\`
  - single characters, and numbers including decimals

  Every token carries `{from, to}`.
  - Unicode maps to its LaTeX equivalent: ᵀ→`^\top`, ⁻¹→`^{-1}`, ∑→`\sum`, ∇→`\nabla`, ℝ→`\mathbb{R}`, ≤→`\le`, ·→`\cdot`, ×→`\times`, ⊗→`\otimes`, ⊙→`\odot`, ‖→`\|`, ⟨⟩→`\langle\rangle`, √→`\sqrt`, ∂→`\partial`, 𝔼→`\mathbb{E}`.
  - These are dropped: `\, \; \quad \! \displaystyle \left. \right.`
- **Symbol identity.** One name = base letter + accents (`\hat \bar \tilde \check \dot \ddot \vec \mathbf \boldsymbol \mathcal \mathrm`) + subscript + label superscripts + primes. So `\hat{x}_{k|k-1}` is one symbol, displayed as x̂_{k|k−1}. `\Sigma_t` and `\bar\Sigma_t` are different symbols.
- **Superscripts:**

| Written | Read as |
|---|---|
| `^\top`, `^T`, `^{\mathsf T}`, `^\intercal` | transpose |
| `'` on a matrix/vector (`X'X`) | transpose (econometrics convention; shown as a chip); on a declared function: derivative; on a scalar: part of the name |
| `^{-1}` / `^{-\top}`, `^{-T}` | inverse / inverse-transpose |
| `^{k}` with integer k | power (matrix power if square) |
| `^{1/2}`, `^{\frac12}` | principal square root (SPD only, numeric) |
| `^\dagger` | pseudo-inverse (numeric) |
| `^+`, `^-`, `^*`, `^{(k)}`, `^{\text{…}}` | **label, folded into the name** (P⁺ posterior, x* optimum). Per-symbol override: "^+ means pseudo-inverse" |
| `^2` on a vector | ⊘ with hint: xᵀx? ‖x‖²? x⊙x? **Exception:** inside a `\partial` denominator, `\partial x^2` means the 2nd derivative w.r.t. x (the Hessian, for a vector x) |

- **Subscripts:**

| Written | Read as |
|---|---|
| `x_k`, `x_{k\|k-1}`, `\Sigma_t` | part of the name |
| `\nabla_x`, `\partial_x` | differentiate w.r.t. x |
| `\sum_{i=1}^{n}`, `\prod_{…}` | bounds |
| `\mathbb{E}_{x\sim p}` | expectation over x |
| `\|A\|_F`, `_2`, `_1` | norm type |
| `A_{ij}` | entry, *only if* i, j are bound by an enclosing sum or declared as indices |
| `I_n`, `\mathbf{1}_n`, `0_{m\times n}`, `e_i` | sized identity / ones / zeros / basis vector |

- **Precedence, high to low:**
  1. postfix: `^ _ ' !`
  2. prefix: unary −, `\nabla`, `\partial`, and 𝔼/Var/Cov when followed by a bracket
  3. juxtaposition and `\cdot \times \otimes \odot \oslash` (left-associative)
  4. `/`, which binds *looser* than juxtaposition: `a/bc` = a/(bc), shown with an ambiguity chip
  5. `+ −`
  6. relations

  `\frac`, `\sqrt`, `\left(…\right)` and `\{…\}` are atomic. Brackets right after 𝔼/Var/Cov or a function name are argument lists.
- **Application vs multiplication.** `f(x)` is a function application iff f is a known function or a declared one. Known functions are `\exp \log \ln \sin \cos \tanh \det`, `\mathrm{tr}`, and `\operatorname{…}`. Otherwise juxtaposition means multiplication.
  - An undeclared `\sigma(` gets the chip "σ(·): sigmoid, or σ × (…)?". ML presets default to sigmoid.
- **Bars:**
  - `|s|` on a scalar means abs.
  - `|A|` on a square matrix means det (statistics convention, shown as a chip).
  - On a vector, it's ⊘ with a hint.
  - `\|x\|` is the vector 2-norm. `\|A\|` gets a chip asking spectral vs Frobenius (default spectral, numeric).
  - `\|A\|_F^2` is exact, read as tr(AᵀA).
- **Matrices.**
  - `bmatrix`, `pmatrix`, `vmatrix` (read as det), `Bmatrix` and `matrix`, with scalar or block entries.
  - `\vdots \cdots \ddots` are allowed only in declarations, as patterns (F4), not in checked steps.
- **Macros.**
  - `\newcommand{\R}{\mathbb{R}}` and `\newcommand{\norm}[1]{\left\|#1\right\|}` are expanded before tokenizing: plain substitution, depth ≤ 10, budget ≤ 10⁵ tokens.
  - `\DeclareMathOperator{\Tr}{Tr}` registers an operator.
- **Errors.**
  - An unknown command makes the step `?` with "unknown command `\foo`. Define it with `\newcommand` or declare it."
  - A parse error underlines the exact token and says what was expected.
  - Every heuristic choice appears as a chip. Nothing is guessed silently.
- **Done when:**
  - IR → LaTeX → IR round-trips for every accepted corpus row.
  - ≥ 70% of display-math rows in the arXiv sample parse (gate G3).

### F3 — Declarations, presets and type/shape inference

- **Sources, in precedence order:**
  1. the editor's declaration block
  2. inline prose ("where A ∈ ℝ^{n×n}")
  3. the active preset
  4. heuristics
- **Syntax is the LaTeX people already write:**
  - `A, B \in \mathbb{R}^{n\times n}`, `x \in \mathbb{R}^n`
  - `\Sigma \succ 0` / `\succeq 0` / `\in \mathbb{S}^n_{++}`
  - `Q^\top Q = I` (→ orthogonal), `A = A^\top` (→ symmetric), `P^2 = P`, `\operatorname{rank}(A) = k`
  - `x \sim \mathcal{N}(\mu, \Sigma)`, `f: \mathbb{R}^n \to \mathbb{R}`, `\sigma > 0`, `K := …`
  - The compact form for the CLI/MCP is in Appendix C.
- **Presets** (one click, editable):
  - Kalman (Thrun: A, B, C, Σ̄, Q = measurement noise, R = process noise)
  - Kalman (F/H/P/R convention)
  - linear regression
  - logistic regression
  - MLP backprop
  - attention
  - Gaussian conditioning
  - LQR
  - PCA
- **Heuristics for undeclared symbols.** Each one becomes an editable chip.
  - Capital Latin or Greek letter → matrix with fresh dims. Σ and Λ → symmetric.
  - Bold, `\vec`, or a lowercase symbol used as a matrix operand → vector.
  - Any other lowercase symbol → scalar.
  - `I`, `0` and `\mathbf{1}` are polymorphic.
  - `e` → Euler's number unless subscripted.
  - `i, j, k` inside sums → indices.
  - `n, m, d, N, T` used as sizes → dimension variables.
- **Inference.** A single pass assigns every node a type, unifying dimensions with union-find:

| Op | Constraint | Result |
|---|---|---|
| A ± B | same shape (1×1 acts as scalar) | same |
| AB | c_A = r_B | r_A × c_B |
| Aᵀ | — | c_A × r_A |
| A⁻¹, det A, tr A, Aᵏ | square | det, tr: scalar |
| A ⊗ B | — | (r_A·r_B) × (c_A·c_B) |
| A ⊙ B, ⟨A, B⟩ | same shape | same / scalar |
| ∂f/∂X (f scalar) | — | shape of X (denominator layout) |
| ∂y/∂x (y ∈ ℝᵐ, x ∈ ℝⁿ) | — | m × n (Jacobian) |
| 𝔼[·], Var[x], Cov[x, y] | — | shape of body / n×n / n×m |

- **Shape errors in words.** A mismatch becomes ⊘ with an explanation like: "C_t is m×n (declared); Σ̄_t C_t is (n×n)(m×n), and the inner sizes n ≠ m". Then F9d tries inserting or removing a ᵀ.
- **Structural properties are inferred too** (AᵀA and BΣBᵀ are symmetric, Σ + R is SPD, …). They drive gradient conventions and explanations, not sampling.
- **Degree bounds** (§3.3) are computed in the same pass.
- **Done when:**
  - every Cookbook corpus entry type-checks
  - the ⊘ messages for 30 planted shape bugs have been reviewed and read clearly

### F4 — Instance generation

- **Recipes.** Use the §3.3 table. GF(p) and real recipes share one interface: `sample(sym, ty, props, field, rng)`.
- **PRNG.** `sfc32`, seeded from `(user seed, step hash, trial)`. Each step is reproducible on its own. "Re-roll" bumps the user seed.
- **Indexed families.**
  - `X = \begin{bmatrix} x_1^\top \\ \vdots \\ x_N^\top \end{bmatrix}` (compact form: `X: rows(x_i), i = 1..N`) generates the family {x_i} and assembles X.
  - That makes `\sum_i x_i x_i^\top = X^\top X` and other sample-sum ↔ matrix-form steps checkable.
- **Sampling failures.**
  - Incompatible constraints (e.g. orthogonal ∧ symmetric ∧ rank-deficient) give `?` "can't sample these constraints together".
  - More than 20 failed resamples gives `?` with the failing constraint named.

### F5 — Evaluation kernels

- **Fields.** `interface Field<T> { zero; one; add; sub; mul; div; neg; fromRational; isZero; eq; sqrt?; exp?; log?; sin?; … }` with five implementations:
  - `GFp(p)`: numbers, 16-bit-limb modmul
  - `F64`
  - `Dec`: decimal.js at 50 digits
  - `Dual<F>`
  - `HyperDual<F>`
- **`linalg.ts`, generic over `Field`.**
  - All fields: matmul, add, transpose, inverse (Gauss–Jordan: GF(p) takes the first nonzero pivot, real fields use partial pivoting), det (via LU), trace, Kronecker, Hadamard, solve, adjugate, block assembly.
  - Real fields only: Cholesky, symmetric eig (Jacobi), SVD (one-sided Jacobi), expm (scaling-and-squaring Padé-13), and sqrtm/logm for SPD matrices via eig.
  - Sizes are ≤ 8, so naive O(n³) is fine. No BLAS, no WASM.
- **Evaluation.**
  - IR compiles to a closure tree per field.
  - Common subexpressions are memoized per instance by structural hash.
  - Definitions are evaluated once per instance.
- **Done when:**
  - GFp agrees with an exact BigInt-rational oracle on random expressions (reduced mod p).
  - F64 ≈ Dec within tolerance.
  - Both are checked by property tests (§6.1).

### F6 — Verdict engine

```
for step in steps (topological order over definitions):
  if step.shapeError:            emit ⊘(explain(step.shapeError)); continue
  mode = plan(step)              // exact | numeric | quadrature | unchecked(reason)
  if mode == unchecked:          emit ?(reason, howToFix); continue
  for dims in sizeSettings(step.dimVars):                    // §3.3: (3,2) (2,3) (4,3) by default
    for trial in 1..(mode == exact ? 3 : 1):                 // numeric: one instance per size (3 total)
      for p in (mode == exact ? [p1, p2] : [real]):          // independent instance per prime
        inst = sample(step.symbols, dims, mode, p, seed(step, dims, trial, p))   // ≤ 20 resamples
        if !inst:                emit ?("cannot sample: " + inst.why); next step
        L, R = eval(step.lhs, inst, p), eval(step.rhs, inst, p)
        if differs(L, R, mode):  cx = confirm(step); emit ✗(shrink(cx)); attach lazy repairs; next step
  emit ✓(card(mode, sizes, trialsPerSize, worstDegree, bound, assumptions))
end
if first ≡ last && some middle ✗:  annotate "two errors cancel"
```

- **Relation handling:**
  - `=`: as above.
  - `:=`: binds a definition and gets no verdict ("defined").
  - `⇒` / `⟺`: constraint completion (§3.7).
  - `∝`: log-difference test.
  - `≤`, `≈`, `O(·)`: `?` in v1.
- **Budgets** (p95 per step, mid-range laptop): exact ≤ 5 ms, numeric ≤ 50 ms, quadrature ≤ 300 ms. Going over gives ⚠ "timed out (raise budget in settings)".

### F7 — Calculus (UI side; the math is in §3.5)

- **Layout mismatch.** When a ✗ comes from a layout mismatch:
  - offer the quick-fix "use Gᵀ"
  - show a one-line explainer
  - offer a global layout toggle
- **Symmetric-matrix gradients.** When both conventions pass, show the note "valid under the symmetric-direction convention" with a link to `docs/NOTATION.md#symmetric-gradients`.
- **Hessian claims** are checked with hyper-duals of the *original* function, not the claimed gradient. Rows like `\frac{\partial^2 J}{\partial x\,\partial x^\top}` and `\nabla^2_x J` are recognized.
- **Stationarity rows** ("= 0 ⟹ x = …") get a badge such as "stationary point ✓ (exact)". In numeric mode they may add "consistent with a minimum".

### F8 — Counterexamples: shrink and show

1. **From a GF(p) failure to a readable instance.**
   - Search for a small-integer real instance: entries in {−2…2}, then {−5…5}, then small rationals.
   - Evaluate with exact BigInt rationals.
   - Constraints are respected:
     - symmetric: mirrored
     - SPD: BBᵀ + I with integer B
     - orthogonal: signed permutation matrices first, then Cayley with a small S
     - idempotent: A(BA)⁻¹B
   - Fallback: show the GF(p) instance with a note.
2. **Shrinking** (Hypothesis-style; every candidate re-verified exactly):
   1. Decrement each dimension variable while the step still fails. 1 is allowed if it still fails.
   2. Zero entries, keeping symmetric pairs together.
   3. Pull magnitudes toward 0 and ±1.
   4. Stop at a local minimum or after 200 ms.
3. **Display:**
   - the instance in KaTeX `bmatrix`
   - L vs R
   - an entry-wise difference heatmap
   - numeric-mode failures shown with values rounded to 3 significant figures, but only if they still fail after rounding
4. **Copy as NumPy / PyTorch / MATLAB / Julia.** The snippet is self-contained. Example for the Joseph-form bug in Appendix A (shrunk to n = 2, m = 1):

```python
import numpy as np                                  # SAMOSA counterexample · step 12 · seed 0x5A305A
C  = np.array([[1., 0.]]);  Q = np.array([[1.]]);  Sb = np.diag([1., 2.])
K  = Sb @ C.T @ np.linalg.inv(C @ Sb @ C.T + Q)
lhs = np.linalg.inv(C.T @ np.linalg.inv(Q) @ C + np.linalg.inv(Sb))     # Σ_t
rhs = (np.eye(2) - K @ C) @ Sb @ (np.eye(2) - K @ C).T                  # your RHS
print(lhs - rhs)   # [[0.25 0.] [0. 0.]]  == K Q Kᵀ  → the RHS is missing + K Q Kᵀ
```

- **Done when:** for 95% of corpus ✗ cases, the shrinker reaches the smallest dims the bug allows, with |entries| ≤ 2, in < 200 ms.

### F9 — Repairs ("did you mean …")

Repairs run lazily, when a ✗/⊘ card opens. Caps: 300 candidates and 150 ms. They are never auto-applied; each one is a CodeMirror quick-fix.

- **a. Mutation search.**
  - Apply the mistake catalog (Appendix B, ~35 rules) at every node of the RHS, then the LHS. Generic rules apply everywhere; domain rules apply only where their pattern matches.
  - Each candidate is re-checked in exact mode with 2 trials (µs). Survivors get the full check.
  - Rank verified fixes by edit size, then rule frequency. Show ≤ 3, with the changed span highlighted via `\htmlClass{samosa-fix}`.
  - v1 tries single edits only.
- **b. Residual fingerprint (single term).**
  - Compute Δ = L − R on 3 instances (both primes).
  - Build a dictionary of up to 500 candidate terms:
    - every subexpression of the current row and the two previous rows
    - "sandwich" products XYXᵀ of declared symbols with compatible shapes
    - transposes and negations of these
  - Accept a term T if Δ = c·T entry-wise on every instance, where c is a small rational: brute-force a/b with |a|, |b| ≤ 12 and check a ≡ c·b mod p.
  - Message: "this step is off by exactly +K_tQ_tK_tᵀ" or "off by a factor of 2".
- **c. Missing assumption.** For each matrix symbol in the step without structural properties:
  1. Re-check with `symmetric`.
  2. Then with all of them symmetric.
  3. Then `orthogonal`.
  4. Then `diagonal`.

  Report the first minimal set that makes the step ✓: "Holds if Q_t is symmetric. [Add `Q_t \succ 0`]".
  - In Appendix A with Q_t unsymmetric, all three calculus rows (3, 4, 6) fail. The single repair "Q_t symmetric" fixes all of them.
  - Rows 9–12 still pass, because push-through and Woodbury don't need symmetry.
  - The spike demonstrates the gradient case.
- **d. Shape repair.** For ⊘:
  - Toggle ᵀ on each leaf or subtree, and swap the order of non-commuting factors.
  - Keep candidates that type-check, and mark the ones that also make the step ✓.
  - Example: `\bar\Sigma_t C_t (…)⁻¹` → "did you mean `C_t^\top`?" (✓).

### F10 — Editor and UI

```
┌ ∇ SAMOSA   Menu ▾  Presets ▾  Share  Export  ★ GitHub ──────────────────────── ◐ ┐
│ SOURCE (CodeMirror)                      │ RENDERED (KaTeX)                        │
│ 10 ✓ K_t &= (C_t^\top Q_t^{-1} C_t …     │  K_t = (C_tᵀQ_t⁻¹C_t + Σ̄_t⁻¹)⁻¹…   ✓ exact│
│ 11 ✓ K_t &= \bar\Sigma_t C_t^\top (…     │  K_t = Σ̄_tC_tᵀ(C_tΣ̄_tC_tᵀ + Q_t)⁻¹ ✓ exact│
│ 12 ✗ \Sigma_t &= (I - K_tC_t)\bar…       │  Σ_t = (I − K_tC_t)Σ̄_t(I − K_tC_t)ᵀ  ✗   │
│         ~~~~~~~~~~~~~~~~~~~~~~~~~~~      │        ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔         │
├──────────────────────────────────────────┴─────────────────────────────────────────┤
│ INSPECTOR · row 12 ✗ wrong · exact · counterexample n=2, m=1 · seed 5A305A          │
│ Off by exactly +K_tQ_tK_tᵀ  [Apply fix]   [Copy as NumPy ▾]   Symbols · Chips (2)    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Left pane.**
  - CodeMirror with `lintGutter()` and diagnostics mapped from verdicts: ✗/⊘ = error, ⚠ = warning, ? = info.
  - Each diagnostic carries `actions` (quick-fixes).
- **Right pane.**
  - Each row rendered with KaTeX, plus a badge and a mode tag.
  - The offending sub-expression is wrapped in `\htmlClass{samosa-hl}{…}` using our spans. Spans are token-aligned, so they are always balanced. A span that crosses `&` is clipped.
  - KaTeX options: `trust: ctx => ctx.command === '\\htmlClass' && /^samosa-/.test(ctx.class)` and a `strict` that ignores `htmlExtension`.
- **Inspector (bottom drawer):**
  - the step card (§3.8)
  - the counterexample
  - fixes
  - a symbols table: name, type, shape, properties, and source (declared / inferred / preset), all editable as chips
  - a list of every heuristic interpretation
- **Interactions:**
  - Re-check runs with a 250 ms debounce.
  - Alt+↓/↑: next/previous problem.
  - Cmd/Ctrl+Enter: re-roll the seed.
  - Cmd/Ctrl+.: quick-fix.
  - Hovering a row highlights its source range, and vice versa.
- **Mobile** (< 768 px): the rendered view comes first. The source opens in a bottom sheet and the inspector full-screen. The main job on mobile is reading shared links.
- **Visual design:** the terminal-style system in F22 (tokens, type, TUI panes, status bar, Cmd/Ctrl+K palette). CSS transitions only.
- **Accessibility:**
  - Never color alone: always an icon plus a word.
  - `aria-live` summary, e.g. "3 of 12 steps wrong".
  - KaTeX MathML output for screen readers.
  - Visible focus.
  - Contrast ≥ AA.
  - `prefers-reduced-motion` respected.
- **Empty state:** "Paste a derivation, or try one from the Menu", with chips: *Kalman update · Backprop · Gaussian conditioning*.

### F11 — Menu (examples) and Spot-the-bug

- **Launch set (~15).** Each has a correct version plus 1–2 planted-bug variants, and all are part of the golden test suite:
  - Woodbury
  - Sherman–Morrison
  - matrix determinant lemma
  - block inverse / Schur complement
  - **Kalman measurement update (your Lecture 8, Appendix A)**
  - Joseph form
  - least squares and ridge normal equations
  - logistic regression gradient and Hessian
  - softmax-cross-entropy gradient
  - 2-layer MLP backprop
  - Gaussian conditioning
  - E[xᵀAx]
  - KL between Gaussians
  - LQR Riccati step
  - rotation and skew-symmetric identities (RᵀR = I, [a]ₓb = a × b)
- **Spot-the-bug.**
  - A buggy variant is shown with verdicts hidden. You click the row you think is wrong, then the answer is revealed.
  - Shareable as `#bug=kalman-2`. Fun in class, and good for social posts.

### F12 — Share and export

- **Share link.**
  - Format: `https://samosa-math.vercel.app/#v1.<base64url(deflate(JSON{src, decls, preset, seed, settings}))>`, built with fflate.
  - The fragment never reaches the server.
  - Above 8 KB, warn and offer a `.samosa.json` download instead.
  - The version prefix keeps old links working.
  - Opening a link always *re-checks*. Verdicts are never stored, so a shared ✓ can't be faked.
- **Export:**
  - Markdown report: per-step verdict, cards, counterexamples.
  - Annotated LaTeX: `% samosa: ✓ exact (≤1e-47)` after each row.
  - JSON: same schema as the CLI.
  - PNG cards come later.

### F13 — CLI (`samosa` bin in npm `samosa-math`)

```
npx samosa-math check paper.tex notes.md [--decls "…"] [--preset kalman-thrun]
     [--format pretty|json|sarif|github] [--fail-on wrong,shape] [--seed 42] [--trials 3]
cat derivation.tex | npx samosa-math check - --format json            # stdin (agents)
```

- **Extraction.**
  - `.tex` → `parse()` from unified-latex. Walk the math environments (`equation*`, `align*`, `gather*`, `multline*`, `\[ \]`, `$$ $$`), skipping comments and verbatim. Expand `\newcommand` and `\DeclareMathOperator` from the preamble.
  - `.md` → the F1 scanner.
- **Declarations in documents:**
  - `% samosa: Σ̄_t: spd n; C_t: m×n` directive comments, scoped to their section/file
  - "where …" harvesting from the enclosing paragraph
  - `samosa.config.json`: project presets, per-file overrides, ignore globs
- **Suppression:** `% samosa-ignore-next-line`, `% samosa-disable` / `% samosa-enable`.
- **Output formats:**
  - `pretty` (ESLint-style): `paper.tex:132:18  ✗ wrong  align@130 row 3: not equal (counterexample n=2)  [samosa/not-equal]`
  - `json`: the core Report
  - `sarif`: 2.1.0 (Appendix E)
  - `github`: workflow commands
- **Exit codes:** 0 = clean, 1 = findings at or above `--fail-on`, 2 = usage error or crash.
- **Done when:**
  - it runs over the AgriJEPA paper and your course `.tex` files without crashing
  - it gives the same verdicts as the web app on the golden suite (G7)

### F14 — GitHub Action

```yaml
- uses: Hussain004/SAMOSA@v1
  with:
    path: "paper/**/*.tex"
    fail-on: "wrong,shape"
```

- **How it runs.** It's a composite action, following BAGEL's `action.yml` pattern. It runs `node $GITHUB_ACTION_PATH/pkg/dist/cli.mjs check … --format github`.
  - That prints `::error file=…,line=…,col=…,title=SAMOSA::…` workflow commands, which become inline PR annotations with no SARIF plumbing.
- **Optional code scanning:** `format: sarif` plus `github/codeql-action/upload-sarif` sends results to code scanning.
- **Docs** include an example workflow for papers synced from Overleaf to GitHub.

### F15 — MCP server (`samosa-mcp` bin)

- **Server:** stdio, built with `@modelcontextprotocol/sdk` (`McpServer` + `StdioServerTransport`, `registerTool` with zod schemas). Full schemas are in Appendix D.

| Tool | Input | Output |
|---|---|---|
| `check_derivation` | `latex`, `declarations?`, `preset?`, `seed?` | per-step verdicts, messages, fixes, share URL |
| `check_step` | `lhs`, `rhs`, `relation?`, `declarations` | verdict, counterexample, fixes |
| `check_gradient` | `f`, `wrt`, `claimed`, `declarations` | verdict and layout hint |
| `find_counterexample` | `lhs`, `rhs`, `declarations` | shrunk instance and NumPy snippet |

- **Self-correcting errors.** Parse errors are instructive, so agents can fix themselves: "unknown command `\Var`: use `\operatorname{Var}`".
- **Install snippets:**
  - Claude Code: `claude mcp add samosa -- npx -y -p samosa-math samosa-mcp`
  - Codex (`~/.codex/config.toml`): `[mcp_servers.samosa]` with `command = "npx"` and `args = ["-y", "-p", "samosa-math", "samosa-mcp"]`
  - Cursor / VS Code: the equivalent JSON
- **Share URL.** The returned share URL lets a human open exactly what the agent checked.

### F16 — Agent Skill (`skill/samosa/SKILL.md`, agentskills.io standard)

- **Frontmatter** (spec fields only, so it works outside Claude Code):
  - `name: samosa`
  - `description: Check matrix-algebra, matrix-calculus, gradient and expectation derivations step by step with SAMOSA before presenting them. Use whenever you derive or verify math with matrices, gradients, Kalman/least-squares/backprop updates, or Gaussian expectations.`
- **Body:**
  1. Write the derivation as LaTeX `align*`.
  2. Declare symbols.
  3. Run `npx -y -p samosa-math samosa check - --format json` or use the MCP tool.
  4. Fix every ✗/⊘ before answering, and name the steps that are `?`.
  5. Include the share link.
- **Distribution:** in the repo; awesome-lists / skill registries at launch (§8.4).

### F17 — Privacy, analytics and security

- **No leaks.** Derivation text never leaves the browser. A Playwright test asserts that no request URL or body contains the source (G6).
- **Analytics.** Vercel Web Analytics (cookieless page views, disclosed in `PRIVACY.md`), or none (§10 decision 5). No event payloads.
- **Safety limits.**
  - KaTeX `trust` is restricted to SAMOSA's own `\htmlClass` names.
  - Macro expansion and recursion are budgeted.
  - The Worker has timeouts, so a macro bomb can't hang the tab.
- **CLI and MCP** are read-only on the files they're given, with no network.
- **"Report an unparsable row"** opens a prefilled GitHub issue in a new tab. The user sees the exact content and submits it themselves.

### F18 — Performance budgets

- **Engine:**
  - per-step budgets as in F6
  - a 30-row derivation in < 1.5 s p95 on a mid-range laptop (Chrome), < 4 s on a mid-range Android
- **Bundle:**
  - initial JS ≤ 250 KB gzip. KaTeX and CodeMirror dominate; the engine is ~60 KB.
  - Worker, Menu and inspector extras are lazy-loaded.
  - Reuse BAGEL's `check-bundle-budget.mjs` in CI.
- **Web vitals:** LCP < 1.5 s on Vercel; Lighthouse performance ≥ 90 and accessibility ≥ 95.

### F19 — Website: structure (modeled on ampcode.com)

**Direction.** A terminal-native, agentic look. The site should feel like a beautiful TUI that happens to render perfect math.
- **References:**
  - [ampcode.com](https://ampcode.com) for page structure and tone
  - [ghostty.org](https://ghostty.org) for the ASCII hero
  - [charm.sh](https://charm.sh) for making the terminal feel warm and premium
  - [opencode.ai](https://opencode.ai) and [factory.ai](https://factory.ai) for agent-transcript demos
- **Pages.** Two, built as one Vite multi-page app:
  - `/`: the landing page, also React + Vite (same components and tokens as the app). The ASCII samosa and typed demo are framework-free modules wrapped in thin React components. Keep it ≤ 120 KB JS gzip, and lazy-load anything heavy (KaTeX for the mocks), so it loads instantly.
  - `/app`: the React checker (F10).
  - Docs (`/docs/*`) are rendered from `docs/*.md` at build time with the same theme.

**Reference:** sections 1–2 (header and hero) already exist in `prototypes/ascii-samosa/index.html`. Match that look exactly; the rest of the page follows the same tokens (F22).

**Landing page, top to bottom.** This mirrors Amp's section rhythm, adapted to SAMOSA.

| # | Section | Amp equivalent | Content | Build notes |
|---|---|---|---|---|
| 1 | **Header** | logo + tagline + nav + Start | `∇ SAMOSA` wordmark (mono) · tagline "Step auditor for matrix math" · nav: How it works · Menu · Docs · Changelog · `★ GitHub` with the live star count · **Open app →** | Sticky, blurred translucent bar; the star count is fetched once from the GitHub API and cached in `localStorage` for 1 h, falling back to no number |
| 2 | **Hero** | "Juggle less / Ship more" + phrase list + Start | Left: stacked headline **"Derive more. / Doubt less."** Under it, a phrase list that types itself one line at a time: `every step, checked` · `counterexamples, not vibes` · `no AI in the verdict` · `runs in your browser` · `your agent can use it too`. CTAs: **Open SAMOSA →** and a copyable `npx samosa-math check paper.tex` chip. Right: the **ASCII samosa** (F20) | On mobile the samosa sits above the headline at 60% size |
| 3 | **Intro line** | one-sentence description | "SAMOSA checks every step of your derivation by evaluating it on random matrices: exactly, over finite fields. Wrong steps come with a 2×2 counterexample and a fix." | Serif-free; one line, wide tracking |
| 4 | **Agent demo** | the 26-min video section | The **typed agent session** (F21) in a large terminal window, with tabs `Claude Code · Codex · CLI · CI`. Under it, a timestamped "what you just saw" list like Amp's video highlights | This is the emotional center of the page |
| 5 | **Feature grid** | 2×3 orb cards with mock UIs | Six cards, each with a live mini-mock (real KaTeX, real engine output captured at build): **Counterexamples** (2×2 matrices, diff cell glowing) · **Fixes** (diff `− Q_t^{-1}` / `+ Q_t`) · **Shape errors** (⊘ with the unification chain) · **Gradients** (layout-transpose hint) · **Guarantees** (the card: `false-✓ ≤ 1e-46`) · **Terminal** (CLI output, Appendix E) | Cards tilt 2° toward the pointer (CSS `transform`, no library); mocks are static HTML |
| 6 | **Playful divider** | "orbservations" pixel characters | **"samosa-servations"**: a row of tiny pixel-art samosas (crispy, soggy, burnt, raw = the verdict states) with speech bubbles: "(AB)ᵀ ≠ AᵀBᵀ, bestie" · "you dropped + KQKᵀ" · "that's numerator layout 👀" · "≈ is not =" | Pixel sprites drawn as 16×16 SVGs; bubbles cycle every 4 s |
| 7 | **Social proof** | testimonial marquee | **Before launch:** a "Hall of Bugs" marquee of real mistakes SAMOSA catches (Appendix B, rendered in KaTeX with a red underline). **After launch:** real quotes from HN/Reddit/X, used only with permission. **Never fake testimonials** | CSS `@keyframes` marquee, duplicated track, pause on hover, static under reduced motion |
| 8 | **Numbered deep-dives** | "09 · Bring ChatGPT" numbered blocks | `01 · Exact, not approximate` (GF(p) + Schwartz–Zippel, tiny animated bound counter) · `02 · Gradients by dual numbers` · `03 · Counterexamples that shrink` (animation: a 4×4 counterexample shrinking to 2×2) · `04 · Built for agents` (MCP + Skill) · `05 · In your CI` (Action annotation mock). Each ends with a link into `/docs/how-it-works#…` | Big mono numerals; alternating left/right layout |
| 9 | **The Menu** | "Orbs from zero" tutorial cards | Cards for Menu items: Kalman update · Backprop · Gaussian conditioning · Woodbury … Each shows its first line in KaTeX, `12 rows · 1 bug`, and **Spot the bug →** | Thumbnails are live KaTeX, not images |
| 10 | **Install** | install tabs + two cards | Tabs: **Web** (open app) · **CLI** (`npx samosa-math check …`) · **Claude Code** (`claude mcp add samosa -- npx -y -p samosa-math samosa-mcp`) · **Codex** (TOML) · **Cursor** (JSON) · **GitHub Action** (YAML) · **Skill**. Two cards: "In your browser" / "In your agent & CI" | Copy buttons, with a ✓ flash on copy |
| 11 | **Changelog** | "Announcements" cards | The latest 6 entries from `CHANGELOG.md`, parsed at build | Shown as dated cards once releases exist; the section is hidden until there are ≥ 3 entries |
| 12 | **Footer** | status + links | Status pill: **"● all checks local, nothing uploaded"** (a privacy promise styled as a status page). Columns: Product · Docs · Community (GitHub, X, Discussions) · Cite (`CITATION.cff`) | A tiny ASCII samosa sits next to the copyright |

**Copy tone.** Like Amp: confident, casual and short, with lowercase phrase lists. Food puns are allowed in one place per section, at most.

### F20 — The ASCII samosa (hero)

A real-time, ASCII-rendered 3D samosa shaped like ∇, in the spirit of `donut.c` and Ghostty's ghost. Steam rises off it as `∂` characters.

> **Reference implementation (approved look):** `prototypes/ascii-samosa/`: `ascii-samosa.mjs` (renderer) and `index.html` (hero page). Serve the folder (`python3 -m http.server`) and open it. **Port it to TypeScript as-is; the values below match the prototype.** Items marked *(to add)* are not in the prototype yet.

- **Shape (signed distance function).**
  - Tetrahedron with vertices A(−1.05, 0.55, 0.32), B(1.05, 0.55, 0.32) as the top corners, C(0, −1.0, 0.12) as the bottom apex, and D(0, 0.42, −0.85) at the back. Seen from the front, it reads as **∇**.
  - Distance = smooth max (log-sum-exp, k = 9) of the 4 outward face planes, minus 0.04. This gives the puffy, rounded edges.
  - Fried surface: `+0.012·sin(9x)·sin(9y+1.3)·sin(9z+2.1)`.
  - Crimp along the top edge AB: `−0.03·max(0, sin(46u))·(1 − e/0.25)` within distance e < 0.25 of the edge, where u is the position along the edge.
- **Renderer.**
  - Character grid: 80×38 on desktop and 52×26 below 860 px. Cell aspect is 0.55 (*to add:* measure it from the font with a hidden span). The view spans 2.7 world units across.
  - Camera: yaw auto-rotates; pitch is fixed at −0.32 (looking slightly down onto the seam).
  - One orthographic ray per cell, with a bounding-circle early-out (r = 1.7). Sphere tracing uses ≤ 40 steps, step × 0.9 and ε = 1e-3.
  - Normals use the tetrahedral 4-tap technique.
  - Shading: `lum = 0.14 + 0.7·lambert + 0.5·specular^24 + 0.25·rim³`. The light defaults to (−0.45, 0.55, −0.75) and leans toward the pointer.
  - Luminance maps to the ramp `" .:-=+*#%@"`. *(to add, optional:)* `✦` on ≤ 1% of specular hits.
  - Output is a single `pre.textContent = frame` write per frame.
  - Color: one CSS gradient on the `<pre>` (`background-clip: text`): `#fff2c8` → gold → saffron → `#a5501c`, plus a `drop-shadow` glow in gold at 25% alpha.
- **Steam.**
  - 26 particles spawn above the top seam and rise (0.55 units/s) with a sinusoidal drift.
  - They are drawn on top of the frame with characters chosen by age: `∂` → `~` → `·` → gone.
  - *(to add)* Every few seconds, one wisp briefly spells `∇`.
- **Interaction.**
  - Auto-rotates about y at 0.5 rad/s.
  - Pointer drag adds angular velocity (0.004 rad per px) with damping (× 0.94 per frame).
  - A click without dragging toggles **snack mode** (a "✓ crispy" tag on the top line) as an Easter egg.
  - *(to add)* Hover raises brightness by 10%.
- **Performance budget: ≤ 8 ms/frame on a mid-range laptop.** The prototype measures ~8 ms per frame at 80×38 in Node.
  - Keep a moving average. Above 12 ms, drop to 20 fps (the prototype does this). *(to add)* Then shrink the grid by 15%.
  - Pause via `IntersectionObserver` when offscreen, and on `document.hidden`.
- **Fallbacks.**
  - `prefers-reduced-motion`: a single static frame.
  - *(to add)* No-JS and first paint: a frame **pre-rendered at build time** (`node ascii-samosa.mjs` already prints frame 0). The same TS module runs in Node and inlines the frame into the HTML, so there's no layout shift and the hero is there before JS loads.
  - The `<pre>` is `aria-hidden`, with a visually hidden description ("A rotating ASCII-art samosa shaped like the nabla symbol").
- **Code:** port to `src/landing/ascii-samosa.ts` (the prototype is ~130 LOC) and wrap it in a thin React component. It has zero dependencies: `createSamosa({w, h, aspect}).render(t, {light, steam}): string` is pure and testable. A snapshot test pins frame 0, so the build-time frame and the runtime frame can't drift apart.

### F21 — The typed agent demo

- **Script as data, output from the real engine.**
  - `src/landing/demo-scripts.ts` holds timelines: `{ kind: 'user' | 'think' | 'tool' | 'result' | 'agent', text, pauseMs }`.
  - The verdict lines (`row 12 ✗ wrong · missing + K_tQ_tK_tᵀ · counterexample n=2, m=1`, the bound, the timings) are **generated at build time by running the engine on `corpus/menu/kalman-bug.tex`**.
  - A test fails the build if the demo text and the engine output disagree. The demo can never lie (Principle 4).
- **Default script (Claude Code tab):**
  ```
  > derive the Kalman gain for my notes and check every step
  ✻ Thinking…
  ⏺ samosa.check_derivation(kalman.tex)
    ⎿ row  3 ✓ exact   ∂J/∂x (dual numbers)
      row 11 ✓ exact   push-through · false-✓ ≤ 1e-46
      row 12 ✗ wrong   missing + K_t Q_t K_tᵀ   counterexample n=2, m=1
  ⏺ Fixing row 12 (Joseph form)…
  ⏺ samosa.check_derivation(kalman.tex)
    ⎿ ✓ 12/12 rows verified · exact · 31 ms
  ✓ Done. Share link: samosa-math.vercel.app/#v1.eNq…
  ```
  Other tabs:
  - **Codex**: the same flow with Codex's styling.
  - **CLI**: `npx samosa-math check paper.tex` printing the Appendix E output.
  - **CI**: a GitHub PR annotation appears on a diff line.
- **Renderer.**
  - User text types with human jitter (25–70 ms/char, longer after punctuation).
  - Tool output appears line by line after a braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧`, 400–900 ms).
  - ✓ in chutney green, ✗ in tamarind, with a 150 ms glow pulse on the line where ✗ lands.
  - Block cursor blinks at 1 Hz.
  - Loops after 5 s.
  - Controls: pause on hover or focus, **↻ replay**, **skip ⏭**.
  - Math in the transcript is Unicode (Kᵀ, ≤), so no KaTeX is needed in the terminal.
- **Window chrome.** Three dots, a title (`~/notes — claude`), and a fake status line at the bottom (`exact · seed 5A305A · ✓ 12/12`). A subtle CRT scanline overlay can be toggled with `~`.
- **Accessibility.**
  - The animated region is `aria-hidden`. A visually hidden `<ol>` holds the full transcript.
  - Under reduced motion it renders the final state immediately.
- **Code:** `src/landing/typed-demo.ts`, ~150 LOC, no dependencies.

### F22 — Visual system (landing, docs and app)

- **Theme.** Dark-first, near-black "terminal ink". A light theme ("paper") exists for docs and the app, but the landing page is always dark.
- **Tokens** (CSS custom properties, Tailwind 4 `@theme`):

| Token | Dark | Use |
|---|---|---|
| `--ink` | `#0B0A08` (warm black) | page background |
| `--panel` | `#14120F` + 1 px `#2A251E` hairline | terminals, cards |
| `--text` / `--muted` | `#EDE6DA` / `#8C8273` | body / secondary |
| `--gold` | `#E8B04B` | brand, ASCII samosa, links |
| `--saffron` | `#F28C28` | ⚠, highlights, hero gradient end |
| `--chutney` | `#5BC27A` | ✓ |
| `--tamarind` | `#E0533D` | ✗, ⊘ |
| `--slate` | `#7A8594` | ? |

  Validate every pair for WCAG AA contrast before shipping. These hex values are starting points.
- **Type:**
  - **Geist Mono** (free, OFL) for UI, headings and terminals. Headlines are huge, light weight, with tight tracking.
  - **Inter** for long prose in docs.
  - **KaTeX's Computer Modern** for math. Keeping LaTeX's own look inside a terminal aesthetic is the signature contrast.
  - All of them self-hosted via @fontsource, as in BAGEL. (The prototype loads Geist Mono from Google Fonts; switch that to self-hosting.)
- **Texture and effects, all of them cheap:**
  - a faint dot grid on `--ink` (CSS `radial-gradient`, 24 px)
  - a hairline 1 px border on every panel
  - an inner glow on the focused terminal
  - an optional scanline overlay (`repeating-linear-gradient`, 4% opacity)
  - ✓/✗ badges with a 6 px glow of their own color
- **Motion:**
  - 150–250 ms ease-out for UI.
  - Section reveals fade and rise 8 px via `IntersectionObserver`, once only.
  - No scroll-jacking and no smooth-scroll library. That keeps the landing light and the docs readable.
- **Box-drawing UI language** in the app and the mocks: `┌─┐ │ └─┘`-style pane titles rendered in CSS borders (not literal characters), plus keyboard hints as `kbd` chips.
- **The checker app (F10) restyled as a premium TUI:**
  - Panes get mono titles (`SOURCE`, `RENDERED`, `INSPECTOR`).
  - A bottom **status bar**: `● exact · seed 5A305A · ✓ 11 · ✗ 1 · ⊘ 0 · 38 ms`.
  - A **Cmd/Ctrl+K command palette** (Menu items, presets, re-roll, share, toggle layout, toggle snack mode). It's built on native `<dialog>` plus a fuzzy filter, not a library.
  - The rendered math is the only non-mono element.
- **Logo set:**
  - an SVG ∇-samosa (flat, two-tone gold)
  - a 32 px favicon
  - a monochrome version for the terminal chrome
  - an ASCII version for the README and footer
  - The social-preview image (1280×640) is a frame from F20 plus the headline.
- **Performance gates (added to G4/G5):**
  - landing LCP < 1.2 s
  - CLS ≈ 0 (thanks to the build-time ASCII frame)
  - landing JS ≤ 120 KB gzip
  - Lighthouse ≥ 95 on landing performance and accessibility

---

## 6. Quality and launch gates

### 6.1 Test layers

- **Kernels.**
  - Unit tests for every op in every field.
  - `GFp` must agree *exactly* with a BigInt-rational oracle reduced mod p.
  - `F64` must match `Dec` to within 10⁻¹² relative on well-conditioned instances.
- **Parser.**
  - ~300 golden IR snapshots covering the F2 tables.
  - IR → LaTeX → IR round-trip as a property test.
  - fast-check fuzzing over random token streams: it never throws, and every error carries a span.
- **Types.** Op-table tests, plus 30 planted ⊘ cases with snapshot-tested messages.
- **Metamorphic property tests.** A fast-check `letrec` generator produces random *typed* expressions (n ≤ 4).
  - Apply a **true** rewrite from the catalog of ~40 identities and the step must be ✓. Examples: distributivity, (AB)ᵀ = BᵀAᵀ, cyclic trace, Woodbury, push-through, det(AB) = det A·det B.
  - Apply a **mistake** mutation (Appendix B) and the step must be ✗. The exception is when the exact rational oracle says the mutant is still equal; then it must be ✓.
  - Thousands of seeded cases run per CI pass.
- **Golden derivations.** Every Menu item plus Appendix A:
  - Correct versions: every row ✓ or "defined", with zero false ✗.
  - Planted bugs: ✗/⊘ on the *exact* row, with the expected repair in the top 3.
- **E2E (Playwright, as in BAGEL):**
  - paste → verdicts
  - a quick-fix applies
  - share-link round-trip
  - mobile viewport
  - keyboard-only flow
  - the no-leak network assertion
- **Bench (`vitest bench`, as in BAGEL).** Per-mode latency; a regression > 20% fails CI.

### 6.2 Corpora

- **Matrix Cookbook** (Petersen & Pedersen).
  - Transcribe ~300 identities into `corpus/cookbook/*.samosa` with declarations: basics, inverses, determinants, derivatives, Gaussian moments.
  - Use agents to transcribe, then review each identity yourself, and credit the source in the README.
  - Mutants are generated automatically.
- **Golden.** Menu items, Appendix A, and your course material (DL4STG backprop, TA solution keys).
- **Real-world coverage sample.**
  - Display-math rows from ~1,000 arXiv cs.LG / cs.RO / stat.ML source bundles, fetched politely (rate-limited) and kept out of git, plus your own `.tex`.
  - It measures **parse/checkable coverage only**, not correctness.
  - Failures are bucketed by the first unknown construct, which gives the F2 priority list.
  - Publish the number honestly.
- **SAMOSA-Bench** (*optional, off the critical path*).
  - ~100 derivation prompts × 3 LLMs.
  - Step-level labels from you plus one classmate on a subset, with disagreements adjudicated.
  - Report SAMOSA's precision/recall against the human labels.
  - Publish only with method and data (CC-BY). It's a good follow-up post, not a launch dependency.

### 6.3 Launch gates

These are pre-registered in your PREREG.md style: written now, evaluated before launch. A failed gate either blocks the launch or becomes an explicit README caveat.

| Gate | Criterion |
|---|---|
| G1 | Zero false ✗ on every golden correct derivation and every Cookbook identity that parses |
| G2 | ≥ 95% of planted bugs (golden + Cookbook mutants) flagged on the right row |
| G3 | Parse coverage ≥ 70% of display-math rows in the arXiv sample (the number is published either way) |
| G4 | p95 latencies within the F6/F18 budgets |
| G5 | Share links round-trip on 100% of the Menu; Lighthouse accessibility ≥ 95 |
| G6 | No derivation text in any network request (Playwright) |
| G7 | CLI, MCP and web give identical verdicts on the golden suite |

---

## 7. Build checklist

No dates, no fixed order. Tick things off as you go. The only hard dependencies are noted with **needs**.

**Foundation** (first, because everything builds on it)
- [ ] `git init`; repo `Hussain004/SAMOSA` (private until you're ready to share).
- [ ] Scaffold Vite React-TS into `~/SAMOSA`, keeping this plan and `spikes/`. Copy BAGEL's eslint, tsconfig, vitest and playwright configs, plus LICENSE, CODE_OF_CONDUCT and CONTRIBUTING.
- [ ] `AGENTS.md`: the §4.7 invariants plus a pointer to this plan.
- [ ] `corpus/golden/lecture8.tex` (Appendix A) and `scripts/check.mjs`, which prints verdicts.

**Go/no-go check:** Appendix A *parsed from LaTeX text* gives rows 3, 4, 6, 9–12 ✓ exact; B1, B2 ✗; B3 ⊘; B4 ✗. If this doesn't work, re-think before building anything else.

**Engine**
- [ ] F1–F5: input, parser, declarations/types, sampling, kernels.
- [ ] F6: exact + numeric modes, definitions and chains, affine ⇒, degree bounds and cards.
- [ ] F8: counterexample shrinker and Copy as NumPy.
- [ ] Golden suite and Cookbook corpus in CI (§6).

**Calculus and probability** (**needs** the engine)
- [ ] §3.5: duals, hyper-duals, abstract functions, stationarity.
- [ ] §3.6: rational quadrature, densities, ∝.
- [ ] F9 a–d: repairs.

**Website** (**needs** the engine; can start with exact mode only)
- [ ] F22 visual system first (tokens, fonts, logo set), so everything else is built in it.
- [ ] F20 ASCII samosa (pure `render()` + build-time frame + snapshot test). Can be done any time; it has no engine dependency.
- [ ] F10 editor, render and inspector; F11 Menu (~15) and Spot-the-bug; F12 share and export.
- [ ] F19 landing page sections; F21 typed demo (**needs** the engine for build-time verdict lines).
- [ ] Dark mode, mobile reading, deploy to `samosa-math.vercel.app`.
- [ ] Optional: show classmates and TA students for early feedback (GitHub Discussions + a short form).

**Integrations** (**needs** the engine)
- [ ] F13 CLI (pretty/json/sarif/github), F14 Action, F15 MCP, F16 Skill; publish `samosa-math` on npm.
- [ ] Verify the install snippets in Claude Code and Codex.

**Launch prep**
- [ ] Docs, README, showcase video and GIFs, launch drafts, awesome-list PRs.
- [ ] Gates G1–G7 pass, or the caveats are written. Then tag `v1.0.0` and launch.

**After launch:** the §1 "Later" column, driven by what people ask for; the optional SAMOSA-Bench post; VS Code / Overleaf.

---

## 8. Launch playbook

### 8.1 Assets (ready before launch)

- **README** (BAGEL style):
  - centered ∇-samosa logo, tagline, badges (MIT, TypeScript, version)
  - **Live Demo** link
  - the ASCII samosa (F20) as an animated header, recorded from the landing page
  - a 15–20 s showcase video, made with your `brag`/HyperFrames workflow like BAGEL's 15 s showcase; open on the typed agent demo (F21)
  - three GIFs:
    1. `(AB)ᵀ = AᵀBᵀ` → squiggle → 2×2 counterexample → quick-fix
    2. paste a ChatGPT Kalman derivation → row flagged → "off by exactly +KQKᵀ"
    3. the gradient layout-transpose hint
  - sections: Why · How it works (5 lines, linking to `HOW_IT_WORKS.md`) · **What it can't do** · CLI/Action/MCP/Skill quickstarts · Notation · Privacy · Roadmap · Contributing · Cite (`CITATION.cff`, since academics cite tools)
- **`docs/HOW_IT_WORKS.md`**: Schwartz–Zippel, degree bounds, duals, rational quadrature, and the honest caveats. It doubles as a later blog post.
- **Repo hygiene:**
  - topics: math, linear-algebra, matrix-calculus, latex, linter, education, kalman-filter, machine-learning, mcp, agent-skills
  - a 1280×640 social preview
  - issue templates (bug report, "SAMOSA can't parse this")
  - 10 `good first issue`s (add an operator, a distribution, a preset, a Menu item)
  - a pinned roadmap issue, Discussions turned on, release notes and a CHANGELOG
- **Deep links:** `#menu=kalman-thrun`, `#bug=joseph-1`, …
- **Infrastructure:** fully static on Vercel. No backend means nothing falls over on launch day.

### 8.2 Show HN

- **Title options** (≤ 80 characters):
  - `Show HN: SAMOSA – a linter for math derivations (matrices, gradients, Kalman)`
  - `Show HN: SAMOSA – find the wrong step in your derivation, without AI`
  - `Show HN: A step-by-step checker for matrix calculus derivations`
- **Link to the live app**, not the repo. It's tryable with no signup, which the Show HN guidelines ask for.
- **First comment:** see Appendix F. Post it right after submitting.
- **During the thread.**
  - Stay in it for 3–4 hours and answer everything.
  - **Never ask anyone to upvote**; the guidelines forbid it.
  - Keep hotfixes tiny, and re-run G1 and G6 before deploying one.
- **Prepared answers:**
  - Why not SymPy, Lean or an LLM?
  - Is random testing sound? (the bound plus the two caveats)
  - What about inequalities? (not yet; on the roadmap)
  - Privacy? (the URL fragment)
  - Can I use it in my course? (yes, MIT; an embed comes later)
  - Why "SAMOSA"? (the acronym; ∇ is a samosa)

### 8.3 Reddit

Stagger posts rather than posting everywhere at once, and tailor each one. **Check every sub's sidebar rules before posting.** The rules weren't verified while writing this plan.

| Subreddit | Angle | Notes |
|---|---|---|
| r/MachineLearning | `[P]` tag; backprop/attention gradient demo; MCP for agents | Lead with this one |
| r/learnmachinelearning | "Paste your backprop derivation" | — |
| r/robotics, r/ControlTheory | Kalman/LQR, with the Lecture 8 story | — |
| r/LaTeX | CLI + Action to lint `align` blocks in papers | — |
| r/math | Only through the sub's sanctioned threads, if any (strict self-promotion norms) | Check first |
| r/learnmath, r/EngineeringStudents | Spot-the-bug quiz links | — |
| r/webdev | Saturday showcase format: finite-field math in a Web Worker | Self-promotion day only |
| r/SideProject, r/opensource, r/coolgithubprojects | The build story | — |
| r/ClaudeAI, r/mcp | "Let Claude check its own math": Skill + MCP | Once the MCP docs are live |

### 8.4 Other channels

- An X/Bluesky thread with the GIFs.
- LinkedIn, for your LUMS network.
- Email course instructors and TAs with a Menu link.
- Awesome-list PRs:
  - awesome-mcp-servers
  - agent-skill lists
  - awesome-latex
  - awesome-math
  - awesome-robotics (you already have a fork)
- A technical post, "Checking math without AI: finite fields, dual numbers and samosas". Submit it later as a *regular* HN story, not a Show HN.
- Product Hunt is optional.

### 8.5 Launch-day runbook

1. Smoke test production: every Menu item, share links, mobile, CLI `npx` from a clean directory.
2. Submit Show HN, then post the first comment immediately.
3. Stay in the thread for a few hours and reply to every comment; tiny hotfixes only.
4. Then X/Bluesky/LinkedIn, followed by Reddit per §8.3.
5. Triage issues quickly, and ship a patch release with the most-requested notation.

### 8.6 Metrics (watch them; no targets promised)

- GitHub stars
- cookieless unique visitors
- npm weekly downloads of `samosa-math`
- "can't parse this" issues; their top constructs set the v1.1 scope
- Menu and Spot-the-bug link opens

Review them after launch to decide what comes next.

---

## 9. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Real notation is too varied, so parse coverage is low | High | Presets, declarations and chips; `?` instead of ✗; the coverage metric drives F2; publish an honest number |
| False ✓ from a wrong default assumption (e.g. Σ assumed symmetric) | Medium | Assumptions are always printed on the card; defaults are conservative; one click to change |
| False ✗ from numerics | Low (exact) / Medium (numeric) | Exact mode whenever rational; 50 digits; a ⚠ band; confirm on fresh instances before ✗ |
| HN skepticism about "probabilistic" correctness | Medium | Computed bound on every ✓; `HOW_IT_WORKS.md`; the oracle tests are public |
| Scope creep into a CAS or prover | High | §1 cut line, non-goals, post-launch backlog |
| Limited time alongside courses and research | High | No schedule to slip; the §1 cut line keeps v1 small |
| Big players add "check my steps" to chat | Medium | Deterministic, open, local and agent-callable; ship first |
| Name collisions (npm/PyPI `samosa` taken) | Low | Publish `samosa-math`; the repo is `SAMOSA`; stay on vercel.app or buy a domain (§10) |
| Abuse (macro bombs, giant pastes) | Low | Expansion and recursion budgets; Worker timeouts; 8 KB link cap |

---

## 10. Open decisions (need your call)

1. **MathLive visual input in v1?** *Recommendation: no.* LaTeX and paste cover the target users; add it lazily in v1.1.
2. **SAMOSA-Bench before launch?** *Recommendation: after, as a follow-up post.* It needs human labels.
3. **Domain.**
   - `samosa.dev` and `samosa.app` already resolve (taken).
   - `samosa-math.dev` had no DNS record when checked, so check a registrar.
   - *Recommendation:* launch on `samosa-math.vercel.app`, like BAGEL.
4. **Analytics.** Vercel Web Analytics (cookieless), or none?
5. **Snack mode.** Off by default (recommended), or on?
6. **Repo visibility.** Private until you first share it (recommended), or public from the start?
7. **Early feedback.** Is it OK to share with Mobile Robotics and DL4STG classmates before the public launch?

---

## Appendix A — Golden derivation: your Lecture 8 (Kalman measurement update, Thrun notation)

Transcribed from your handwritten notes (*Lecture #8: Kalman filter derivation*). This is the **go/no-go** test (§7) and Menu item #1.

```latex
% samosa: x_t, \bar\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \bar\Sigma_t: spd n
\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\mathcal{N}(z_t; C_t x_t, Q_t)\,\mathcal{N}(x_t; \bar\mu_t, \bar\Sigma_t) &\propto_{x_t} \exp\{-J_t\} \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
\frac{\partial J_t}{\partial x_t} = 0 &\implies x_t = \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
\mu_t &:= \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\mu_t &= \bar\mu_t + K_t (z_t - C_t \bar\mu_t) \\
K_t &= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}
```

| Row | Your note says | Expected | How SAMOSA checks it |
|---|---|---|---|
| 1 | "bel(x_t) = η exp{−J_t} where J_t = …" | defined | — |
| 2 | "the product on the RHS can be expressed as …" | ✓ numeric | `∝` in x_t: log-difference is constant over 3 values of x_t |
| 3 | ∂J_t/∂x_t | ✓ exact | Dual numbers on J_t; needs Q_t and Σ̄_t symmetric (declared) |
| 4 | ∂²J_t/∂x_t² | ✓ exact | Hyper-duals on J_t; `\partial x_t^2` is read as the Hessian (chip) |
| 5 | "from the second term, we get the covariance" | defined | Modeling step, shown as a definition chip |
| 6 | "by setting ∂J_t/∂x_t to zero and solving for x_t" | ✓ exact | Stationarity: ∇J_t(e) = 0 |
| 7–8 | "define this as the Kalman gain" | defined | — |
| 9 | μ_t = μ̄_t + K_t(z_t − C_tμ̄_t) | ✓ exact | Follows from the definitions |
| 10 | "substituting the expression of Σ_t" | ✓ exact | — |
| 11 | "after some algebraic manipulation …" | ✓ exact | Push-through identity; worst d = 43 over the default sizes → ≤ 10⁻⁴⁶ per size (§3.3) |
| 12 | "further simplification … yields" | ✓ exact | Woodbury |

| Planted bug | Change | Expected | Repair shown |
|---|---|---|---|
| B1 | Row 11: `+ Q_t` → `+ Q_t^{-1}` | ✗ row 11 | Mutation: "Q_t⁻¹ → Q_t" |
| B2 | Row 12 RHS → `(I - K_tC_t)\bar\Sigma_t(I - K_tC_t)^\top` | ✗ row 12, shrunk to n=2, m=1 (F8 snippet) | Residual: "missing + K_tQ_tK_tᵀ" (Joseph form) |
| B3 | Row 11: `C_t^\top` → `C_t` | ⊘ row 11 | Shape: "C_t → C_tᵀ" |
| B4 | Declarations: `Q_t: m×m` (no `spd`) | ✗ rows 3, 4, 6; rows 9–12 still ✓ | Assumption: "holds if Q_t is symmetric" |

Already confirmed with hand-built matrices in `spikes/lecture8_probe.mjs` (§G): rows 3, 4, 6, 10, 11 and 12, the Joseph form, B1, B2, and the gradient case of B4. Parsing all of this from the LaTeX above is the first real milestone.

---

## Appendix B — Mistake catalog (mutation rules for F9a)

Generic rules (top block) run at every node. Domain rules run only where their pattern appears.

| Id | Mistake | Wrong | Right |
|---|---|---|---|
| A1 | sign flip of a term | −Cᵀ… → +Cᵀ… | — |
| A2 | factor 2 or ½ | ∇(½xᵀAx) = 2Ax | Ax (A symmetric) |
| A3 | dropped term (vs previous row) | … | re-add it |
| A4 | X⁻¹ ↔ X | (CΣ̄Cᵀ + Q⁻¹)⁻¹ | (CΣ̄Cᵀ + Q)⁻¹ |
| T1 | transpose of a product, order kept | (AB)ᵀ = AᵀBᵀ | BᵀAᵀ |
| T2 | inverse of a product, order kept | (AB)⁻¹ = A⁻¹B⁻¹ | B⁻¹A⁻¹ |
| T3 | missing or extra ᵀ on a leaf/subtree | Σ̄C(…)⁻¹ | Σ̄Cᵀ(…)⁻¹ |
| C1 | non-commuting factors swapped | KHP → HKP | — |
| C2 | non-cyclic trace permutation | tr(ABC) = tr(BAC) | tr(BCA) |
| S1 | inverse of a sum split | (A+B)⁻¹ = A⁻¹ + B⁻¹ | Woodbury |
| S2 | determinant of a sum split | det(A+B) = det A + det B | — |
| S3 | determinant of a scalar multiple | det(cA) = c·det A | cⁿ·det A |
| S4 | trace of a product split | tr(AB) = tr A·tr B | — |
| N1 | norm vs squared norm | ‖x‖ = xᵀx | ‖x‖² = xᵀx |
| N2 | Frobenius via the wrong trace | ‖A‖²_F = tr(A²) | tr(AᵀA) |
| D1 | sum bounds off by one | Σ_{i=0}^{n} | Σ_{i=1}^{n} |
| G1 | quadratic-form gradient assumes symmetry | ∇ₓxᵀAx = 2Ax (A general) | (A + Aᵀ)x |
| G2 | least-squares gradient | 2A(Ax − b) | 2Aᵀ(Ax − b) |
| G3 | layout transpose | ∂(aᵀXb)/∂X = baᵀ | abᵀ (denominator layout) |
| G4 | log-det gradient | ∂ log det X/∂X = X⁻¹ (X general) | X⁻ᵀ |
| G5 | linear-layer gradient | ∂L/∂W = xδᵀ (y = Wx) | δxᵀ |
| G6 | trace derivative | ∂tr(AX)/∂X = A | Aᵀ |
| G7 | sigmoid derivative | σ′ = σ² | σ(1 − σ) |
| G8 | softmax-CE gradient sign | e_y − softmax(z) | softmax(z) − e_y |
| G9 | chain rule missing Jacobian transpose | J g | Jᵀ g |
| P1 | Jensen swap | 𝔼[f(x)] = f(𝔼[x]) | — |
| P2 | variance scaling | Var(aX) = a·Var(X) | a²·Var(X) |
| P3 | covariance of a linear map | Cov(Ax) = AΣ | AΣAᵀ |
| P4 | second moment | 𝔼[xxᵀ] = μμᵀ | Σ + μμᵀ |
| P5 | quadratic expectation | 𝔼[xᵀAx] = μᵀAμ | tr(AΣ) + μᵀAμ |
| P6 | Gaussian conditioning sign | Σ₁₁ + Σ₁₂Σ₂₂⁻¹Σ₂₁ | Σ₁₁ − Σ₁₂Σ₂₂⁻¹Σ₂₁ |
| K1 | Joseph form missing the noise term | (I−KC)Σ̄(I−KC)ᵀ | + KQKᵀ |
| K2 | covariance update sign | (I + KC)Σ̄ | (I − KC)Σ̄ |

---

## Appendix C — Declaration syntax and grammar sketch

**Compact declarations** (CLI, MCP, `% samosa:` comments). LaTeX forms (F3) are equivalent.

```
decls  := item (';' item)*
item   := names ':' type  |  names '~' dist  |  name ':=' latex  |  dimvar '=' int
type   := 'scalar' | 'pos' | 'int' | props? dim ('×' dim)? | 'fn' dim '→' dim | 'rows(' name ')' ',' idx '=' range
props  := ('sym'|'spd'|'psd'|'orth'|'diag'|'triu'|'tril'|'skew'|'idem'|'proj'|'unit'|'stoch'|'rank' dim)+
dim    := int | identifier            ('x' is accepted for '×', '->' for '→')
dist   := 'N(' latex ',' latex ')' | 'U(' latex ',' latex ')' | 'Bern(' latex ')' | 'Cat(' latex ')'
```

```
A, B: n×n; \Sigma: spd n; x, \mu: n; H: m×n; R: spd m; \sigma: pos; f: fn n→1
x ~ N(\mu, \Sigma); K := P H^\top (H P H^\top + R)^{-1}; n = 3        # pin a size
```

**Math grammar** (Pratt, precedence per F2):

```
row      := expr (rel expr)* annotation?
rel      := '=' | ':=' | '\coloneqq' | '\Rightarrow' | '\implies' | '\iff' | '\propto' ('_' sub)? | '\le' | '\ge' | '<' | '>' | '\preceq' | '\succeq' | '\approx'
expr     := term (('+' | '-') term)*
term     := unary ((juxtapose | '\cdot' | '\times' | '\otimes' | '\odot' | '/') unary)*
unary    := ('-' | '+')? postfix
postfix  := primary ('^' sup | '_' sub | "'" | '!')*
primary  := number | symbol | '(' expr ')' | '\left' … '\right' | '\frac{' expr '}{' expr '}' | '\sqrt' … | call | matrixEnv
          | norm | bars | inner | deriv | expect | bigop
deriv    := '\frac{\partial' ('^' order)? expr '}{' dvar+ '}' | '\nabla' ('_' sub)? ('^2')? primary | '\mathrm{d}' primary
dvar     := '\partial' symbol ('^' order | '^\top')?      // inside a ∂-denominator, x^2 is a derivative order, never a power
expect   := ('\mathbb{E}' | '\operatorname{Var}' | '\operatorname{Cov}') ('_' sub)? '[' expr (',' expr)? ']'
bigop    := ('\sum' | '\prod') '_' '{' idx '=' expr '}' '^' sup primary
```

---

## Appendix D — MCP and Skill details

```ts
// mcp/server.ts (sketch)
const server = new McpServer({ name: 'samosa', version });
server.registerTool('check_derivation', {
  title: 'Check a derivation step by step',
  description: 'Checks every step of a LaTeX derivation (matrix algebra, gradients, Gaussian expectations) by exact finite-field / 50-digit evaluation. Returns per-step verdicts, counterexamples and fixes. No AI involved.',
  inputSchema: { latex: z.string(), declarations: z.string().optional(), preset: z.string().optional(), seed: z.number().int().optional() },
  outputSchema: reportSchema,
}, async (a) => {
  const report = check(a.latex, { decls: a.declarations, preset: a.preset, seed: a.seed });
  return { content: [{ type: 'text', text: summarize(report) }], structuredContent: toJson(report) };
});
// check_step, check_gradient, find_counterexample: same shape
await server.connect(new StdioServerTransport());
```

Example `structuredContent` for Appendix A with bug B2:

```json
{ "summary": "12 rows: 7 ✓, 1 ✗ (row 12), 4 defined",
  "steps": [{ "row": 12, "verdict": "wrong", "mode": "exact",
              "message": "not equal; the RHS is missing + K_t Q_t K_t^T (Joseph form)",
              "counterexample": { "dims": { "n": 2, "m": 1 }, "numpy": "import numpy as np\n…" },
              "fixes": [{ "kind": "residual", "title": "add + K_t Q_t K_t^\\top", "verified": true }] }],
  "shareUrl": "https://samosa-math.vercel.app/#v1.eNq…" }
```

`skill/samosa/SKILL.md`:

```markdown
---
name: samosa
description: Check matrix-algebra, matrix-calculus, gradient and expectation derivations step by step with SAMOSA before presenting them. Use whenever you derive or verify math with matrices, gradients, Kalman / least-squares / backprop updates, or Gaussian expectations.
---
# Check derivations with SAMOSA
1. Write the derivation as one LaTeX `align*` block, one step per row (`&=` continuation rows are fine).
2. Declare symbols in a first comment line, e.g. `% samosa: A: n×n; \Sigma: spd n; x: n`.
3. Check: MCP tool `check_derivation`, or `npx -y -p samosa-math samosa check - --format json < derivation.tex`.
4. Fix every ✗ or ⊘ row using the returned counterexample and fixes, then re-check. Never present a derivation that still has ✗/⊘ rows.
5. If any row is `?`, tell the user which rows SAMOSA could not check and why.
6. Include the returned share link so the user can inspect each step.
```

---

## Appendix E — CLI output formats

```
paper/appendix.tex
  132:18  ✗ wrong    align@130 row 3  not equal: the RHS is missing + K Q Kᵀ (counterexample n=2, m=1)  samosa/not-equal
  141:5   ⊘ shape    align@140 row 2  (n×n)(m×n): inner sizes n ≠ m. Did you mean C^\top?            samosa/shape
  150:1   ? skipped  align@150 row 1  inequalities (≤) are not checked in v1                          samosa/unchecked
✗ 1 wrong · ⊘ 1 shape · ? 1 unchecked · ✓ 41 · 38 ms
```

| SARIF field | Source |
|---|---|
| `ruleId` | `samosa/not-equal`, `samosa/shape`, `samosa/inconclusive`, `samosa/unchecked` |
| `level` | error, error, warning, note |
| `locations[].physicalLocation.region` | step span → start/end line and column |
| `partialFingerprints.samosa/v1` | step hash (stable across reruns) |
| `properties` | mode, bound, seed, dims |

GitHub format: `::error file=paper/appendix.tex,line=132,col=18,title=SAMOSA ✗ wrong::not equal: the RHS is missing + K Q Kᵀ`

---

## Appendix F — Launch drafts

**Show HN first comment.** The bracketed parts are yours to fill.

> Hi HN, I'm [one line about you]. SAMOSA started with my Mobile Robotics notes. The Kalman filter derivation says "after some algebraic manipulation we may obtain K = Σ̄Cᵀ(CΣ̄Cᵀ+Q)⁻¹", and that's the one step nobody ever checks.
>
> SAMOSA is a linter for derivations. Paste LaTeX (or a ChatGPT answer). Each step gets ✓, a ✗ with a 2×2 counterexample and a suggested fix, or a shape error.
>
> How it works (no LLM anywhere in the checking):
> - It never manipulates symbols. It samples random instances of your declared objects (matrices with the right shapes and structure) and evaluates both sides of every step.
> - Steps that use only rational operations (+, ×, inverse, transpose, det, trace, gradients of those) are evaluated exactly over GF(2³¹−1). By Schwartz–Zippel, a wrong step survives a trial with probability ≤ d/p, where d is a degree bound SAMOSA computes. Each ✓ shows the resulting bound for every matrix size it tested (6 independent trials per size), usually below 10⁻⁴⁰.
> - Gradients are checked with dual numbers. Gaussian expectations of low-degree polynomials use a 5-point rational quadrature rule (atoms 0, ±1, ±2; exact through degree 5), so they're exact too. Everything else runs in 50-digit arithmetic.
> - A ✗ comes with a shrunk counterexample (QuickCheck-style), "Copy as NumPy", and fixes found by mutating your expression with ~35 common mistakes ((AB)ᵀ order, a missing +KQKᵀ, 2Ax vs (A+Aᵀ)x, …).
>
> What it can't do yet: inequalities, limits, non-polynomial expectations, and plenty of notation. When it doesn't understand something, it says "?" instead of guessing.
>
> There's also a CLI/GitHub Action that lints `align` blocks in papers, and an MCP server so Claude Code or Codex can check their own math. It's MIT-licensed and runs entirely in your browser; share links live in the URL fragment. I'd love the notation it chokes on: every failure has a one-click "report this" button.

**r/MachineLearning:** `[P] SAMOSA: a linter for matrix-calculus derivations (exact finite-field checks, dual-number gradients, counterexamples; no LLM)`. Body: a 3-sentence version of the above, the backprop GIF, the MCP angle, and "feedback on notation welcome".

**r/robotics:** `I built a checker for Kalman filter derivations: paste LaTeX, get the wrong line plus a 2×2 counterexample`. Body: the Lecture 8 story and the Joseph-form GIF.

**X/Bluesky thread (4 posts):**
1. Hook GIF: "Find the wrong step in your derivation."
2. How: finite fields + Schwartz–Zippel.
3. The ChatGPT Kalman example.
4. Links: app, repo, MCP.

---

## Appendix G — Spike evidence (`node spikes/<file>`)

`gfp_probe.mjs` validates that modmul is exact against BigInt on 10⁵ pairs, then prints:

```
EQUAL      (AB)^T = B^T A^T  (true)
NOT EQUAL  (AB)^T = A^T B^T  (false)
EQUAL      Joseph form = (I-KH)P  (true, K optimal)
NOT EQUAL  Joseph form w/o KRK^T  (false)
EQUAL      Woodbury identity  (true)
```

`lecture8_probe.mjs` covers your Lecture 8 with n = 3, m = 2, using hand-built matrices and dual numbers:

```
Q symmetric (as declared in the lecture):
  EQUAL      dJ/dx = -C^T Q^-1 (z - Cx) + Sb^-1 (x - mub)   [dual numbers, direction v]
  EQUAL      d2J/dx2 = C^T Q^-1 C + Sb^-1                   [dual of the gradient, dir w]
  EQUAL      stationarity: dJ/dx at x = mu_t is 0
  EQUAL      K = (C^T Q^-1 C + Sb^-1)^-1 C^T Q^-1 = Sb C^T (C Sb C^T + Q)^-1
  EQUAL      Sigma_t = (I - K C) Sb
  EQUAL      Joseph: Sigma_t = (I-KC) Sb (I-KC)^T + K Q K^T
  NOT EQUAL  PLANTED: Joseph without + K Q K^T
  NOT EQUAL  PLANTED: K = Sb C^T (C Sb C^T + Q^-1)^-1
Q NOT declared symmetric (missing-assumption demo):
  NOT EQUAL  dJ/dx = -C^T Q^-1 (z - Cx) + Sb^-1 (x - mub)   [dual numbers, direction v]
  EQUAL      d2J/dx2 = C^T Q^-1 C + Sb^-1                   [dual of the gradient, dir w]
  EQUAL      stationarity: dJ/dx at x = mu_t is 0
```

(The last two pass in the spike because they're checked against the *claimed* gradient. The product differentiates J itself, so B4 fails rows 3, 4 and 6; see Appendix A.)

`parse_probe.mjs` runs unified-latex 1.8.4 on an `align` block. It needs the package installed in a separate directory, passed as an argument.
- Leaf tokens carry offsets (e.g. `\Sigma [88-94]`).
- `argument` wrappers have none.
- `k|k-1` becomes one string token `"k|k"` plus `"-"` and `"1"`.
- `\hat` doesn't take `{x}` as its argument.
- Conclusion: use our own tokenizer, and unified-latex only for document-level extraction in the CLI.

`quadrature_check.py` uses exact fractions:
- the 5-point and 7-point Gaussian rules are exact through degrees 5 and 7
- Simpson and Boole are exact through 3 and 5
- applying the §3.3 degree rules to Lecture 8 row 11 gives d = 25, 23 and 43 at the three default sizes, so the worst-size bound is 6.45×10⁻⁴⁷

**Not yet tested:** parsing from text, shrinking, numeric mode, repairs, UI, performance at scale.

---

## Appendix H — Sources

- STACK, reasoning by equivalence: https://docs.stack-assessment.org/en/Specialist_tools/Equivalence_reasoning/Equivalence_reasoning/
- CheckMySteps (Georgia Tech): https://justinmath.com/checkmysteps/
- WeBWorK MathObjects answer checkers (random test points): https://webwork.maa.org/pod/pg/doc/MathObjectsAnswerCheckers.html
- matrixcalculus.org (computes derivatives; Laue, Mitterreiter, Giesen, NeurIPS 2018): https://www.matrixcalculus.org/
- Schwartz–Zippel lemma: https://en.wikipedia.org/wiki/Schwartz%E2%80%93Zippel_lemma
- KaTeX supported functions (`\htmlClass`, `trust`, `strict`): https://katex.org/docs/supported.html
- Show HN guidelines: https://news.ycombinator.com/showhn.html
- unified-latex: https://github.com/siefkenj/unified-latex
- Claude Code skills (Agent Skills standard): https://code.claude.com/docs/en/skills · https://agentskills.io
- The Matrix Cookbook (Petersen & Pedersen): https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf
- Hyper-dual numbers: Fike & Alonso, AIAA 2011 · Isabelle Nitpick/Quickcheck (counterexample generators) · Hypothesis (shrinking): https://hypothesis.readthedocs.io
- Website references: https://ampcode.com (structure) · https://ghostty.org (ASCII hero) · https://charm.sh · https://opencode.ai · https://factory.ai
- npm packages: `@codemirror/lint`, `katex`, `decimal.js`, `fflate`, `fast-check`, `@modelcontextprotocol/sdk`, `@unified-latex/*`, `mathlive` (later)
