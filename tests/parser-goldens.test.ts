import { describe, expect, it } from 'vitest';
import { MENU } from '../corpus/menu.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';
import type { Assertion, Node, ParsedRow } from '../src/core/ir.ts';
import { parseRow } from '../src/core/parse.ts';
import { splitRows } from '../src/core/steps.ts';

/**
 * The parser goldens.
 *
 * Every row of the Menu and of the Cookbook is read once and its tree is
 * snapshotted. A change to the parser that reads a row differently shows up
 * as a diff, so a regression is seen rather than discovered later.
 *
 * The spans are left out of the snapshot: they are checked by the tests in
 * `strict.test.ts`, and a span moves whenever a source line is edited, which
 * would make the golden noisy without making it stronger.
 */

/** The tree, without the spans, so the snapshot is about the reading. */
function shape(node: Node): unknown {
  switch (node.k) {
    case 'num':
      return { num: `${node.value.n}/${node.value.d}` };
    case 'sym':
      return { sym: node.name };
    case 'op':
      return { op: node.op, args: node.args.map(shape) };
    case 'call':
      return { call: node.fn, args: node.args.map(shape) };
    case 'deriv':
      return {
        deriv: shape(node.f),
        wrt: node.wrt.map(shape),
        order: node.order,
        form: node.form,
      };
    case 'expect':
      return { expect: node.op, args: node.args.map(shape), over: node.over };
    case 'bigop':
      return {
        bigop: node.kind,
        idx: node.idx,
        lo: node.lo ? shape(node.lo) : null,
        hi: node.hi ? shape(node.hi) : null,
        body: shape(node.body),
      };
    case 'block':
      return { block: node.rows.map((row) => row.map(shape)) };
    case 'raw':
      return { raw: node.text };
  }
}

/** An assertion, without the spans. */
function assertion(a: Assertion | undefined): unknown {
  if (!a) return null;
  return {
    relation: a.relation,
    lhs: a.lhs ? shape(a.lhs) : null,
    rhs: a.rhs ? shape(a.rhs) : null,
  };
}

/** A row, without the spans. */
function row(parsed: ParsedRow): unknown {
  if (parsed.error) {
    return { error: parsed.error.message, parts: [] };
  }
  return {
    parts: parsed.parts.map((part) => ({
      relation: part.relation,
      proportionalTo: part.proportionalTo ?? null,
      lhs: part.lhs ? shape(part.lhs) : null,
      rhs: part.rhs ? shape(part.rhs) : null,
      premise: part.premise ? assertion(part.premise) : null,
      conclusion: part.conclusion ? assertion(part.conclusion) : null,
    })),
  };
}

interface Case {
  id: string;
  source: string;
}

const CASES: Case[] = [
  ...MENU.map((item) => ({ id: `menu/${item.id}`, source: item.source })),
  ...IDENTITIES.map((item) => ({ id: `cookbook/${item.id}`, source: item.source })),
];

describe('the parser, on every row of the Menu and the Cookbook', () => {
  for (const item of CASES) {
    const rows = splitRows(item.source);
    rows.forEach((sourceRow, index) => {
      it(`${item.id} row ${index + 1}`, () => {
        const parsed = parseRow(item.source, sourceRow.text, sourceRow.from, index);
        expect(row(parsed)).toMatchSnapshot();
      });
    });
  }
});
