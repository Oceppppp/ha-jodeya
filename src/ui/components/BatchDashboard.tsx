import { Fragment, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Edit3,
  Play,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type { ModuleExecutionResult } from '../../core/types/module.types.ts';
import type { ModuleJob } from '../../core/types/workspace.types.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';
import { MAX_SCENARIO_SNAPSHOTS } from '../../store/workspaceHistory.ts';
import { ResultView } from './ResultView.tsx';

function parseKpiNumber(val: string | number | undefined): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val !== 'string') return null;
  const cleaned = val
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]+/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function findMatchingSnapshotResult(
  job: ModuleJob,
  resultsByJobId: Record<string, ModuleExecutionResult>,
): ModuleExecutionResult | undefined {
  return (
    resultsByJobId[job.id] ??
    Object.values(resultsByJobId).find((r) => r.moduleId === job.moduleId)
  );
}

export function BatchDashboard() {
  const {
    state,
    selectJob,
    addModuleJob,
    duplicateJob,
    saveScenarioSnapshot,
    removeScenarioSnapshot,
    clearScenarioSnapshot,
    setView,
    runAll,
    loadPpic4StagePreset,
  } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [scenarioLabel, setScenarioLabel] = useState('');

  const summary = state.batchSummary;

  const toggleExpand = (jobId: string) => {
    setExpandedIds((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const setAllExpanded = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const j of state.jobs) next[j.id] = open;
    setExpandedIds(next);
  };

  if (!summary) {
    return (
      <>
        <header className="view-header">
          <div>
            <div className="view-eyebrow">RINGKASAN RANTAI PPIC · WEB WORKER POOL</div>
            <h1 className="view-heading">Rantai Perencanaan &amp; Penjadwalan 4 Metode</h1>
            <p className="view-lead">
              {state.isRunning
                ? 'Sedang mengeksekusi tahapan Forecasting → MPS → MRP → Scheduling secara paralel di Web Worker Pool…'
                : 'Jalankan antrean aktif atau muat Preset Rantai PPIC 4-Tahap untuk melihat hasil dan penjelasan 6-Pilar secara lengkap.'}
            </p>
          </div>
          <div className="view-header-actions no-print">
            <button type="button" className="btn" onClick={() => loadPpic4StagePreset(true)}>
              Muat Preset 4-Tahap
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={state.isRunning || state.jobs.filter((j) => j.enabled).length === 0}
              onClick={() => void runAll(true)}
            >
              <Play size={14} /> Jalankan Sekarang
            </button>
          </div>
        </header>

        <section className="surface-panel">
          <div className="sheet-section-label">Kesiapan Antrean</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Terdapat <strong className="mono-num">{state.jobs.filter((j) => j.enabled).length}</strong> metode aktif yang siap dihitung.
          </p>
        </section>
      </>
    );
  }

  const executedJobs = state.jobs.filter((j) => Boolean(summary.resultsByJobId[j.id]));
  const filteredJobs = executedJobs.filter((j) => {
    const res = summary.resultsByJobId[j.id];
    const meta = MODULE_MAP[j.moduleId];
    if (statusFilter !== 'all' && res.status !== statusFilter) return false;
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        meta.name.toLowerCase().includes(q) ||
        meta.indonesianName.toLowerCase().includes(q) ||
        meta.code.toLowerCase().includes(q) ||
        res.summaryText.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const snapshots = state.scenarioSnapshots;
  const primaryBaseline = snapshots[0] ?? null;

  const handleSaveScenario = () => {
    saveScenarioSnapshot(scenarioLabel);
    setScenarioLabel('');
  };

  return (
    <>
      <header className="view-header">
        <div className="view-header-main">
          <div className="view-eyebrow">
            <span>RINGKASAN EKSEKUTIF 4-TAHAP PPIC</span>
            <span aria-hidden="true">·</span>
            <span className="mono-num">
              {summary.totalDurationMs} ms · {new Date(summary.finishedAt).toLocaleTimeString('id-ID')}
            </span>
          </div>
          <h1 className="view-heading">Rantai Perencanaan Produksi Terpadu</h1>
          <p className="view-lead">
            Evaluasi simultan <strong>Forecasting → MPS → MRP → Scheduling</strong> melalui Web Worker Pool. Klik kartu tahap atau tombol <strong>Detail</strong> untuk membaca Penjelasan &amp; Alasan Jawaban 6-Pilar.
          </p>
        </div>

        <div className="view-header-actions no-print">
          <div className="scenario-input-group">
            <input
              type="text"
              id="input-scenario-label"
              className="form-control scenario-input-field"
              placeholder="Nama skenario What-If…"
              value={scenarioLabel}
              onChange={(e) => setScenarioLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveScenario();
              }}
            />
            <button
              type="button"
              id="btn-save-whatif-baseline"
              className="btn btn-sm"
              onClick={handleSaveScenario}
              title={`Simpan hasil saat ini sebagai skenario What-If (maks. ${MAX_SCENARIO_SNAPSHOTS})`}
            >
              <Bookmark size={13} /> Simpan ({snapshots.length}/{MAX_SCENARIO_SNAPSHOTS})
            </button>
          </div>
          {snapshots.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={clearScenarioSnapshot}
            >
              <Trash2 size={12} /> Reset Skenario
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setView('file-upload')}>
            <UploadCloud size={13} /> Upload Data
          </button>
        </div>
      </header>

      {/* 4-Stage Flow Health Strip with Directional Arrows & Stage Accents */}
      <section className="stage-health-grid" aria-label="Kesehatan 4 Tahap Rantai PPIC">
        {MODULE_REGISTRY.map((mod, idx) => {
          const job = executedJobs.find((j) => j.moduleId === mod.id);
          const res = job ? summary.resultsByJobId[job.id] : undefined;
          const mainKpi = res?.kpis[1] ?? res?.kpis[0];

          return (
            <div key={mod.id} className="stage-health-slot">
              <button
                type="button"
                className="stage-health-card"
                style={{ borderTopColor: mod.stageAccentVar }}
                onClick={() => {
                  if (job) selectJob(job.id, true);
                  else addModuleJob(mod.id);
                }}
              >
                <div className="stage-health-top">
                  <span className="stage-health-tag">
                    <span
                      className="stage-pill"
                      style={{ background: mod.stageAccentVar }}
                    >
                      {mod.stageNumber}
                    </span>
                    {mod.shortLabel}
                  </span>
                  <span
                    className={`status-dot ${res?.status ?? ''}`}
                    title={res ? `Status: ${res.status}` : 'Belum aktif'}
                  />
                </div>
                <div className="stage-health-metric-label">
                  {mainKpi ? mainKpi.label : mod.indonesianName}
                </div>
                <div className="stage-health-kpi">
                  {mainKpi
                    ? `${mainKpi.value}${mainKpi.unit ? ` ${mainKpi.unit}` : ''}`
                    : 'Belum Aktif'}
                </div>
                <div className="stage-health-sub">
                  {res ? res.explanation.keyDecision : mod.description}
                </div>
              </button>

              {idx < MODULE_REGISTRY.length - 1 && (
                <span className="stage-flow-arrow" aria-hidden="true">
                  <ArrowRight size={11} />
                </span>
              )}
            </div>
          );
        })}
      </section>

      {/* Interactive Executive Batch KPI Strip (Click to Filter Matrix Below) */}
      <section className="kpi-grid" aria-label="Metrik Eksekusi Batch">
        <button
          type="button"
          className={`kpi-box kpi-box-btn emphasis-primary ${statusFilter === 'all' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('all')}
          title="Tampilkan seluruh metode di tabel bawah"
        >
          <div className="kpi-label">
            <span>Metode Dieksekusi</span>
          </div>
          <div className="kpi-val">{summary.totalJobs}</div>
        </button>

        <button
          type="button"
          className={`kpi-box kpi-box-btn emphasis-success ${statusFilter === 'success' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter((cur) => (cur === 'success' ? 'all' : 'success'))}
          title="Klik untuk memfilter metode berstatus Optimal"
        >
          <div className="kpi-label">
            <span>Status Optimal</span>
            <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
          </div>
          <div className="kpi-val kpi-val-success">{summary.successCount}</div>
        </button>

        <button
          type="button"
          className={`kpi-box kpi-box-btn ${summary.warningCount > 0 ? 'emphasis-warning' : ''} ${statusFilter === 'warning' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter((cur) => (cur === 'warning' ? 'all' : 'warning'))}
          title="Klik untuk memfilter metode yang memiliki peringatan kapasitas/lot"
        >
          <div className="kpi-label">
            <span>Peringatan Kapasitas / Lot</span>
            {summary.warningCount > 0 && (
              <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
            )}
          </div>
          <div className={`kpi-val ${summary.warningCount > 0 ? 'kpi-val-warning' : ''}`}>
            {summary.warningCount}
          </div>
        </button>

        <div className="kpi-box">
          <div className="kpi-label">Waktu Komputasi Paralel</div>
          <div className="kpi-val">
            {summary.totalDurationMs}
            <span className="kpi-unit">ms</span>
          </div>
        </div>
      </section>

      {/* Multi-Scenario What-If Matrix */}
      {snapshots.length > 0 && primaryBaseline && (
        <section className="whatif-banner" aria-label="Perbandingan Multi-Skenario What-If">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '0.65rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--primary)' }}>
                Matriks Sensitivitas Multi-Skenario What-If ({snapshots.length} Skenario vs Aktual)
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Selisih (Δ &amp; %) dihitung antara kondisi <strong>Aktual</strong> terhadap{' '}
                <strong>{primaryBaseline.label}</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {snapshots.map((snap, idx) => (
                <span key={snap.id} className="scenario-chip">
                  <span className="mono-num">#{idx + 1}</span> {snap.label}
                  <button
                    type="button"
                    className="scenario-chip-remove"
                    onClick={() => removeScenarioSnapshot(snap.id)}
                    aria-label={`Hapus skenario ${snap.label}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metode</th>
                  {snapshots.map((s) => (
                    <th key={s.id}>{s.label}</th>
                  ))}
                  <th>Aktual Saat Ini</th>
                  <th>Delta vs {primaryBaseline.label}</th>
                </tr>
              </thead>
              <tbody>
                {executedJobs.map((job) => {
                  const curRes = summary.resultsByJobId[job.id];
                  const curKpi = curRes.kpis[1] ?? curRes.kpis[0];
                  const baseRes = findMatchingSnapshotResult(
                    job,
                    primaryBaseline.resultsByJobId,
                  );
                  const baseKpi = baseRes?.kpis[1] ?? baseRes?.kpis[0];
                  const curNum = parseKpiNumber(curKpi?.value);
                  const baseNum = parseKpiNumber(baseKpi?.value);
                  let deltaStr = '—';
                  if (curNum !== null && baseNum !== null) {
                    const diff = curNum - baseNum;
                    const pct =
                      Math.abs(baseNum) > 1e-9 ? ((diff / Math.abs(baseNum)) * 100).toFixed(1) : '0.0';
                    deltaStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${diff >= 0 ? '+' : ''}${pct}%)`;
                  }

                  return (
                    <tr key={`wi-${job.id}`}>
                      <td>
                        <strong>{job.title}</strong>
                      </td>
                      {snapshots.map((snap) => {
                        const sRes = findMatchingSnapshotResult(job, snap.resultsByJobId);
                        const sKpi = sRes?.kpis[1] ?? sRes?.kpis[0];
                        return (
                          <td key={snap.id} className="mono-num">
                            {sKpi ? `${sKpi.value}${sKpi.unit ? ` ${sKpi.unit}` : ''}` : '—'}
                          </td>
                        );
                      })}
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        {curKpi ? `${curKpi.value}${curKpi.unit ? ` ${curKpi.unit}` : ''}` : '—'}
                      </td>
                      <td className="mono-num">{deltaStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Master Batch Matrix */}
      <section className="surface-panel" style={{ padding: '0.9rem 1rem' }}>
        <div className="batch-toolbar no-print">
          <div className="batch-toolbar-left">
            <input
              type="search"
              id="input-search-batch"
              className="form-control batch-search-input"
              placeholder="Cari tahap, judul, atau ringkasan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-control batch-filter-select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'success' | 'warning' | 'error')
              }
            >
              <option value="all">Semua Status</option>
              <option value="success">Sukses Optimal</option>
              <option value="warning">Peringatan</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="batch-toolbar-right">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setAllExpanded(true)}
            >
              <ChevronsUpDown size={12} /> Buka Semua
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setAllExpanded(false)}
            >
              <ChevronsDownUp size={12} /> Tutup Semua
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tahap</th>
                <th>Pekerjaan Metode</th>
                <th>Status</th>
                <th>KPI Kunci</th>
                <th>Keputusan &amp; Ringkasan Jawaban</th>
                <th>Durasi</th>
                <th className="no-print" style={{ textAlign: 'right' }}>
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => {
                const res = summary.resultsByJobId[job.id];
                const meta = MODULE_MAP[job.moduleId];
                const mainKpi = res.kpis[1] ?? res.kpis[0];
                const isOpen = Boolean(expandedIds[job.id]);

                return (
                  <Fragment key={job.id}>
                    <tr>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          className="stage-pill"
                          style={{ background: meta.stageAccentVar }}
                        >
                          {meta.stageNumber} · {meta.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{job.title}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {res.status === 'success' ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={11} /> Optimal
                          </span>
                        ) : res.status === 'warning' ? (
                          <span className="badge badge-warning">
                            <AlertTriangle size={11} /> Peringatan
                          </span>
                        ) : (
                          <span className="badge badge-error">
                            <XCircle size={11} /> Error
                          </span>
                        )}
                      </td>
                      <td className="mono-num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {mainKpi
                          ? `${mainKpi.value}${mainKpi.unit ? ` ${mainKpi.unit}` : ''}`
                          : '—'}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 420 }}>
                        {res.explanation.keyDecision}
                      </td>
                      <td className="mono-num" style={{ whiteSpace: 'nowrap' }}>
                        {res.executionMs} ms
                      </td>
                      <td className="no-print" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => toggleExpand(job.id)}
                          >
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Detail
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => selectJob(job.id, true)}
                            title="Buka Editor & Analisis"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => duplicateJob(job.id)}
                            title="Duplikat pekerjaan untuk eksperimen"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="batch-detail-row">
                        <td colSpan={7}>
                          <div className="surface-panel">
                            <ResultView job={job} result={res} compactHeader />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
