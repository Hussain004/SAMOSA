import { SectionHead } from './common.tsx';
import COVERAGE_HISTORY from '../../../corpus/coverage-history.json';

/** The coverage curve: what share of the claim rows parse, per release. */
export function CoverageCurve() {
  const points = COVERAGE_HISTORY as Array<{ version: string; date: string; percent: number }>;
  const max = 100;
  const width = 640;
  const height = 180;
  const padX = 56;
  const padY = 28;
  const spanX = (width - padX * 2) / Math.max(1, points.length - 1);
  const y = (percent: number) => height - padY - (percent / max) * (height - padY * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${padX + i * spanX},${y(p.percent)}`).join(' ');
  return (
    <section className="border-t border-[var(--color-line)] py-14">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10">
        <SectionHead
          eyebrow="the coverage, in the open"
          title="What parses."
          body="The share of the claim rows in the display math of recent arXiv papers that SAMOSA reads end to end, measured per release. The method, the misses and the numbers are in /docs/COVERAGE."
        />
        <div className="mt-8 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="max-w-[640px]" role="img" aria-label="the share of claim rows that parse, per release">
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line x1={padX} x2={width - padX} y1={y(tick)} y2={y(tick)} stroke="#332d29" strokeDasharray="2 4" />
                <text x={padX - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#8f8378">{`${tick}%`}</text>
              </g>
            ))}
            <path d={path} fill="none" stroke="#c9a227" strokeWidth="2.5" />
            {points.map((p, i) => (
              <g key={p.version}>
                <circle cx={padX + i * spanX} cy={y(p.percent)} r="4.5" fill="#c9a227" />
                <text x={padX + i * spanX} y={height - 6} textAnchor="middle" fontSize="11" fill="#e8dcc9">{`${p.version} · ${p.percent}%`}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

