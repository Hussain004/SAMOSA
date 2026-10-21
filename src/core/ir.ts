import type { Rational } from './rational.ts';

/** A UTF-16 range into the source text. */
export type Span = { from: number; to: number };

export type Op =
  | 'add'
  | 'sub'
  | 'neg'
  | 'mul'
  | 'div'
  | 'pow'
  | 'inv'
  | 'invT'
  | 'T'
  | 'tr'
  | 'det'
  | 'adj'
  | 'kron'
  | 'had'
  | 'inner'
  | 'norm2'
  | 'frob'
  | 'vec'
  | 'diag'
  | 'abs'
  | 'sqrtm';

export type Node =
  | { k: 'num'; value: Rational; span: Span }
  | { k: 'sym'; name: string; display: string; span: Span }
  | { k: 'op'; op: Op; args: Node[]; span: Span }
  | { k: 'call'; fn: string; args: Node[]; span: Span }
  | {
      k: 'deriv';
      f: Node;
      wrt: Node[];
      order: 1 | 2;
      form: 'grad' | 'jac' | 'hess' | 'diff';
      span: Span;
    }
  | { k: 'expect'; op: 'E' | 'Var' | 'Cov'; args: Node[]; over: string[]; span: Span }
  | {
      k: 'bigop';
      kind: 'sum' | 'prod';
      idx: string;
      lo: Node | null;
      hi: Node | null;
      body: Node;
      span: Span;
    }
  | { k: 'block'; rows: Node[][]; span: Span }
  | { k: 'raw'; text: string; span: Span };

export type Relation =
  | '='
  | ':='
  | '=>'
  | '<=>'
  | 'propto'
  | 'le'
  | 'ge'
  | 'lt'
  | 'gt'
  | 'approx'
  | 'other';

export interface Assertion {
  lhs?: Node;
  relation: Relation;
  rhs?: Node;
  /** the raw relation text, for messages */
  relText: string;
  lhsSpan?: Span;
  rhsSpan?: Span;
}

export interface RowPart extends Assertion {
  span: Span;
  /** set when the row reads "premise => conclusion" */
  premise?: Assertion;
  conclusion?: Assertion;
  /** for a proportionality, the variable it is taken in */
  proportionalTo?: string;
}

export interface ParsedRow {
  /** index of the row inside the document */
  index: number;
  span: Span;
  parts: RowPart[];
  annotation?: string;
  /** true when the row had no mathematical content */
  prose?: boolean;
}

export interface ParseError {
  message: string;
  span: Span;
}

export class ParseFailure extends Error {
  readonly span: Span;

  constructor(message: string, span: Span) {
    super(message);
    this.span = span;
  }
}
