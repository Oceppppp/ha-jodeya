import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Columns2,
  GitBranch,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Table2,
} from 'lucide-react';
import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type {
  ForecastingInput,
  ModuleId,
  MpsInput,
  MrpInput,
  SchedulingInput,
} from '../../core/types/module.types.ts';
import { DEFAULT_MODULE_INPUTS } from '../../io/templates/sampleDatasets.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';
import { ForecastingEditor } from './editors/ForecastingEditor.tsx';
import { MpsEditor } from './editors/MpsEditor.tsx';
import { MrpEditor } from './editors/MrpEditor.tsx';
import { SchedulingEditor } from './editors/SchedulingEditor.tsx';
import { ResultView } from './ResultView.tsx';

const CASCADE_CTA_LABELS: Partial<Record<ModuleId, { button: string; detail: string }>> = {
  forecasting: {
    button: 'Oper ke MPS → MRP → SC',
    detail:
      'Kirim deret proyeksi Forecasting ini ke MPS, lalu alirkan otomatis hingga MRP & Scheduling (membuat tahap hilir otomatis bila belum ada).',
  },
  mps: {
    button: 'Oper Jadwal ke MRP → SC',
    detail:
      'Kirim jadwal MPS Receipts ini ke Gross Requirements Level-0 MRP dan teruskan Work Order ke Scheduling.',
  },
  mrp: {
    button: 'Oper Work Order ke Scheduling',
    detail:
      'Kirim daftar Planned Order Releases MRP ini menjadi Work Order (waktu proses, due date, bobot) ke tabel Scheduling.',
  },
};

export function ModuleInputPanel() {
  const {
    state,
    selectJob,
    addModuleJob,
    updateJobInput,
    updateJobMeta,
    cascadeFromJob,
  } = useWorkspace();

  const [showConceptGuide, setShowConceptGuide] = useState(true);
  const [splitView, setSplitView] = useState(false);

  const activeJob = state.jobs.find((j) => j.id === state.activeJobId) ?? state.jobs[0];

  if (!activeJob) {
    return (
      <section className="surface-panel">
        <div className="sheet-section-label">Belum Ada Pekerjaan Metode</div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Pilih salah satu dari 4 tahap PPIC di bawah ini untuk mulai mengedit data:
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {MODULE_REGISTRY.map((m) => (
            <button
              key={m.id}
              type="button"
              className="btn"
              onClick={() => addModuleJob(m.id)}
            >
              + {m.stageNumber} · {m.indonesianName}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const meta = MODULE_MAP[activeJob.moduleId];
  const liveResult = state.batchSummary?.resultsByJobId[activeJob.id];
  const incomingTransfers = state.batchSummary?.transfersByJobId?.[activeJob.id] ?? [];
  const cascadeCta = CASCADE_CTA_LABELS[activeJob.moduleId];

  const incomingLinks = state.links.filter((l) => l.targetJobId === activeJob.id);
  const outgoingLinks = state.links.filter((l) => l.sourceJobId === activeJob.id);
  const hasPipelineNeighbor = incomingLinks.length > 0 || outgoingLinks.length > 0;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* View Header (Single H1 + Compact 1-Line Pipeline Breadcrumb) */}
      <header className="view-header">
        <div className="view-header-main">
          <div className="view-eyebrow">
            <span className="stage-pill" style={{ background: meta.stageAccentVar }}>
              TAHAP {meta.stageNumber} · {meta.code}
            </span>
            <span>{meta.category}</span>
          </div>

          {hasPipelineNeighbor && (
            <div className="editor-pipeline-crumb no-print" aria-label="Posisi dalam Pipeline PPIC">
              <GitBranch size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              {incomingLinks.map((lk) => {
                const src = state.jobs.find((j) => j.id === lk.sourceJobId);
                if (!src) return null;
                const srcMeta = MODULE_MAP[src.moduleId];
                return (
                  <span key={lk.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="crumb-stage-btn"
                      onClick={() => selectJob(src.id, true)}
                      title={`Buka modul sumber: ${src.title}`}
                    >
                      <span className="mono-num" style={{ color: srcMeta.stageAccentVar }}>
                        {srcMeta.stageNumber} {srcMeta.code}
                      </span>
                      <span>{srcMeta.shortLabel}</span>
                    </button>
                    <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} />
                  </span>
                );
              })}

              <span className="crumb-stage-btn current">
                <span className="mono-num" style={{ color: meta.stageAccentVar }}>
                  {meta.stageNumber} {meta.code}
                </span>
                <span>{meta.shortLabel}</span>
              </span>

              {outgoingLinks.map((lk) => {
                const tgt = state.jobs.find((j) => j.id === lk.targetJobId);
                if (!tgt) return null;
                const tgtMeta = MODULE_MAP[tgt.moduleId];
                return (
                  <span key={lk.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} />
                    <button
                      type="button"
                      className="crumb-stage-btn"
                      onClick={() => selectJob(tgt.id, true)}
                      title={`Lompat ke modul hilir: ${tgt.title}`}
                    >
                      <span className="mono-num" style={{ color: tgtMeta.stageAccentVar }}>
                        {tgtMeta.stageNumber} {tgtMeta.code}
                      </span>
                      <span>{tgtMeta.shortLabel}</span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <h1 className="view-heading">{meta.indonesianName}</h1>
          <p className="view-lead">{meta.description}</p>
        </div>

        <div className="view-header-actions no-print">
          {cascadeCta && (
            <button
              type="button"
              id={`btn-cascade-${activeJob.moduleId}`}
              className="btn btn-primary btn-sm"
              disabled={state.isRunning}
              onClick={() => void cascadeFromJob(activeJob.id, true)}
              title={cascadeCta.detail}
            >
              <Send size={12} /> {cascadeCta.button}
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowConceptGuide((v) => !v)}
          >
            <BookOpen size={13} /> {showConceptGuide ? 'Tutup Panduan' : 'Panduan Metode'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              updateJobInput(
                activeJob.id,
                structuredClone(DEFAULT_MODULE_INPUTS[activeJob.moduleId]),
              )
            }
          >
            <RotateCcw size={12} /> Reset Default
          </button>
        </div>
      </header>

      {/* Sticky Quick-Jump Bar & Desktop Split-View Toggle */}
      <nav className="editor-jump-bar no-print" aria-label="Navigasi Cepat Bagian Modul">
        <div className="editor-jump-links">
          <button
            type="button"
            className="jump-pill"
            onClick={() => scrollToSection('editor-zone-input')}
          >
            <SlidersHorizontal size={11} /> 01 Input
          </button>
          <button
            type="button"
            className="jump-pill"
            onClick={() => scrollToSection('editor-zone-output')}
          >
            <Sparkles size={11} /> 02 Hasil &amp; 6-Pilar
          </button>
          <button
            type="button"
            className="jump-pill"
            onClick={() => scrollToSection('editor-charts')}
          >
            <BarChart3 size={11} /> Grafik
          </button>
          <button
            type="button"
            className="jump-pill"
            onClick={() => scrollToSection('editor-tables')}
          >
            <Table2 size={11} /> Tabel
          </button>
        </div>

        <button
          type="button"
          className={`btn btn-sm split-view-toggle ${splitView ? 'btn-primary' : ''}`}
          onClick={() => setSplitView((v) => !v)}
          title="Tampilkan Input di kiri dan Hasil di kanan secara berdampingan (layar lebar)"
        >
          <Columns2 size={13} /> {splitView ? 'Mode Bertumpuk' : 'Split-View'}
        </button>
      </nav>

      {/* Collapsible Method Concept Guide */}
      {showConceptGuide && (
        <section className="surface-panel no-print" style={{ borderLeft: '3px solid var(--primary)' }}>
          <div className="sheet-section-label" style={{ color: 'var(--primary)' }}>
            Panduan Konsep &amp; Rumus Inti — {meta.name}
          </div>
          <p
            style={{
              margin: '0 0 0.55rem',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
            }}
          >
            <strong>Tujuan:</strong> {meta.conceptGuide.purpose}
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              marginBottom: '0.55rem',
            }}
          >
            {meta.conceptGuide.coreFormulas.map((f, i) => (
              <code
                key={i}
                className="mono-num"
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '0.35rem 0.6rem',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-xs)',
                  overflowX: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                {f}
              </code>
            ))}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <strong>Posisi dalam Rantai PPIC:</strong> {meta.conceptGuide.whenToUse}
          </div>
        </section>
      )}

      <div className={`editor-workspace-grid ${splitView ? 'split-active' : ''}`}>
        {/* ZONE 01: INPUT SHEET */}
        <section
          id="editor-zone-input"
          className="surface-panel no-print"
          aria-label="Lembar Input Data Metode"
          style={{ scrollMarginTop: 112 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              flexWrap: 'wrap',
              marginBottom: '0.85rem',
            }}
          >
            <div className="sheet-section-label" style={{ marginBottom: 0 }}>
              01 · Lembar Input &amp; Parameter ({meta.code})
            </div>

            <div className="editor-title-inline">
              <label
                htmlFor="input-job-title"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
              >
                Judul Kasus:
              </label>
              <input
                id="input-job-title"
                type="text"
                className="form-control editor-title-input"
                value={activeJob.title}
                onChange={(e) => updateJobMeta(activeJob.id, { title: e.target.value })}
              />
            </div>
          </div>

          {/* LIVE PIPELINE TRANSFER PROOF CARD (Shows exact data received from upstream!) */}
          {incomingTransfers.length > 0 && (
            <div className="pipeline-transfer-card" data-testid="pipeline-transfer-proof">
              {incomingTransfers.map((tr) => {
                const srcMeta = MODULE_MAP[tr.sourceModuleId];
                return (
                  <div key={tr.linkId} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="pipeline-transfer-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-success">
                          <CheckCircle2 size={11} /> Data Masuk dari Pipeline
                        </span>
                        <span className="stage-pill" style={{ background: srcMeta.stageAccentVar }}>
                          {srcMeta.stageNumber} · {srcMeta.code}
                        </span>
                        <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                        <span className="stage-pill" style={{ background: meta.stageAccentVar }}>
                          {meta.stageNumber} · {meta.code}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => selectJob(tr.sourceJobId, true)}
                      >
                        Lihat Sumber ({srcMeta.code})
                      </button>
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {tr.headline}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Tabel input di bawah sudah <strong>otomatis terisi</strong> dari hasil perhitungan{' '}
                      <strong>{tr.sourceJobTitle}</strong>. Setiap perubahan di tahap hulu langsung memperbarui data ini.
                    </div>

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {tr.headers.map((h, i) => (
                              <th key={i}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tr.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={cIdx > 0 ? 'mono-num' : undefined}
                                  style={cIdx === 0 ? { fontWeight: 600 } : undefined}
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

          {activeJob.moduleId === 'forecasting' && (
            <ForecastingEditor
              input={activeJob.input as ForecastingInput}
              onChange={(next) => updateJobInput(activeJob.id, next)}
            />
          )}
          {activeJob.moduleId === 'mps' && (
            <MpsEditor
              input={activeJob.input as MpsInput}
              onChange={(next) => updateJobInput(activeJob.id, next)}
            />
          )}
          {activeJob.moduleId === 'mrp' && (
            <MrpEditor
              input={activeJob.input as MrpInput}
              onChange={(next) => updateJobInput(activeJob.id, next)}
            />
          )}
          {activeJob.moduleId === 'scheduling' && (
            <SchedulingEditor
              input={activeJob.input as SchedulingInput}
              onChange={(next) => updateJobInput(activeJob.id, next)}
            />
          )}
        </section>

        {/* ZONE 02: LIVE ANALYTICAL OUTPUT & 6-PILLAR EXPLANATION */}
        <section
          id="editor-zone-output"
          className="surface-panel"
          aria-label="Keluaran Analitik dan Penjelasan 6-Pilar"
          style={{ scrollMarginTop: 112 }}
        >
          <div className="pipeline-handoff-bar no-print">
            <div className="sheet-section-label" style={{ marginBottom: 0 }}>
              02 · Keluaran Analitik Real-Time &amp; Penjelasan Jawaban (6-Pilar)
            </div>
            {cascadeCta && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={state.isRunning}
                onClick={() => void cascadeFromJob(activeJob.id, true)}
                title={cascadeCta.detail}
              >
                <Send size={12} /> {cascadeCta.button}
              </button>
            )}
          </div>
          {liveResult ? (
            <ResultView job={activeJob} result={liveResult} />
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Sedang menghitung hasil di Web Worker Pool…
            </p>
          )}
        </section>
      </div>
    </>
  );
}


