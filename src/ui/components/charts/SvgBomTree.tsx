import { useRef, useState } from 'react';
import type { BomTreeChartSpec, BomTreeNodeItem } from '../../../core/types/chart.types.ts';
import { ChartExportActions } from './ChartExportActions.tsx';

export function SvgBomTree({ spec }: { spec: BomTreeChartSpec }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<BomTreeNodeItem | null>(null);

  const byLevel = new Map<number, BomTreeNodeItem[]>();
  let maxLvl = 0;
  for (const node of spec.nodes) {
    const lvl = Math.max(0, node.level);
    if (lvl > maxLvl) maxLvl = lvl;
    const arr = byLevel.get(lvl) ?? [];
    arr.push(node);
    byLevel.set(lvl, arr);
  }

  const maxRowCols = Math.max(1, ...Array.from(byLevel.values()).map((a) => a.length));
  const nodeW = 168;
  const nodeH = 48;
  const hGap = 28;
  const vGap = 40;
  const padX = 24;
  const padY = 20;

  const width = Math.max(560, padX * 2 + maxRowCols * nodeW + Math.max(0, maxRowCols - 1) * hGap);
  const height = Math.max(175, padY * 2 + (maxLvl + 1) * nodeH + maxLvl * vGap);

  const coords = new Map<string, { x: number; y: number; cx: number; cy: number }>();
  for (let lvl = 0; lvl <= maxLvl; lvl += 1) {
    const rowNodes = byLevel.get(lvl) ?? [];
    const totalRowW = rowNodes.length * nodeW + Math.max(0, rowNodes.length - 1) * hGap;
    const startX = (width - totalRowW) / 2;
    const y = padY + lvl * (nodeH + vGap);
    rowNodes.forEach((n, idx) => {
      const x = startX + idx * (nodeW + hGap);
      coords.set(n.id, { x, y, cx: x + nodeW / 2, cy: y + nodeH / 2 });
    });
  }

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
        <div style={{ overflowX: 'auto' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            style={{ display: 'block', minWidth: 480 }}
            onMouseLeave={() => setHovered(null)}
            role="img"
            aria-label={spec.title}
          >
            {/* Parent -> Child Edges */}
            {spec.nodes.flatMap((child) =>
              child.parents.map((pRef, idx) => {
                const pPos = coords.get(pRef.parentName);
                const cPos = coords.get(child.id);
                if (!pPos || !cPos) return null;
                const x1 = pPos.cx;
                const y1 = pPos.y + nodeH;
                const x2 = cPos.cx;
                const y2 = cPos.y;
                const midY = (y1 + y2) / 2;
                const labelX = (x1 + x2) / 2;
                return (
                  <g key={`edge-${pRef.parentName}-${child.id}-${idx}`}>
                    <path
                      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                      fill="none"
                      stroke="var(--border-strong)"
                      strokeWidth={1.7}
                    />
                    <rect
                      x={labelX - 18}
                      y={midY - 8}
                      width={36}
                      height={15}
                      rx={3}
                      fill="var(--bg-subtle)"
                      stroke="var(--border-hairline)"
                    />
                    <text
                      x={labelX}
                      y={midY + 2.5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="var(--primary)"
                      className="mono-num"
                    >
                      ×{pRef.qtyPerParent}
                    </text>
                  </g>
                );
              }),
            )}

            {/* Nodes */}
            {spec.nodes.map((node) => {
              const pos = coords.get(node.id);
              if (!pos) return null;
              const hasPastDue = node.pastDue > 0;
              const borderCol = hasPastDue
                ? 'var(--error)'
                : node.level === 0
                  ? 'var(--stage-fc)'
                  : node.level === 1
                    ? 'var(--stage-mrp)'
                    : 'var(--stage-mps)';

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHovered(node)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={nodeW}
                    height={nodeH}
                    rx={6}
                    fill="var(--bg-surface)"
                    stroke={borderCol}
                    strokeWidth={hovered?.id === node.id ? 2.2 : 1.5}
                  />
                  <text
                    x={pos.x + 10}
                    y={pos.y + 18}
                    fontSize="10.5"
                    fontWeight="700"
                    fill="var(--text-primary)"
                  >
                    L{node.level} · {node.name.length > 16 ? `${node.name.slice(0, 15)}…` : node.name}
                  </text>
                  <text
                    x={pos.x + 10}
                    y={pos.y + 35}
                    fontSize="9"
                    fill={hasPastDue ? 'var(--error)' : 'var(--text-muted)'}
                    className="mono-num"
                  >
                    LT {node.leadTime} · {node.lotMethod} · Rel {node.totalRelease}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {hovered && (
          <div className="chart-tooltip no-print" role="status">
            <span className="chart-tooltip-title">
              Level {hovered.level} · {hovered.name}
            </span>
            <span className="mono-num">
              Lead Time: <strong>{hovered.leadTime}</strong> · Lot: <strong>{hovered.lotMethod}</strong> · Total Release:{' '}
              <strong>{hovered.totalRelease}</strong>
            </span>
            {hovered.pastDue > 0 && (
              <span className="mono-num" style={{ color: 'var(--error)', fontWeight: 700 }}>
                Past-Due: {hovered.pastDue} unit!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
