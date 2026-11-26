import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, XCircle } from 'lucide-react';
import { MODULE_MAP } from '../../core/registry/moduleRegistry.ts';
import type { ModuleExecutionResult } from '../../core/types/module.types.ts';
import type { ModuleJob } from '../../core/types/workspace.types.ts';
import { exportModuleResultCsv } from '../../io/exporters/csvExporter.ts';
import { SvgBarChart } from './charts/SvgBarChart.tsx';
import { SvgBomTree } from './charts/SvgBomTree.tsx';
import { SvgGanttChart } from './charts/SvgGanttChart.tsx';
import { SvgLineChart } from './charts/SvgLineChart.tsx';
import { ExplanationPanel } from './ExplanationPanel.tsx';

interface ResultViewProps {
  job?: ModuleJob;
  result: ModuleExecutionResult;
  compactHeader?: boolean;
  forceExpandAudit?: boolean;
}

export function ResultView({
  job,
  result,
  compactHeader = false,
  forceExpandAudit = false,
}: ResultViewProps) {
  const meta = MODULE_MAP[result.moduleId];
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const onBeforePrint = () => setIsPrinting(true);
    const onAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  const statusBadge =
    result.status === 'success' ? (
      <span className="badge badge-success">
        <CheckCircle2 size={12} /> Sukses Optimal
      </span>
    ) : result.status === 'warning' ? (
      <span className="badge badge-warning">
        <AlertTriangle size={12} /> Perlu Perhatian
      </span>
    ) : (
      <span className="badge badge-error">
        <XCircle size={12} /> Error Input
      </span>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        {!compactHeader ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span
              className="stage-pill"
              style={{ background: meta.stageAccentVar }}
            >
              {meta.stageNumber} · {meta.code}
            </span>
            <strong style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
              {result.jobTitle}
            </strong>
            {statusBadge}
            <span className="badge mono-num">
              <Clock size={11} /> {result.executionMs} ms
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {statusBadge}
            <span className="badge mono-num">
              <Clock size={11} /> {result.executionMs} ms
            </span>
          </div>
        )}

        {job && (
          <button
            type="button"
            id={`btn-export-csv-${job.id}`}
            className="btn btn-sm no-print"
            onClick={() => exportModuleResultCsv(job, result)}
          >
            <Download size={13} /> Ekspor CSV
          </button>
        )}
      </div>

      {result.warnings.length > 0 && (
        <div
          className="alert-strip alert-warning"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
        >
          {result.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {/* 1. Hairline KPI Strip */}
      {result.kpis.length > 0 && (
        <div className="kpi-grid">
          {result.kpis.map((kpi, idx) => (
            <div
              key={idx}
              className={`kpi-box ${kpi.emphasis ? `emphasis-${kpi.emphasis}` : ''}`}
            >
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-val">
                {kpi.value}
                {kpi.unit && <span className="kpi-unit">{kpi.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. 6-Pillar Causal Answer Explanation */}
      <ExplanationPanel result={result} forceExpandAll={isPrinting || forceExpandAudit} />

      {/* 3. Calibrated Pure SVG Visualizations */}
      {result.charts.length > 0 && (
        <div id="editor-charts" className="charts-grid" style={{ scrollMarginTop: 112 }}>
          {result.charts.map((chart) => {
            if (chart.kind === 'line') return <SvgLineChart key={chart.id} spec={chart} />;
            if (chart.kind === 'bar') return <SvgBarChart key={chart.id} spec={chart} />;
            if (chart.kind === 'gantt') return <SvgGanttChart key={chart.id} spec={chart} />;
            return <SvgBomTree key={chart.id} spec={chart} />;
          })}
        </div>
      )}

      {/* 4. Result Tables */}
      {result.tables.length > 0 && (
        <div
          id="editor-tables"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', scrollMarginTop: 112 }}
        >
          {result.tables.map((tbl) => {
            const hlSet = new Set(tbl.highlightRowIndices ?? []);
            return (
              <div key={tbl.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className="sheet-section-label" style={{ marginBottom: 0 }}>
                  {tbl.title}
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {tbl.headers.map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tbl.rows.map((row, rIdx) => (
                        <tr key={rIdx} className={hlSet.has(rIdx) ? 'row-highlight' : undefined}>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={typeof cell === 'number' ? 'mono-num' : undefined}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
