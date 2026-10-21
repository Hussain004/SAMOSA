#!/usr/bin/env node
/**
 * The ten good first issues.
 *
 * They are the things a new contributor can do without touching the core of
 * the engine: an operator, a distribution, a preset, a Menu item, a
 * declaration, a notation, a report format, a document, a repair, a test.
 */

import { execFileSync } from 'node:child_process';

const ISSUES = [
  {
    title: 'Add a matrix function to the engine',
    labels: ['good first issue', 'engine'],
    body: `The engine knows a set of matrix operations: addition, multiplication,
the inverse, the transpose, the determinant, the trace, the adjugate, the
Kronecker and the Hadamard product, the inner product, the vectorisation
and the diagonal.

Pick one that is missing and add it:

1. the operator in \`src/core/ir.ts\` and in \`src/core/linalg.ts\`
2. the evaluation in \`src/core/evaluate.ts\`
3. the type rule in \`src/core/types.ts\`
4. the degree bound in \`src/core/types.ts\`, if the operation is not linear
5. a test in \`tests/\`

Good candidates: the matrix square root, the matrix exponential, the trace
of a product, the singular value decomposition, the condition number.

Keep the arithmetic generic over the field, so it works over a finite field
as well as over the reals.`,
  },
  {
    title: 'Add a distribution to the expectation engine',
    labels: ['good first issue', 'engine'],
    body: `The expectation engine knows the normal distribution, the uniform
distribution and the Bernoulli distribution, using rational quadrature rules
so the answer is exact.

Add one more:

1. the rule in \`src/core/quadrature.ts\`
2. the sampling in \`src/core/verdict.ts\`
3. the declaration syntax in \`src/core/decl.ts\`
4. a test with an identity that holds exactly

A categorical distribution, a Poisson distribution and a Laplace
distribution are all reasonable. The rule has to be exact for polynomials, so
the atoms and the weights are rational.`,
  },
  {
    title: 'Add a preset',
    labels: ['good first issue', 'engine'],
    body: `The presets are in \`src/core/presets.ts\`. Each one is a set of
declarations for a piece of notation people use.

Add one: the Kalman filter in a different convention, the particle filter,
the Poisson equation, the backpropagation of a convolutional layer, the
softmax classifier, the ridge regression.

A preset is a name, a one line hint and a block of declarations in the
compact syntax. Add a line to the preset table in the docs when you are
done.`,
  },
  {
    title: 'Add a derivation to the Menu',
    labels: ['good first issue', 'menu'],
    body: `The Menu lives in \`corpus/menu.ts\`. Every entry has a correct
version and a planted bug, and it is part of the golden test suite.

Add one. Good candidates:

- the matrix inverse lemma
- the Cholesky factorisation
- the QR decomposition
- the Fisher information
- the Fisher-Yates transform
- the Hutchinson trace estimator
- the matrix exponential of a nilpotent matrix
- the gradient of a matrix exponential

Rules:

1. the correct version must pass with no false checkmark
2. the planted bug must be caught on the right row
3. the declarations must be enough for SAMOSA to know the shapes`,
  },
  {
    title: 'Teach the parser a piece of notation',
    labels: ['good first issue', 'notation'],
    body: `SAMOSA reads the LaTeX that people actually write, and it says
"?" when it meets something it does not know.

The measurement in [docs/COVERAGE.md](docs/COVERAGE.md) lists what stops
the rest of a real paper. Pick one:

- the conditional bar, \`\\mid\`
- the norm with a subscript, \`\\|A\\|_F\`
- the inner product with one argument
- the authors' own macros, which needs the \`\\newcommand\` expansion

The work is in \`src/core/parse.ts\` (the grammar), \`src/core/notation.ts\`
(the accents) and \`src/core/lex.ts\` (the tokens).

A good first contribution adds the construct, a test in \`tests/parse.test.ts\`
and a line in \`docs/NOTATION.md\`.`,
  },
  {
    title: 'Add a declaration form',
    labels: ['good first issue', 'engine'],
    body: `The declaration parser reads the LaTeX forms and the compact
syntax, in \`src/core/decl.ts\`.

Add one that people write:

- a block diagonal matrix
- a matrix with a given sparsity pattern
- a vector of ones, \`\\mathbf{1}_n\`
- a matrix from a Cholesky factor
- a random variable with a Poisson distribution

A declaration needs a type, a shape and, when it matters, a property. Add a
test with a derivation that only checks when the declaration is right.`,
  },
  {
    title: 'Add a report format to the CLI',
    labels: ['good first issue', 'cli'],
    body: `The CLI prints four formats: \`pretty\`, \`json\`, \`sarif\` and
\`github\`. The code is in \`cli/format.ts\` and the wiring is in
\`cli/bin.ts\`.

Add one:

- \`junit\`, for a CI that speaks JUnit
- \`checkstyle\`, for the older XML format
- \`markdown\`, for a report that goes in a pull request

The format has to name the file, the line, the column and the verdict, so
that a person can find the row.`,
  },
  {
    title: 'Document a piece of notation in the docs',
    labels: ['good first issue', 'docs'],
    body: `The notation reference is [docs/NOTATION.md](docs/NOTATION.md).
It lists what SAMOSA reads and how.

Add the pieces that are missing, with a short example each. The ones the
coverage measurement found are the most useful: the conditional bar, the
norms, the inner product, the macros.

A line per construct, with a one line example, is enough.`,
  },
  {
    title: 'Add a repair rule to the mistake catalog',
    labels: ['good first issue', 'engine'],
    body: `The mistake catalog is the list of mistakes SAMOSA tries to fix
when a step is wrong. It is in \`src/core/repair.ts\`, and the rules live in
the same file.

Add one:

- a dropped transpose, which is in the catalog already
- a sign flip
- a factor of two
- the inverse of a product in the wrong order
- the trace of a product in the wrong order
- a missing assumption of symmetry

A rule has an id, a title, and a function that takes a node and returns the
mutated one, or null when the rule does not apply. Every candidate is
re-checked before it is offered, so a wrong rule cannot produce a wrong
fix.`,
  },
  {
    title: 'Write a test for a piece of the engine',
    labels: ['good first issue', 'tests'],
    body: `The test suite is in \`tests/\`, and the golden suite is the Menu.

Pick a piece of the engine that has no test and write one. Good candidates:

- the declarations: a table of inputs and the shapes they produce
- the degree bounds: a table of expressions and the bound they get
- the size schedule: what sizes a step with two dimension variables gets
- the quadrature rules: the moments they match
- the parser: the precedence of the operators

A test that fails on a bug is worth more than a test that passes on
everything. If you find a bug while writing it, that is a pull request too.`,
  },
];

for (const issue of ISSUES) {
  try {
    execFileSync(
      'gh',
      [
        'issue',
        'create',
        '--repo',
        'Hussain004/SAMOSA',
        '--title',
        issue.title,
        '--body',
        issue.body,
        ...issue.labels.map((l) => `--label=${l}`),
      ],
      { stdio: 'ignore' },
    );
    console.log(`created: ${issue.title}`);
  } catch (error) {
    console.error(`failed: ${issue.title}`);
  }
}
