/**
 * The contract between the checker and everything that renders it.
 *
 * These are the shapes the CLI, the app, the landing page and the tests read;
 * they used to live in `verdict.ts`, and they live here on their own so the
 * engine's modes can import them without importing each other.
 */
import type { Assertion, Node, Relation, Span } from '../ir.ts';
import type { Chip, SymbolInfo, TypeContext } from '../types.ts';

/** The build replaced the version it read from the package manifest. */
declare const SAMOSA_ENGINE_VERSION: string | undefined;

export const ENGINE_VERSION = typeof SAMOSA_ENGINE_VERSION === 'string' ? SAMOSA_ENGINE_VERSION : '0.0.0-dev';

export const DEFAULT_SEED = 0x5a305a;


export type Verdict = 'ok' | 'wrong' | 'shape' | 'inconclusive' | 'unchecked' | 'defined';

export type Mode = 'exact' | 'numeric' | 'quadrature';


export interface GuaranteeCard {
  trialsPerSize: number;
  sizes: Record<string, number>[];
  primes?: [number, number];
  degree?: number;
  bound?: number;
  maxDelta?: number;
  assumptions: string[];
  seed: number;
}


export interface Counterexample {
  dims: Record<string, number>;
  /** the values of the free symbols, the small integers a person can read */
  values: Record<string, unknown>;
  /** the values of the symbols the derivation defines, computed */
  derived?: Record<string, unknown>;
  lhs: unknown;
  rhs: unknown;
  diff: unknown;
  numpy: string;
  /**
   * The raw residues of the finite field.
   *
   * They are exact but unreadable, so they are kept out of the way: the
   * shrunk counterexample is what a person or an agent reads.
   */
  debug?: {
    residues: Record<string, unknown>;
    lhs: unknown;
    rhs: unknown;
    diff: unknown;
  };
}


export interface Fix {
  kind: 'mutation' | 'residual' | 'assumption' | 'shape';
  title: string;
  edit?: { span: Span; insert: string };
  addDecl?: string;
  verified: boolean;
  detail?: string;
  /** which side of the step the fix edits */
  side?: 'lhs' | 'rhs';
}


export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  span: Span;
  stepId?: string;
}


export interface StepResult {
  id: string;
  row: number;
  span: Span;
  /** the source text of the row */
  text?: string;
  /** the line of the source, one based, when the caller knows it */
  line?: number;
  /** the column of the source, one based */
  column?: number;
  lhsSpan?: Span;
  rhsSpan?: Span;
  relation: Relation | 'defined';
  verdict: Verdict;
  mode?: Mode;
  card: GuaranteeCard;
  message: string;
  reason?: string;
  counterexample?: Counterexample;
  fixes?: Fix[];
  annotation?: string;
  isDefinition?: boolean;
  /** a note about the layout of a gradient, when the shapes do not agree */
  layoutHint?: string;
}


export interface Report {
  version: string;
  seed: number;
  steps: StepResult[];
  symbols: SymbolInfo[];
  chips: Chip[];
  diagnostics: Diagnostic[];
  ms: number;
}


export interface CheckOptions {
  decls?: string;
  preset?: string;
  seed?: number;
  trials?: number;
  layout?: 'denominator' | 'numerator';
  /** the CLI only: a file with no display math fails the run (review 5.2) */
  requireMath?: boolean;
}


export interface Step {
  id: string;
  row: number;
  span: Span;
  /** the source text of the row */
  text: string;
  lhs?: Node;
  rhs?: Node;
  relation: Relation | 'defined';
  annotation?: string;
  isDefinition: boolean;
  defName?: string;
  premise?: Assertion;
  conclusion?: Assertion;
  /** for a proportionality, the variable it is taken in */
  proportionalTo?: string;
  /** the row could not be read, and this is why */
  unreadable?: string;
  symbols: Set<string>;
}

/** Collects the symbols an expression mentions. */

export interface Source {
  ctx: TypeContext;
  defs: Map<string, Node>;
  /** every step of the source, in order, with stable ids */
  steps: Step[];
  /** the declarations that could not be read, one message each (review 5.5) */
  declErrors: string[];
  /** a chip for every declaration that was read from prose, with its origin */
  harvested: Chip[];
}

/**
 * Builds the steps of a source.
 *
 * One function builds them for both `check` and `explain`, so a step id
 * always points at the same row. Before they were built twice, and any row
 * the parser could not read shifted every id that followed it.
 */

/** The options of one step. */
export interface StepOptions {
  seed: number;
  trials: number;
}

