import { describe, expect, it } from 'vitest';
import { PROBES, COUNTS } from '../bench/probes.ts';

/**
 * The structural half of SAMOSA-Bench: the probe list itself. The engine
 * verdicts are measured by bench/samosa-bench.ts (and gated there); this
 * test keeps the map honest without paying for 137 engine runs in CI.
 */
describe('SAMOSA-Bench probes', () => {
  it('projects both measured corpora completely', () => {
    expect(COUNTS.true).toBeGreaterThanOrEqual(94);
    expect(COUNTS.false).toBeGreaterThanOrEqual(43);
    expect(COUNTS.total).toBe(COUNTS.true + COUNTS.false);
    expect(PROBES.length).toBe(COUNTS.total);
  });

  it('has stable, unique ids', () => {
    const ids = PROBES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^(true|false)-[a-z0-9-]+$/);
    }
  });

  it('marks every probe with the expected verdict and a name', () => {
    for (const probe of PROBES) {
      expect(['ok', 'wrong']).toContain(probe.expect);
      expect(probe.name.length).toBeGreaterThan(3);
      expect(probe.latex.trim().length).toBeGreaterThan(0);
      // the two buckets never mix their expectations with their sources
      expect((probe.source === 'cookbook') === (probe.expect === 'ok')).toBe(true);
    }
  });

  it('keeps the buckets in the shape the README claims', () => {
    expect(PROBES.filter((p) => p.expect === 'ok').length).toBe(COUNTS.true);
    expect(PROBES.filter((p) => p.expect === 'wrong').length).toBe(COUNTS.false);
  });
});
