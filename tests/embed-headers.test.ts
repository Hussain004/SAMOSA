import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The embed route, statically.
 *
 * /embed is designed to be framed by anybody; /app/ is not, and the app's
 * content security policy is the reason nothing may frame it. These are the
 * parts of vercel.json the deployment depends on, checked as JSON so they
 * cannot drift silently.
 */

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const config = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8')) as {
  headers: HeaderRule[];
};

const ruleFor = (source: string): HeaderRule | undefined =>
  config.headers.find((rule) => rule.source === source);

const valueOf = (rule: HeaderRule | undefined, key: string): string =>
  rule?.headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value ?? '';

describe('the vercel headers', () => {
  it('serves /embed with a policy that allows framing anywhere', () => {
    const embed = ruleFor('/embed');
    expect(embed, '/embed needs its own rule').toBeDefined();
    const csp = valueOf(embed, 'Content-Security-Policy');
    expect(csp).toContain('frame-ancestors *');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(valueOf(embed, 'Referrer-Policy')).toBe('no-referrer');
  });

  it("does not let /embed match the app's catch-all", () => {
    const catchAll = config.headers.find((rule) => rule.source.includes('(?!embed)'));
    expect(catchAll, 'the catch-all must exclude /embed').toBeDefined();
    expect(valueOf(catchAll, 'Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('keeps the app frame-sealed', () => {
    const app = config.headers.find((rule) => rule.source.includes('(?!embed)'));
    expect(valueOf(app, 'Content-Security-Policy')).toContain("connect-src 'self'");
  });
});
