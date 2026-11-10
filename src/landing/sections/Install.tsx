import { useState } from 'react';
import { SectionHead, CopyChip } from './common.tsx';

const TABS = [
  {
    id: 'web',
    label: 'Web',
    body: 'Paste a derivation, or start from the menu. Nothing to install.',
    snippet: 'https://samosa-math.vercel.app/app',
  },
  {
    id: 'cli',
    label: 'CLI',
    body: 'The CLI reads a paper, a note or the standard input, and prints the verdicts in the format you ask for.',
    snippet: 'npx samosa-math check paper.tex --format sarif',
  },
  {
    id: 'claude',
    label: 'Claude Code',
    body: 'The MCP server gives an agent the same engine, with the counterexamples and the fixes.',
    snippet: 'claude mcp add samosa -- npx -y -p samosa-math samosa-mcp',
  },
  {
    id: 'codex',
    label: 'Codex',
    body: 'The same server, in the config file Codex reads.',
    snippet: '[mcp_servers.samosa]\ncommand = "npx"\nargs = ["-y", "-p", "samosa-math", "samosa-mcp"]',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    body: 'The same server, in the config file Cursor reads.',
    snippet: '{ "mcpServers": { "samosa": { "command": "npx", "args": ["-y", "-p", "samosa-math", "samosa-mcp"] } } }',
  },
  {
    id: 'skill',
    label: 'Skill',
    body: 'The Agent Skill lives in the repository, and it teaches an agent how to write a derivation SAMOSA can check.',
    snippet: 'npx skills add Hussain004/SAMOSA',
  },
  {
    id: 'action',
    label: 'GitHub Action',
    body: 'The action checks every paper in a pull request, and a wrong step fails the build.',
    snippet: '- uses: Hussain004/SAMOSA@v1\n  with:\n    path: "paper/**/*.tex"\n    fail-on: "wrong,shape"',
  },
];


export function Install() {
  const [tab, setTab] = useState(0);
  return (
    <section className="dotted" id="install">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="install"
          body="The web app requires no installation. The CLI and the MCP server ship as one npm package."
        />
        <div className="mt-10 flex flex-wrap gap-1.5">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTab(i)}
              className={`rounded px-3 py-1.5 text-[0.75rem] ${
                i === tab
                  ? 'bg-[var(--color-gold)] text-[var(--color-ink)]'
                  : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-gold)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-4 max-w-[640px] text-[0.8125rem] leading-relaxed text-[var(--color-muted)]">
          {TABS[tab].body}
        </p>
        <div className="mt-3">
          <CopyChip text={TABS[tab].snippet} />
        </div>
      </div>
    </section>
  );
}

