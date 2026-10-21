---
name: samosa
description: Check matrix-algebra, matrix-calculus, gradient and expectation derivations step by step with SAMOSA before presenting them. Use whenever you derive or verify math with matrices, gradients, Kalman or least-squares or backprop updates, or Gaussian expectations.
---

# Check derivations with SAMOSA

SAMOSA is a linter for math derivations. It samples the objects a
derivation talks about, evaluates both sides of every step, and reports a
verdict with a guarantee. There is no model in the loop, so the verdict is
reproducible.

## How to use it

1. Write the derivation as one LaTeX `align*` block, one step per row.
   Continuation rows (`&=`) are fine.
2. Declare the symbols in a first comment line:

   ```latex
   % samosa: A: n×n; \Sigma: spd n; x: n
   ```

   The compact syntax is `names: type`, where the type is `n`, `n×m`, `spd n`,
   `sym n`, `orth n`, `scalar`, `fn n→1` or a distribution such as
   `x ~ N(\mu, \Sigma)`.
3. Check it, with the MCP tool `check_derivation`, or with the CLI:

   ```bash
   npx -y -p samosa-math samosa check - --format json < derivation.tex
   ```
4. Fix every row marked `wrong` or `shape`, using the counterexample and the
   fixes in the report. Then check it again.
5. Never present a derivation that still has a `wrong` or a `shape` row.
6. If a row comes back as `unchecked`, say so, and say why: SAMOSA does not
   check inequalities, limits or non polynomial expectations.
7. Include the share link from the report, so the person can open every step.

## What the verdicts mean

| Verdict | Meaning |
| --- | --- |
| `ok` | the step holds at every size tested; the card carries the bound |
| `wrong` | a counterexample was found; the report has the values and a fix |
| `shape` | the shapes do not fit; the message says which ones do not |
| `inconclusive` | the two sides differ, but not enough to call it wrong |
| `unchecked` | SAMOSA did not check this row, and the reason says why |
| `defined` | the row defines a symbol, so there is nothing to check |

## The declarations

```latex
% samosa: x_t, \bar\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \bar\Sigma_t: spd n
```

* `n` is a column vector of size n, `m×n` is a matrix.
* `spd` is symmetric positive definite, `sym` symmetric, `orth` orthogonal,
  `diag` diagonal, `skew` skew symmetric, `pos` a positive scalar.
* `x ~ N(\mu, \Sigma)` is a normal random variable.

Every assumption matters. If a step only holds because a matrix is
symmetric, declare it symmetric, otherwise SAMOSA will report the step as
wrong, and it will be right to do so.

## Notes

* The same input and seed always give the same verdict, so a report can be
  quoted.
* A checkmark is never given without a bound: the card lists the sizes, the
  trials, the primes and the degree.
* Nothing leaves the machine. The CLI reads files, the MCP server talks over
  the standard input, and the share link keeps the derivation in the
  fragment of the URL.
