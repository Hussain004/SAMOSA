import { check } from '../src/core/verdict.ts';
import { MENU } from '../corpus/menu.ts';

for (const item of MENU) {
  const report = check(item.source, { decls: item.decls });
  const bad = report.steps.filter((s) => s.verdict === 'wrong' || s.verdict === 'shape' || s.verdict === 'inconclusive');
  const un = report.steps.filter((s) => s.verdict === 'unchecked');
  console.log(item.id.padEnd(18), report.steps.length, 'steps |', bad.length ? 'BAD ' + bad.map(b=>`${b.row}:${b.verdict}`).join(',') : 'ok', un.length ? '| unchecked ' + un.map(u=>`${u.row}:${u.message}`).join('; ') : '');
  for (const b of bad) console.log('   ', b.row, b.message);
}
