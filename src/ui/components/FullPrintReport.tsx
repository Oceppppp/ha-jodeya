import { MODULE_MAP } from '../../core/registry/moduleRegistry.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';
import { ResultView } from './ResultView.tsx';

export function FullPrintReport() {
  const { state } = useWorkspace();
  const summary = state.batchSummary;

  if (state.printMode !== 'full' || !summary) return null;

  const executedJobs = state.jobs.filter((j) => Boolean(summary.resultsByJobId[j.id]));

  return (
    <div className="full-print-report" aria-label="Laporan Lengkap 4-Tahap PPIC Ha Jodeya">
      <section className="print-cover-page">
        <div
          className="mono-num"
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#1b4965',
            marginBottom: '0.35rem',
          }}
        >
          HA JODEYA · LAPORAN ANALITIK 4-STAGE PPIC WORKBENCH
        </div>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem', color: '#0f172a' }}>
          {state.activeProjectName}
        </h1>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#475569' }}>
          Laporan komprehensif rantai perencanaan produksi (Forecasting, MPS, MRP, Scheduling) beserta KPI utama, Penjelasan &amp; Alasan Jawaban 6-Pilar Lengkap, visualisasi SVG, dan tabel solusi.
        </p>

        <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
          <div className="kpi-box emphasis-primary">
            <div className="kpi-label">Total Metode</div>
            <div className="kpi-val">{summary.totalJobs}</div>
          </div>
          <div className="kpi-box emphasis-success">
            <div className="kpi-label">Sukses Optimal</div>
            <div className="kpi-val">{summary.successCount}</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Peringatan</div>
            <div className="kpi-val">{summary.warningCount}</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Durasi Batch</div>
            <div className="kpi-val">
              {summary.totalDurationMs}
              <span className="kpi-unit">ms</span>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tahap</th>
                <th>Metode &amp; Pekerjaan</th>
                <th>Status</th>
                <th>KPI Utama</th>
                <th>Keputusan Inti (Pilar 1)</th>
              </tr>
            </thead>
            <tbody>
              {executedJobs.map((job) => {
                const res = summary.resultsByJobId[job.id];
                const meta = MODULE_MAP[job.moduleId];
                const mainKpi = res.kpis[1] ?? res.kpis[0];
                return (
                  <tr key={job.id}>
                    <td className="mono-num">
                      <strong>
                        {meta.stageNumber} · {meta.code}
                      </strong>
                    </td>
                    <td>
                      <strong>{job.title}</strong>
                    </td>
                    <td className="mono-num">{res.status.toUpperCase()}</td>
                    <td className="mono-num">
                      {mainKpi ? `${mainKpi.value}${mainKpi.unit ? ` ${mainKpi.unit}` : ''}` : '-'}
                    </td>
                    <td style={{ fontSize: '0.76rem' }}>{res.explanation.keyDecision}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {executedJobs.map((job, idx) => {
        const res = summary.resultsByJobId[job.id];
        const meta = MODULE_MAP[job.moduleId];
        return (
          <section key={`print-sec-${job.id}`} className="print-module-section">
            <div className="print-module-banner">
              <span className="mono-num">
                TAHAP {meta.stageNumber} ({idx + 1}/{executedJobs.length}) · {meta.code} — {meta.indonesianName}
              </span>
              <span>Ha Jodeya</span>
            </div>
            <ResultView job={job} result={res} forceExpandAudit />
          </section>
        );
      })}
    </div>
  );
}
