import { useRef, useState } from 'react';
import type { LineChartSpec } from '../../../core/types/chart.types.ts';
import { ChartExportActions } from './ChartExportActions.tsx';

export function SvgLineChart({ spec }: { spec: LineChartSpec }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 580;
  const height = 248;
  const pad = { top: 22, right: 24, bottom: 44, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allY: number[] = [];
  const xLabels: string[] = [];
  for (const s of spec.series) {
    for (const pt of s.points) {
      allY.push(pt.y);
      const xStr = String(pt.x);
      if (!xLabels.includes(xStr)) xLabels.push(xStr);
    }
  }
  for (const ref of spec.referenceLines ?? []) {
    allY.push(ref.value);
  }

  let minY = allY.length > 0 ? Math.min(...allY) : 0;
  let maxY = allY.length > 0 ? Math.max(...allY) : 100;
  if (Math.abs(maxY - minY) < 1e-6) {
    minY -= 1;
    maxY += 1;
  } else {
    const margin = (maxY - minY) * 0.14;
    minY = minY >= 0 && minY - margin < 0 ? 0 : minY - margin;
    maxY += margin;
  }

  const xPos = (xVal: number | string): number => {
    const idx = xLabels.indexOf(String(xVal));
    if (xLabels.length <= 1) return pad.left + plotW / 2;
    return pad.left + (Math.max(0, idx) / (xLabels.length - 1)) * plotW;
  };

  const yPos = (yVal: number): number =>
    pad.top + plotH - ((yVal - minY) / (maxY - minY)) * plotH;

  const ticks = 4;
  const yTickVals = Array.from(
    { length: ticks + 1 },
    (_, i) => minY + ((maxY - minY) * i) / ticks,
  );

  const hoveredLabel = hoverIdx !== null ? xLabels[hoverIdx] : null;
  const hoveredEntries =
    hoveredLabel !== null
      ? spec.series
          .map((s) => {
            const pt = s.points.find((p) => String(p.x) === hoveredLabel);
            return pt ? { name: s.name, color: s.colorToken, y: pt.y } : null;
          })
          .filter((item): item is { name: string; color: string; y: number } => item !== null)
      : [];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (xLabels.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(pad.left, Math.min(width - pad.right, relX));
    const idx =
      xLabels.length === 1
        ? 0
        : Math.round(((clamped - pad.left) / plotW) * (xLabels.length - 1));
    setHoverIdx(Math.max(0, Math.min(xLabels.length - 1, idx)));
  };

  const xStride = Math.max(1, Math.ceil(xLabels.length / 8));

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
          style={{ maxHeight: 255, display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label={spec.title}
        >
          {yTickVals.map((yv, i) => {
            const y = yPos(yv);
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
                  {Math.abs(yv) >= 1000
                    ? `${(yv / 1000).toFixed(1)}k`
                    : yv.toFixed(yv % 1 === 0 ? 0 : 1)}
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
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
                <text
                  x={width - pad.right - 4}
                  y={ry - 4}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={ref.colorToken}
                >
                  {ref.label}
                </text>
              </g>
            );
          })}

          {hoveredLabel !== null && (
            <line
              data-export-ignore="true"
              x1={xPos(hoveredLabel)}
              x2={xPos(hoveredLabel)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="var(--primary)"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
          )}

          {spec.series.map((s) => {
            if (s.points.length === 0) return null;
            const pts = s.points.map((p) => `${xPos(p.x)},${yPos(p.y)}`).join(' ');
            return (
              <g key={s.name}>
                <polyline
                  fill="none"
                  stroke={s.colorToken}
                  strokeWidth={2.2}
                  strokeDasharray={s.dashed ? '5 4' : undefined}
                  points={pts}
                />
                {s.points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={xPos(p.x)}
                    cy={yPos(p.y)}
                    r={String(p.x) === hoveredLabel ? 4.5 : 3}
                    fill={s.colorToken}
                  />
                ))}
              </g>
            );
          })}

          {xLabels.map((lbl, idx) => {
            if (idx % xStride !== 0 && idx !== xLabels.length - 1) return null;
            return (
              <text
                key={lbl}
                x={xPos(lbl)}
                y={pad.top + plotH + 16}
                textAnchor="middle"
                fontSize="9.5"
                fill="var(--text-muted)"
                className="mono-num"
              >
                {lbl.length > 10 ? `${lbl.slice(0, 9)}…` : lbl}
              </text>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${pad.left}, ${height - 9})`}>
            {spec.series.map((s, idx) => (
              <g key={s.name} transform={`translate(${idx * 155}, 0)`}>
                <line
                  x1={0}
                  x2={14}
                  y1={-3}
                  y2={-3}
                  stroke={s.colorToken}
                  strokeWidth={2.4}
                  strokeDasharray={s.dashed ? '3 2' : undefined}
                />
                <text x={18} y={0} fontSize="9.5" fill="var(--text-secondary)">
                  {s.name.length > 21 ? `${s.name.slice(0, 20)}…` : s.name}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {hoveredLabel !== null && hoveredEntries.length > 0 && (
          <div className="chart-tooltip no-print" role="status">
            <span className="chart-tooltip-title mono-num">{hoveredLabel}</span>
            {hoveredEntries.map((ent) => (
              <span key={ent.name} className="chart-tooltip-row">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: ent.color,
                    display: 'inline-block',
                  }}
                />
                <span className="chart-tooltip-key">{ent.name}:</span>
                <strong className="mono-num">{ent.y}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
