import { parseRow } from './src/core/parse.ts';
import { tokenize } from './src/core/lex.ts';
for (const src of ['\\det(A B) &= \\det(A)\\det(B)', 'A &= B', '\\det(A) = A']) {
  const parsed = parseRow(src, src, 0, 0);
  console.log(JSON.stringify(src), '->', parsed.error?.message ?? 'ok', '| the parts:', parsed.parts.length);
  console.log('  the tokens:', tokenize(src.split('=')[1] ?? '').map((t) => `${t.type}:${t.value}`).join(' '));
}
