import { useRef, useState } from 'react';
import type { GanttChartSpec, GanttTaskItem } from '../../../core/types/chart.types.ts';
import { ChartExportActions } from './ChartExportActions.tsx';

export function SvgGanttChart({ spec }: { spec: GanttChartSpec }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredTask, setHoveredTask] = useState<GanttTaskItem | null>(null);

  const rowH = 26;
  const pad = { top: 20, right: 24, bottom: 32, left: 118 };
  const width = 620;
  const height = Math.max(150, pad.top + pad.bottom + spec.tasks.length * rowH);
  const plotW = width - pad.left - pad.right;
  const maxDur = Math.max(1, spec.totalDuration);

  const xPos = (t: number) => pad.left + (Math.max(0, t) / maxDur) * plotW;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Number((maxDur * f).toFixed(1)));

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
          style={{ display: 'block' }}
          onMouseLeave={() => setHoveredTask(null)}
          role="img"
          aria-label={spec.title}
        >
          {ticks.map((tv, i) => {
            const x = xPos(tv);
            return (
              <g key={i}>
                <line
                  x1={x}
                  x2={x}
                  y1={pad.top - 4}
                  y2={height - pad.bottom}
                  stroke="var(--border-hairline)"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--text-muted)"
                  className="mono-num"
                >
                  {tv}
                </text>
              </g>
            );
          })}

          {spec.tasks.map((t, idx) => {
            const y = pad.top + idx * rowH;
            const x1 = xPos(t.es);
            const barW = Math.max(4, xPos(t.ef) - x1);
            const slackEnd = xPos(t.lf);
            const fill = t.isCritical ? 'var(--error)' : 'var(--success)';

            return (
              <g
                key={t.id}
                onMouseEnter={() => setHoveredTask(t)}
                style={{ cursor: 'pointer' }}
              >
                <text
                  x={pad.left - 8}
                  y={y + 15}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--text-primary)"
                  className="mono-num"
                >
                  {t.label.length > 15 ? `${t.label.slice(0, 14)}…` : t.label}
                </text>

                {t.slack > 0 && slackEnd > x1 + barW && (
                  <rect
                    x={x1 + barW}
                    y={y + 6}
                    width={slackEnd - (x1 + barW)}
                    height={10}
                    rx={2}
                    fill="var(--border-strong)"
                    opacity={0.45}
                  />
                )}

                <rect
                  x={x1}
                  y={y + 3}
                  width={barW}
                  height={16}
                  rx={3.5}
                  fill={fill}
                  opacity={hoveredTask?.id === t.id ? 1 : 0.88}
                />

                {barW > 34 && (
                  <text
                    x={x1 + barW / 2}
                    y={y + 14}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#ffffff"
                    className="mono-num"
                  >
                    {t.es}–{t.ef}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hoveredTask && (
          <div className="chart-tooltip no-print" role="status">
            <span className="chart-tooltip-title mono-num">{hoveredTask.label}</span>
            <span className="chart-tooltip-row mono-num">
              Mulai <strong>{hoveredTask.es}</strong> → Selesai <strong>{hoveredTask.ef}</strong>
            </span>
            {hoveredTask.slack > 0 && (
              <span className="mono-num" style={{ color: 'var(--success)' }}>
                Margin Due Date: +{hoveredTask.slack}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
