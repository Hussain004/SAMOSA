import katex from 'katex';
import { VERDICT_ICON, VERDICT_TITLE, guaranteeSentence, seedText } from './verdicts.ts';
import type { StepResult, ShrunkInstance } from '../core/index.ts';

/**
 * The report card, as an image.
 *
 * A ✗ with the counterexample is the most shareable thing SAMOSA makes, so
 * it can leave the app as a picture without leaving the browser. The card
 * is an SVG with its HTML inside a foreignObject, then rasterized on a
 * canvas. The KaTeX part is rendered as MathML so the SVG is self-contained
 * (an SVG drawn to a canvas refuses anything that is not a data URL, and
 * web fonts are not data URLs), and the rest is plain styled HTML. Nothing
 * is fetched, and no server is involved.
 */

export interface ReportCardInput {
  step: StepResult;
  /** the row's LaTeX, without the highlight wrapper */
  latex: string;
  /** the counterexample, when there is one */
  counterexample?: ShrunkInstance;
  /** the title of the top fix, when there is one */
  fixTitle?: string;
}

const ACCENT = '#c9a227';
const BG = '#141010';
const PANEL = '#1e1917';
const TEXT = '#e8dcc9';
const FAINT = '#8f8378';
const WRONG = '#e0654a';
const OK = '#7dc78f';

/** The row's own LaTeX, with the alignment markers removed. */
export function plainTex(step: StepResult): string {
  const text = (step.text ?? '')
    .replace(/&/g, ' ')
    .replace(/\\nonumber|\\notag/g, '')
    .trim();
  return text;
}

function katexMathML(latex: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
      output: 'mathml',
      strict: 'ignore',
    });
  } catch {
    // a construct KaTeX cannot read is shown as text, never dropped
    return escapeHtml(latex);
  }
}

/** A LaTeX-ish string as plain text, for the one line of prose on the card. */
function latexToPlain(text: string): string {
  return text
    .replace(/\\bar\\Sigma/g, 'Σ̄')
    .replace(/\\Sigma/g, 'Σ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\top/g, 'ᵀ')
    .replace(/\\bar/g, '')
    .replace(/\\([A-Za-z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmt(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1000) return String(x);
  const [n, d] = rational(x) ?? [x, 1];
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** A small rational, when the double is one; otherwise null. */function rational(x: number): [number, number] | null {
  if (!Number.isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = abs;
  const MAX = 1e9;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h = a * h1 + h2, k = a * k1 + k2;
    if (k > MAX) break;
    h2 = h1; h1 = h; k2 = k1; k1 = k;
    if (b === a) break;
    b = 1 / (b - a);
  }
  if (k1 === 0 || Math.abs(h1 / k1 - abs) > 1e-12) return null;
  return [sign * h1, k1];
}

/** A matrix as rows of small integers, for the image. */
function matrixGrid(name: string, value: number[] | number, shape: [number, number]): string {
  const label = katexMathML(name);
  if (typeof value === 'number') {
    return `<div style="font-family: ui-monospace, 'DejaVu Sans Mono', monospace; font-size: 19px; line-height: 1.6; color: ${TEXT};"><span style="color: ${ACCENT}">${label}</span> = ${escapeHtml(fmt(value))}</div>`;
  }
  const [rows, cols] = shape;
  const grid: string[] = [];
  for (let i = 0; i < rows; i++) {
    const cells = value.slice(i * cols, (i + 1) * cols).map(fmt);
    grid.push(cells.join('   '));
  }
  return `<div style="font-family: ui-monospace, 'DejaVu Sans Mono', monospace; font-size: 17px; line-height: 1.7; color: ${TEXT}; white-space: pre;"><span style="color: ${ACCENT}">${label}</span><br/>${escapeHtml('[ ' + grid.join('\n  ') + ' ]')}</div>`;
}

/** The SVG for the card. Sized to fit its contents. */
export function reportCardSvg(input: ReportCardInput): string {
  const { step } = input;
  const katexHtml = katexMathML(input.latex);
  const sentence = escapeHtml(guaranteeSentence(step));
  const fix = input.fixTitle ? escapeHtml(latexToPlain(input.fixTitle)) : null;
  const accent = step.verdict === 'wrong' ? WRONG : step.verdict === 'ok' ? OK : ACCENT;
  const counterexampleRows = input.counterexample
    ? Object.entries(input.counterexample.values)
    : [];
  const counterexampleShapes = input.counterexample?.shapes ?? {};

  // real heights, computed once, so the SVG clips nothing
  let height = 258;
  if (sentence) height += 34;
  for (const [name, value] of counterexampleRows) {
    const shape = counterexampleShapes[name] ?? (Array.isArray(value) ? [1, value.length] : [1, 1]);
    height += typeof value === 'number' ? 32 : 26 * shape[0] + 26;
  }
  if (fix) height += 44;
  height += 30; // for the footer

  const valueBlock =
    counterexampleRows.length === 0
      ? ''
      : `<div style="margin-top: 18px; border: 1px solid #3a332f; border-radius: 8px; padding: 12px 14px; background: ${PANEL};">
           <div style="font-family: ui-monospace, 'DejaVu Sans Mono', monospace; font-size: 13px; letter-spacing: 0.12em; color: ${FAINT};">THE VALUES THAT BREAK IT</div>
           <div style="margin-top: 8px; display: flex; gap: 26px; flex-wrap: wrap; align-items: center;">
             ${counterexampleRows.map(([name, value]) => matrixGrid(name, value, counterexampleShapes[name] ?? (Array.isArray(value) ? [1, value.length] : [1, 1]))).join('')}
           </div>
         </div>`;

  const fixBlock = fix
    ? `<div style="margin-top: 16px; border-left: 3px solid ${ACCENT}; padding-left: 12px;">
         <div style="font-family: ui-monospace, 'DejaVu Sans Mono', monospace; font-size: 13px; letter-spacing: 0.12em; color: ${FAINT};">THE FIX</div>
         <div style="margin-top: 4px; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; color: ${TEXT};">${fix}</div>
       </div>`
    : '';

  const html = `<div xmlns="http://www.w3.org/1999/xhtml"
     style="width: 960px; height: ${height}px; background: ${BG}; color: ${TEXT}; font-family: Georgia, 'Times New Roman', serif; position: relative; padding: 26px 30px 22px; box-sizing: border-box;">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 30px; color: ${ACCENT}; line-height: 1;">∇</div>
      <div>
        <div style="font-size: 21px; letter-spacing: 0.2em; color: ${ACCENT}; font-weight: bold;">SAMOSA</div>
        <div style="font-size: 13px; color: ${FAINT};">the matrix algebra step auditor</div>
      </div>
    </div>
    <div style="font-family: ui-monospace, 'DejaVu Sans Mono', monospace; font-size: 13px; color: ${FAINT};">seed ${escapeHtml(seedText(step.card.seed))}</div>
  </div>
  <div style="margin-top: 16px; border: 2px solid ${accent}; border-radius: 10px; padding: 14px 16px; background: ${PANEL};">
    <div style="display: flex; align-items: baseline; gap: 14px;">
      <div style="font-size: 26px; color: ${accent};">${VERDICT_ICON[step.verdict]}</div>
      <div style="font-size: 20px; font-weight: bold;">${escapeHtml(VERDICT_TITLE[step.verdict])}</div>
      <div style="font-size: 15px; color: ${FAINT};">row ${step.row}</div>
    </div>
    <div style="margin-top: 10px; font-size: 20px;">${katexHtml}</div>
    <div style="margin-top: 8px; font-size: 15px; color: ${FAINT};">${sentence}</div>
  </div>
  ${valueBlock}
  ${fixBlock}
  <div style="position: absolute; bottom: 12px; left: 30px; right: 30px; border-top: 1px solid #332d29; padding-top: 10px; display: flex; justify-content: space-between; font-size: 12px; color: ${FAINT}; font-family: ui-monospace, 'DejaVu Sans Mono', monospace;">
    <span>every check runs in the browser, nothing leaves the machine</span>
    <span>SAMOSA</span>
  </div>
</div>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}">` +
    `<foreignObject x="0" y="0" width="960" height="${height}">${html}</foreignObject>` +
    `</svg>`
  );
}

/** Rasterize the card and download it as a PNG. */
export async function saveReportCardPng(input: ReportCardInput): Promise<void> {
  const svg = reportCardSvg(input);
  // the CSP allows data: images and not blob: images, so the SVG is a
  // percent-encoded data URL
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch (error) {
    throw new Error(`the card image could not be drawn: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  const match = /height="(\d+)"/.exec(svg);
  canvas.height = match ? Number(match[1]) : 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas context');
  ctx.drawImage(img, 0, 0);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('the canvas refused to encode a PNG');
  const download = URL.createObjectURL(png);
  const a = document.createElement('a');
  a.href = download;
  a.download = `samosa-row-${input.step.row}-${input.step.verdict}.png`;
  a.click();
  URL.revokeObjectURL(download);
}
