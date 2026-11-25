import { useRef, useState } from 'react';
import { MODULE_MAP } from '../../../core/registry/moduleRegistry.ts';
import type { ModuleExecutionResult } from '../../../core/types/module.types.ts';
import type { ModuleJob, PipelineLink } from '../../../core/types/workspace.types.ts';
import { ChartExportActions } from './ChartExportActions.tsx';

interface SvgPipelineDagProps {
  stages: ModuleJob[][];
  links: PipelineLink[];
  resultsByJobId?: Record<string, ModuleExecutionResult>;
  onSelectJob?: (jobId: string) => void;
}

export function SvgPipelineDag({
  stages,
  links,
  resultsByJobId,
  onSelectJob,
}: SvgPipelineDagProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredJob, setHoveredJob] = useState<ModuleJob | null>(null);

  if (stages.length === 0) return null;

  const nodeW = 204;
  const nodeH = 58;
  const colGap = 104;
  const rowGap = 16;
  const padX = 22;
  const padTop = 36;
  const padBottom = 22;

  const width = Math.max(
    560,
    padX * 2 + stages.length * nodeW + Math.max(0, stages.length - 1) * colGap,
  );

  const positions = new Map<string, { cx: number; cy: number; x: number; y: number }>();
  let maxBottomY = padTop + nodeH;

  stages.forEach((stageJobs, sIdx) => {
    const x = padX + sIdx * (nodeW + colGap);
    stageJobs.forEach((job, rIdx) => {
      const y = padTop + rIdx * (nodeH + rowGap);
      positions.set(job.id, { x, y, cx: x + nodeW / 2, cy: y + nodeH / 2 });
      maxBottomY = Math.max(maxBottomY, y + nodeH);
    });
  });

  const height = Math.max(145, maxBottomY + padBottom);
  const markerId = `hajodeya-dag-arrow-${stages.length}-${links.length}`;
  const hoveredRes = hoveredJob ? resultsByJobId?.[hoveredJob.id] : undefined;

  return (
    <div className="dag-card">
      <div className="chart-header-row" style={{ marginBottom: '0.45rem' }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Klik kotak tahap untuk langsung membuka Editor &amp; Penjelasan 6-Pilar
        </div>
        <ChartExportActions svgRef={svgRef} title="Pipeline_4_Tahap_Ha_Jodeya" />
      </div>

      <div className="chart-svg-wrap">
        <div style={{ overflowX: 'auto' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{
              display: 'block',
              width: `${width}px`,
              maxWidth: '100%',
              height: 'auto',
              margin: '0 auto',
            }}
            onMouseLeave={() => setHoveredJob(null)}
            role="img"
            aria-label="Diagram Pipeline 4-Tahap PPIC Ha Jodeya"
          >
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--primary)" />
              </marker>
            </defs>

            {stages.map((stageJobs, sIdx) => {
              const x = padX + sIdx * (nodeW + colGap) + nodeW / 2;
              return (
                <text
                  key={`stage-hdr-${sIdx}`}
                  x={x}
                  y={20}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--primary)"
                  letterSpacing="0.06em"
                  className="mono-num"
                >
                  STAGE {sIdx + 1} ({stageJobs.length})
                </text>
              );
            })}

            {links.map((link) => {
              const p1 = positions.get(link.sourceJobId);
              const p2 = positions.get(link.targetJobId);
              if (!p1 || !p2) return null;

              const x1 = p1.x + nodeW;
              const y1 = p1.cy;
              const x2 = p2.x - 2;
              const y2 = p2.cy;
              const midX = (x1 + x2) / 2;
              const d =
                x2 <= x1
                  ? `M ${p1.cx} ${p1.y + nodeH} C ${p1.cx} ${p1.y + nodeH + 26}, ${p2.cx} ${p2.y - 26}, ${p2.cx} ${p2.y - 2}`
                  : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

              const labelText =
                link.targetField.length > 15
                  ? `${link.targetField.slice(0, 14)}…`
                  : link.targetField;

              return (
                <g key={link.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={1.8}
                    strokeDasharray="4 2"
                    markerEnd={`url(#${markerId})`}
                  />
                  <rect
                    x={midX - 46}
                    y={(y1 + y2) / 2 - 17}
                    width={92}
                    height={14}
                    rx={3}
                    fill="var(--bg-subtle)"
                    stroke="var(--border-hairline)"
                  />
                  <text
                    x={midX}
                    y={(y1 + y2) / 2 - 7.5}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="600"
                    fill="var(--text-secondary)"
                    className="mono-num"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}

            {stages.flat().map((job) => {
              const pos = positions.get(job.id);
              if (!pos) return null;
              const meta = MODULE_MAP[job.moduleId];
              const res = resultsByJobId?.[job.id];
              const kpi = res?.kpis[1] ?? res?.kpis[0];
              const subText = kpi
                ? `${kpi.label}: ${kpi.value}${kpi.unit ? ` ${kpi.unit}` : ''}`
                : meta.indonesianName;

              return (
                <g
                  key={job.id}
                  onClick={() => onSelectJob?.(job.id)}
                  onMouseEnter={() => setHoveredJob(job)}
                  style={{ cursor: onSelectJob ? 'pointer' : 'default' }}
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={nodeW}
                    height={nodeH}
                    rx={6}
                    fill="var(--bg-surface)"
                    stroke={
                      hoveredJob?.id === job.id ? 'var(--primary)' : 'var(--border-strong)'
                    }
                    strokeWidth={hoveredJob?.id === job.id ? 2 : 1.2}
                  />
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={4}
                    height={nodeH}
                    rx={2}
                    fill={meta.stageAccentVar}
                  />
                  <rect
                    x={pos.x + 10}
                    y={pos.y + 9}
                    width={36}
                    height={16}
                    rx={3}
                    fill={meta.stageAccentVar}
                  />
                  <text
                    x={pos.x + 28}
                    y={pos.y + 20}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#ffffff"
                    className="mono-num"
                  >
                    {meta.stageNumber} {meta.code}
                  </text>
                  <text
                    x={pos.x + 52}
                    y={pos.y + 20}
                    fontSize="10.5"
                    fontWeight="700"
                    fill="var(--text-primary)"
                  >
                    {job.title.length > 19 ? `${job.title.slice(0, 18)}…` : job.title}
                  </text>
                  <text
                    x={pos.x + 11}
                    y={pos.y + 43}
                    fontSize="9"
                    fill="var(--text-muted)"
                    className="mono-num"
                  >
                    {subText.length > 29 ? `${subText.slice(0, 28)}…` : subText}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {hoveredJob && (
          <div className="chart-tooltip no-print" role="status">
            <span className="chart-tooltip-title">
              [{MODULE_MAP[hoveredJob.moduleId].stageNumber}] {hoveredJob.title}
            </span>
            {hoveredRes ? (
              <span className="mono-num">{hoveredRes.explanation.keyDecision}</span>
            ) : (
              <span>Klik untuk membuka editor metode</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
