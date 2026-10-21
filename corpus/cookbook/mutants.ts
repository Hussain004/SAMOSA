import { parseRow } from '../../src/core/parse.ts';
import { splitRows } from '../../src/core/steps.ts';
import { renderNode } from '../../src/core/render.ts';
import { MUTATIONS, replaceAt, walk } from '../../src/core/repair.ts';
import type { Node } from '../../src/core/ir.ts';
import type { Identity } from './identities.ts';

/**
 * The mutants of the Cookbook.
 *
 * A mutant is a derivation with one mistake in it, taken from the mistake
 * catalog: the same list the repairs use, seen from the other side. So a
 * mutant that the engine does not catch is a real failure, and not a
 * mutant that happens to be true.
 */

export interface Mutant {
  /** the identity it comes from */
  id: string;
  /** the row the mistake is on */
  row: number;
  /** the rule of the catalog that made it */
  rule: string;
  /** the derivation with the mistake in it */
  source: string;
  /** the text of the row with the mistake */
  text: string;
}

/** The mutants of one identity. */
export function mutantsOf(identity: Identity): Mutant[] {
  const out: Mutant[] = [];
  const rows = splitRows(identity.source);
  let rowIndex = 0;
  for (const row of rows) {
    const parsed = parseRow(identity.source, row.text, row.from, rowIndex);
    rowIndex++;
    if (parsed.prose || !parsed.parts.length) continue;
    for (const part of parsed.parts) {
      if (!part.rhs) continue;
      for (const { node, path } of walk(part.rhs)) {
        for (const mutation of MUTATIONS) {
          const mutated = mutation.apply(node);
          if (!mutated) continue;
          const candidate = replaceAt(part.rhs, path, mutated);
          const text = renderNode(candidate);
          if (text === renderNode(part.rhs)) continue;
          out.push({
            id: identity.id,
            row: rowIndex,
            rule: mutation.id,
            source:
              identity.source.slice(0, part.rhs.span.from) +
              text +
              identity.source.slice(part.rhs.span.to),
            text,
          });
        }
      }
    }
  }
  return out;
}

/** The mutants of every identity. */
export function allMutants(identities: Identity[]): Mutant[] {
  return identities.flatMap(mutantsOf);
}

/** The parts of a derivation, for the parts that are not rows. */
export function partsOf(source: string): Node[] {
  const out: Node[] = [];
  const rows = splitRows(source);
  let rowIndex = 0;
  for (const row of rows) {
    const parsed = parseRow(source, row.text, row.from, rowIndex);
    rowIndex++;
    for (const part of parsed.parts) {
      if (part.lhs) out.push(part.lhs);
      if (part.rhs) out.push(part.rhs);
    }
  }
  return out;
}
