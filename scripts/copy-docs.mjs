import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Marked } from 'marked';

/**
 * The documentation is served with the site.
 *
 * The pages in `docs/` and the changelog are plain Markdown. Each one is
 * copied into `public/docs` as it is, for anyone who wants the source, and is
 * also rendered into an HTML page in the colours of the site, which is what
 * the landing page links to. A raw `.md` file opens as plain text, or as a
 * download, and that is a poor first click from a landing page.
 *
 * The render happens at build time, so nothing ships to the browser for it,
 * and the page has no script but the boot file that picks the theme.
 */

const root = resolve(import.meta.dirname, '..');
const from = resolve(root, 'docs');
const to = resolve(root, 'public/docs');
const REPO = 'https://github.com/Hussain004/SAMOSA/blob/master';

/** The pages, in the order the navigation lists them. */
const ORDER = ['HOW_IT_WORKS', 'NOTATION', 'CLI', 'MCP', 'COOKBOOK', 'COVERAGE', 'LEDGER', 'PRIVACY', 'CHANGELOG'];

const sources = new Map();
for (const name of readdirSync(from)) {
  if (name.endsWith('.md')) sources.set(name.slice(0, -3), resolve(from, name));
}
sources.set('CHANGELOG', resolve(root, 'CHANGELOG.md'));

const titles = new Map();
for (const [name, path] of sources) {
  const heading = /^#\s+(.+)$/m.exec(readFileSync(path, 'utf8'));
  titles.set(name, heading ? heading[1].trim() : name);
}

/**
 * A link of the Markdown, made to work on the site: another doc is its
 * rendered page, and anything else in the repository is its page on GitHub.
 */
function siteHref(href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [path, hash] = href.split('#');
  const doc = /(?:^|\/)([A-Z_]+)\.md$/.exec(path);
  if (doc && sources.has(doc[1])) return `/docs/${doc[1]}${hash ? `#${hash}` : ''}`;
  const inRepo = path.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  return `${REPO}/${path.startsWith('../') ? inRepo : `docs/${inRepo}`}${hash ? `#${hash}` : ''}`;
}

const marked = new Marked({
  gfm: true,
  walkTokens(token) {
    if (token.type === 'link') token.href = siteHref(token.href);
  },
});

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(name, body) {
  const nav = ORDER.filter((n) => sources.has(n))
    .map((n) => `<a href="/docs/${n}"${n === name ? ' aria-current="page"' : ''}>${escape(titles.get(n))}</a>`)
    .join('\n        ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(titles.get(name))} · SAMOSA</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script src="/samosa-boot-landing.js"></script>
    <style>${STYLE}</style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">∇ SAMOSA</a>
      <span class="spacer"></span>
      <a href="${REPO.replace('/blob/master', '')}">GitHub</a>
      <a class="open" href="/app">Open the app →</a>
    </header>
    <div class="layout">
      <nav aria-label="The documentation">
        ${nav}
      </nav>
      <main>
        ${body}
        <p class="source">This page is <a href="/docs/${name}.md">${name}.md</a>, rendered.</p>
      </main>
    </div>
  </body>
</html>
`;
}

const STYLE = `
:root{--ink:#0b0a08;--panel:#14120f;--line:#2a251e;--text:#ede6da;--muted:#a69b8a;--gold:#e8b04b;--code:#1c1915;color-scheme:dark}
:root[data-theme=light]{--ink:#fbf8f1;--panel:#f4efe4;--line:#d9d0bf;--text:#221d17;--muted:#5c5347;--gold:#73500d;--code:#efe8da;color-scheme:light}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--text)}
body{font:calc(15px * var(--font-scale,1))/1.7 ui-monospace,"Geist Mono","SF Mono",Menlo,Consolas,monospace}
a{color:var(--gold);text-underline-offset:3px}
header{display:flex;align-items:center;gap:20px;padding:16px 24px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--ink)}
header a{color:var(--muted);text-decoration:none}
header a:hover{color:var(--text)}
header .brand{color:var(--gold);letter-spacing:.2em}
header .open{background:var(--gold);color:var(--ink);padding:6px 12px;border-radius:4px}
header .open:hover{color:var(--ink);opacity:.9}
.spacer{flex:1}
.layout{display:grid;grid-template-columns:220px minmax(0,760px);gap:48px;max-width:1100px;margin:0 auto;padding:40px 24px 80px}
nav{display:flex;flex-direction:column;gap:6px;position:sticky;top:90px;align-self:start;font-size:.875em}
nav a{color:var(--muted);text-decoration:none;padding:2px 0}
nav a:hover,nav a[aria-current]{color:var(--text)}
nav a[aria-current]{border-left:2px solid var(--gold);padding-left:8px;margin-left:-10px}
main{min-width:0;overflow-wrap:anywhere}
main pre,main pre code{overflow-wrap:normal}
main h1{font-size:1.9em;line-height:1.2;margin:0 0 .8em;font-weight:500}
main h2{font-size:1.3em;margin:2em 0 .6em;font-weight:500;padding-top:1em;border-top:1px solid var(--line)}
main h3{font-size:1.05em;margin:1.6em 0 .4em;font-weight:600}
main p,main li{color:var(--text)}
main code{background:var(--code);padding:.1em .35em;border-radius:3px;font-size:.92em}
main pre{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px;overflow-x:auto;line-height:1.5}
main pre code{background:none;padding:0}
main table{border-collapse:collapse;width:100%;font-size:.92em;display:block;overflow-x:auto}
main th,main td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
main th{background:var(--panel);font-weight:600}
main blockquote{margin:1em 0;padding:.2em 1em;border-left:3px solid var(--gold);color:var(--muted)}
main hr{border:0;border-top:1px solid var(--line);margin:2em 0}
.source{margin-top:4em;color:var(--muted);font-size:.85em}
@media (max-width:820px){.layout{grid-template-columns:minmax(0,1fr);gap:24px;padding:24px 16px 64px}nav{position:static;flex-direction:row;flex-wrap:wrap;gap:6px 16px}nav a[aria-current]{border-left:0;margin-left:0;padding-left:0;text-decoration:underline}header{gap:12px;padding:12px 16px}}
`;

mkdirSync(to, { recursive: true });
for (const [name, path] of sources) {
  const markdown = readFileSync(path, 'utf8');
  cpSync(path, resolve(to, `${name}.md`));
  writeFileSync(resolve(to, `${name}.html`), page(name, marked.parse(markdown)));
}
console.log(`the documentation is rendered into public/docs: ${sources.size} pages`);
