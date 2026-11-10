# The MCP server

SAMOSA ships an MCP server, so an agent can check its own matrix algebra
before it hands the derivation to you.

## The install

**Claude Code**

```bash
claude mcp add samosa -- npx -y -p samosa-math samosa-mcp
```

**Codex**, in `~/.codex/config.toml`:

```toml
[mcp_servers.samosa]
command = "npx"
args = ["-y", "-p", "samosa-math", "samosa-mcp"]
```

**Cursor**, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "samosa": {
      "command": "npx",
      "args": ["-y", "-p", "samosa-math", "samosa-mcp"]
    }
  }
}
```

## The tools

### `check_derivation`

Checks every row of a derivation.

| Input | Meaning |
| --- | --- |
| `latex` | the derivation, as a LaTeX `align` block |
| `declarations` | the declarations, in the compact syntax |
| `preset` | one of the presets |
| `seed` | the seed of the sampling |

The answer has a summary, one entry per row with the verdict, the mode and
the guarantee card, and a share link. Every step carries its exact span
`{ line, from, to }` into the source, so an agent can edit the exact text
it checked.

### `check_step`

Checks one equation, for instance `A^T A x = A^T b`.

### `find_counterexample`

Looks for small values that break an equation, and returns them with a NumPy
snippet that reproduces them.

### `suggest_declarations`

Reads a derivation nobody declared and returns what SAMOSA had to guess,
as a compact declaration string you can pass straight back to
`check_derivation`. Everything SAMOSA guessed is reported honestly:
every guessed symbol is a square matrix, and the note in the answer says
so. Declare the structure yourself (`spd`, `sym`, a vector of size `n`, a
distribution) when the guess matters.

### `explain_step`

Checks the whole derivation, then returns the explanation for one row only:
the verdict, the guarantee card, the fixes and the counterexample. Cheaper
than `check_derivation` when an agent is iterating on a single row.

```json
{ "latex": "...", "row": 9, "declarations": "x_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n" }
```

## The resources

| Resource | What it holds |
| --- | --- |
| `samosa://docs/notation` | every construct SAMOSA reads, and what it does with it |
| `samosa://cookbook` | the 94 identities the engine is measured against, by id and name |

Both ship inside the npm package, so an agent can read them without a
checkout.

## The prompt

`check-my-derivation` is the skill as a prompt: declare, check, fix, check
again, and present the result with the share link. Call it with the
derivation in the arguments, or empty with the derivation already in the
file.

## From undeclared to all-✓, in two calls

```text
→ suggest_declarations(latex)
← declarations: "A: n×n; U: n×n; C: n×n; V: n×n"  (every one a guess, honestly labelled)
→ check_derivation(latex, declarations=that string)
← 1 rows: 1 hold
```

That is the loop the skill drives: guess, check, fix what comes back wrong,
check again.

## The Agent Skill

The skill lives in `skill/samosa/SKILL.md`, and it is the short version of
this document: write the derivation as an `align` block, declare the
symbols, check it, fix everything that comes back wrong, and say which rows
SAMOSA could not check.

Copy it into `.claude/skills/samosa/SKILL.md` in your project, or point your
agent at the file.

## What the server does not do

It does not send anything anywhere. The server reads the derivation from
the tool call, checks it in the process, and answers. The share link it
returns keeps the derivation in the fragment of the URL, so the person who
opens it does not upload anything either.
