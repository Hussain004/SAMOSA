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
the guarantee card, and a share link.

### `check_step`

Checks one equation, for instance `A^T A x = A^T b`.

### `find_counterexample`

Looks for small values that break an equation, and returns them with a NumPy
snippet that reproduces them.

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
