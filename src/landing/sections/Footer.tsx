export function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto grid max-w-[1560px] gap-8 px-6 lg:px-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-gold)]">
            <span className="text-lg leading-none">∇</span>
            <span className="text-sm tracking-[0.2em]">SAMOSA</span>
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
            A step auditor for matrix algebra, stochastics and algebra. MIT licensed.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[0.75rem] text-[var(--color-chutney)]">
            <span>●</span> all checks local, nothing uploaded
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            ['The app', '/app'],
            ['The menu', '/app#menu'],
            ['How it works', '/docs/HOW_IT_WORKS'],
          ]}
        />
        <FooterColumn
          title="Docs"
          links={[
            ['Notation', '/docs/NOTATION'],
            ['The CLI', '/docs/CLI'],
            ['The MCP server', '/docs/MCP'],
            ['VS Code', '/docs/VSCODE'],
            ['Privacy', '/docs/PRIVACY'],
          ]}
        />
        <FooterColumn
          title="Community"
          links={[
            ['GitHub', 'https://github.com/Hussain004/SAMOSA'],
            ['Discussions', 'https://github.com/Hussain004/SAMOSA/discussions'],
            ['Cite', 'https://github.com/Hussain004/SAMOSA/blob/main/CITATION.cff'],
          ]}
        />
      </div>
      <div className="border-t border-[var(--color-line)] px-6 lg:px-10 py-6 text-center text-[0.6875rem] text-[var(--color-faint)]">
        ∇ SAMOSA · open source, MIT licensed
      </div>
    </footer>
  );
}

export function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="pane-title">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-[0.8125rem] text-[var(--color-muted)]">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="hover:text-[var(--color-text)]">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

