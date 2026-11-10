import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/**
 * The language server, end to end.
 *
 * The extension is a thin client over this server; the test drives the
 * protocol itself: initialize, open a .tex file with a wrong row, wait for
 * the diagnostics, hover the row, ask for the quick fixes. It builds the
 * bundles first, so a stale dist never passes for a working server.
 */

const ROOT = resolve(__dirname, '..');
const DECLARATIONS =
  'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n';
const JOSEPH = `% samosa: ${DECLARATIONS}
\\begin{align*}
\\Sigma_t &:= \\left(C_t^\\top Q_t^{-1} C_t + \\bar\\Sigma_t^{-1}\\right)^{-1} \\\\
K_t &:= \\Sigma_t C_t^\\top Q_t^{-1} \\\\
\\Sigma_t &= (I - K_t C_t)\\, \\bar\\Sigma_t (I - K_t C_t)^\\top
\\end{align*}
`;

interface LspDiagnostic {
  severity: number;
  source?: string;
  message: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  data?: { stepId?: string };
}

class LspClient {
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private pending = new Map<number, (msg: unknown) => void>();
  private notifications: Array<{ method: string; params: never }> = [];
  private waiters: Array<{ method: string; resolve: (params: never) => void }> = [];

  constructor(private child: ChildProcess) {
    child.stdout!.on('data', (chunk: Buffer) => this.onData(chunk));
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString('utf8');
      const match = /Content-Length: (\d+)/.exec(header);
      if (!match) throw new Error(`no Content-Length in ${header}`);
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (this.buffer.length < start + length) return;
      const body = this.buffer.slice(start, start + length).toString('utf8');
      this.buffer = this.buffer.slice(start + length);
      this.handle(JSON.parse(body));
    }
  }

  private handle(msg: { id?: number; method?: string; params?: never }): void {
    if (msg.id !== undefined && msg.method === undefined) {
      const resolveWaiter = this.pending.get(msg.id);
      if (resolveWaiter) {
        this.pending.delete(msg.id);
        resolveWaiter(msg as never);
      }
      return;
    }
    if (msg.method) {
      const index = this.waiters.findIndex((w) => w.method === msg.method);
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        waiter.resolve(msg.params as never);
        return;
      }
      this.notifications.push({ method: msg.method, params: msg.params as never });
    }
  }

  private send(message: object): void {
    const body = JSON.stringify(message);
    this.child.stdin!.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolveWaiter, reject) => {
      this.pending.set(id, (msg) => resolveWaiter((msg as { result: T }).result));
      setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15_000);
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  waitFor<T = unknown>(method: string): Promise<T> {
    const existing = this.notifications.findIndex((n) => n.method === method);
    if (existing >= 0) {
      const [found] = this.notifications.splice(existing, 1);
      return Promise.resolve(found.params as unknown as T);
    }
    return new Promise<T>((resolveWaiter) => {
      this.waiters.push({ method, resolve: resolveWaiter as (p: never) => void });
    });
  }
}

describe('the language server, over the protocol', () => {
  let child: ChildProcess;
  let client: LspClient;
  let uri: string;
  let diagnostics: LspDiagnostic[];

  beforeAll(async () => {
    execFileSync('node', ['scripts/build-vscode.mjs'], { cwd: ROOT, stdio: 'inherit' });
    child = spawn('node', [resolve(ROOT, 'vscode/dist/server.cjs'), '--stdio'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    client = new LspClient(child);
    await client.request('initialize', {
      processId: process.pid,
      rootUri: null,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown'] },
          codeAction: {},
          publishDiagnostics: {},
        },
      },
      clientInfo: { name: 'samosa-test', version: '0.0.0' },
    });
    client.notify('initialized', {});
    uri = 'file:///tmp/samosa-test.tex';
    client.notify('textDocument/didOpen', {
      textDocument: { uri, languageId: 'latex', version: 1, text: JOSEPH },
    });
    const params = await client.waitFor<{ uri: string; diagnostics: LspDiagnostic[] }>(
      'textDocument/publishDiagnostics',
    );
    diagnostics = params.diagnostics;
  }, 120_000);

  afterAll(() => {
    client.notify('shutdown', null);
    client.notify('exit', null);
    child.kill();
  });

  it('publishes one error diagnostic for the wrong row', () => {
    expect(diagnostics).toHaveLength(1);
    const diagnostic = diagnostics[0];
    expect(diagnostic.severity).toBe(1); // Error
    expect(diagnostic.source).toBe('samosa');
    expect(diagnostic.message).toMatch(/^3:/);
  });

  it('hovers the wrong row and shows the counterexample', async () => {
    // row 3 is the fifth line (0 based 4) of this fixture
    const hover = await client.request<{ contents: { value: string } }>(
      'textDocument/hover',
      {
        textDocument: { uri },
        position: { line: 4, character: 10 },
      },
    );
    expect(hover.contents.value).toContain('row 3');
    expect(hover.contents.value).toContain('```python');
    expect(hover.contents.value).toContain('This step is wrong');
  });

  it('offers the verified fix as a quick fix', async () => {
    const actions = await client.request<
      Array<{
        title: string;
        kind?: string;
        diagnostics?: LspDiagnostic[];
        edit?: { changes?: Record<string, Array<{ newText: string }>> };
      }>
    >('textDocument/codeAction', {
      textDocument: { uri },
      range: diagnostics[0].range,
      context: { diagnostics },
    });
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions.find((a) => a.title.includes('off by exactly'));
    expect(fix, 'the verified residual fix should be offered').toBeDefined();
    expect(fix!.kind).toBe('quickfix');
    expect(fix!.edit?.changes?.[uri]).toBeDefined();
    expect(fix!.edit!.changes![uri][0].newText).toContain('K_t Q_t');
  });

  it('does not diagnose anything for a true row', async () => {
    // hover a row that holds: the card says it holds, no counterexample
    const hover = await client.request<{ contents: { value: string } }>(
      'textDocument/hover',
      {
        textDocument: { uri },
        position: { line: 2, character: 10 },
      },
    );
    expect(hover.contents.value).toContain('row 1');
    expect(hover.contents.value).not.toContain('counterexample');
  });
});
