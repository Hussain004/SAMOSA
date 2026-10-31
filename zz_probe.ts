import { check, explainAll } from './src/core/index.ts';

// the review's test: with an unreadable row 1, the fixes for row 2 are
// identical to the fixes when row 1 is removed
const withBad = [
  '\\begin{align*}',
  '  A &= B) \\\\',
  '  (A B)^\\top &= A^\\top B^\\top \\\\',
  '  C &= A + B \\\\',
  '  C - A &= B A',
  '\\end{align*}',
].join('\n');
const withoutBad = [
  '\\begin{align*}',
  '  (A B)^\\top &= A^\\top B^\\top \\\\',
  '  C &= A + B \\\\',
  '  C - A &= B A',
  '\\end{align*}',
].join('\n');

const r1 = check(withBad);
const r2 = check(withoutBad);
for (const s of r1.steps) console.log('withBad   ', s.id, s.verdict, '|', s.text);
for (const s of r2.steps) console.log('withoutBad', s.id, s.verdict, '|', s.text);

const id1 = r1.steps.find((s) => s.text?.includes('A^\\top B^\\top'))?.id;
const id2 = r2.steps.find((s) => s.text?.includes('A^\\top B^\\top'))?.id;
const a1 = explainAll(withBad, {}, 8, r1).get(id1!);
const a2 = explainAll(withoutBad, {}, 8, r2).get(id2!);
console.log('fixes identical:', JSON.stringify(a1?.fixes) === JSON.stringify(a2?.fixes));
console.log('  withBad   fixes:', JSON.stringify(a1?.fixes?.map((f) => f.title)));
console.log('  withoutBad fixes:', JSON.stringify(a2?.fixes?.map((f) => f.title)));
