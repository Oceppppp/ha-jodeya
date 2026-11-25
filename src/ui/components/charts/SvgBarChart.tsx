import { useRef, useState } from 'react';
import type { BarChartItem, BarChartSpec } from '../../../core/types/chart.types.ts';
import { ChartExportActions } from './ChartExportActions.tsx';

function barToneFill(tone?: BarChartItem['tone']): string {
  if (tone === 'error') return 'var(--error)';
  if (tone === 'warning') return 'var(--warning)';
  if (tone === 'success') return 'var(--success)';
  if (tone === 'primary') return 'var(--primary)';
  return 'var(--chart-1)';
}

export function SvgBarChart({ spec }: { spec: BarChartSpec }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 580;
  const height = 244;
  const pad = { top: 24, right: 24, bottom: 40, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const rawMax = Math.max(
    1,
    ...spec.bars.map((b) => b.value),
    ...(spec.referenceLines ?? []).map((r) => r.value),
  );
  const maxVal = rawMax * 1.15;

  const yPos = (val: number) => pad.top + plotH - (Math.max(0, val) / maxVal) * plotH;
  const count = Math.max(1, spec.bars.length);
  const slotW = plotW / count;
  const barW = Math.min(48, Math.max(16, slotW * 0.56));

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t);
  const hovered = hoverIdx !== null ? spec.bars[hoverIdx] : null;

  return (
    <div className="chart-box">
      <div className="chart-header-row">
        <div>
          <div className="chart-title">{spec.title}</div>
          {spec.subtitle && <div className="chart-subtitle">{spec.subtitle}</div>}
        </div>
        <ChartExportActions svgRef={svgRef} title={spec.title} />
      </div>

      <div className="chart-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ maxHeight: 250, display: 'block' }}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label={spec.title}
        >
          {ticks.map((tv, i) => {
            const y = yPos(tv);
            return (
              <g key={i}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="var(--border-hairline)"
                  strokeDasharray="3 3"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-muted)"
                  className="mono-num"
                >
                  {tv >= 1000 ? `${(tv / 1000).toFixed(1)}k` : Math.round(tv)}
                </text>
              </g>
            );
          })}

          {(spec.referenceLines ?? []).map((ref, idx) => {
            const ry = yPos(ref.value);
            return (
              <g key={`ref-${idx}`}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={ry}
                  y2={ry}
                  stroke={ref.colorToken}
                  strokeWidth={1.6}
                  strokeDasharray="5 3"
                />
                <text
                  x={width - pad.right - 2}
                  y={ry - 4}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={ref.colorToken}
                >
                  {ref.label}
                </text>
              </g>
            );
          })}

          {spec.bars.map((bar, idx) => {
            const cx = pad.left + idx * slotW + slotW / 2;
            const x = cx - barW / 2;
            const y = yPos(bar.value);
            const h = Math.max(2, pad.top + plotH - y);
            const fill = barToneFill(bar.tone);
            const isHover = hoverIdx === idx;

            return (
              <g
                key={`${bar.label}-${idx}`}
                onMouseEnter={() => setHoverIdx(idx)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={4}
                  fill={fill}
                  opacity={isHover ? 1 : 0.88}
                />
                <text
                  x={cx}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="var(--text-primary)"
                  className="mono-num"
                >
                  {bar.value}
                </text>
                <text
                  x={cx}
                  y={pad.top + plotH + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--text-muted)"
                  className="mono-num"
                >
                  {bar.label.length > 11 ? `${bar.label.slice(0, 10)}…` : bar.label}
                </text>
                {bar.annotation && (
                  <text
                    x={cx}
                    y={pad.top + plotH + 28}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="var(--text-faint)"
                    className="mono-num"
                  >
                    {bar.annotation}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div className="chart-tooltip no-print" role="status">
            <span className="chart-tooltip-title">{hovered.label}</span>
            <span className="chart-tooltip-row">
              <span className="chart-tooltip-key">{spec.yLabel}:</span>
              <strong className="mono-num">{hovered.value}</strong>
            </span>
            {hovered.annotation && (
              <span className="mono-num" style={{ color: 'var(--text-muted)' }}>
                ({hovered.annotation})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
