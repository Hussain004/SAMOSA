import { parseRow } from './src/core/parse.ts';
const cases = ['\\mathrm{TC}_P(Y_{1:k}) = x', 'Y_{1:k} = x', 'a_{1:2} = b'];
for (const c of cases) {
  try {
    const parsed = parseRow(c, c, 0, 0);
    console.log('ok  ', JSON.stringify(c), '->', parsed.parts.length);
  } catch (e) {
    console.log('FAIL', JSON.stringify(c), '->', String(e).slice(0, 50));
  }
}
