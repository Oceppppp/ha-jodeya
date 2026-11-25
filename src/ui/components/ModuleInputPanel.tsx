import { useState } from 'react';
import { ArrowRight, BookOpen, GitBranch, RotateCcw } from 'lucide-react';
import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type {
  ForecastingInput,
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

export function ModuleInputPanel() {
  const {
    state,
    selectJob,
    addModuleJob,
    updateJobInput,
    updateJobMeta,
  } = useWorkspace();

  const [showConceptGuide, setShowConceptGuide] = useState(true);

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

  const incomingLinks = state.links.filter((l) => l.targetJobId === activeJob.id);
  const outgoingLinks = state.links.filter((l) => l.sourceJobId === activeJob.id);

  return (
    <>
      {/* View Header (Single H1) */}
      <header className="view-header">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="view-eyebrow">
            <span
              className="stage-pill"
              style={{ background: meta.stageAccentVar }}
            >
              TAHAP {meta.stageNumber} · {meta.code}
            </span>
            <span>{meta.category}</span>
            {incomingLinks.map((lk) => {
              const src = state.jobs.find((j) => j.id === lk.sourceJobId);
              if (!src) return null;
              return (
                <button
                  key={lk.id}
                  type="button"
                  className="badge badge-primary"
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectJob(src.id, true)}
                  title="Klik untuk membuka modul sumber"
                >
                  <GitBranch size={10} /> Menerima dari: {src.title}
                </button>
              );
            })}
            {outgoingLinks.map((lk) => {
              const tgt = state.jobs.find((j) => j.id === lk.targetJobId);
              if (!tgt) return null;
              return (
                <button
                  key={lk.id}
                  type="button"
                  className="badge"
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectJob(tgt.id, true)}
                  title="Klik untuk melompat ke modul hilir"
                >
                  Mengirim ke: {tgt.title} <ArrowRight size={10} />
                </button>
              );
            })}
          </div>

          <h1 className="view-heading">{meta.indonesianName}</h1>
          <p className="view-lead">{meta.description}</p>
        </div>

        <div className="view-header-actions no-print">
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
            <RotateCcw size={12} /> Reset Contoh Default
          </button>
        </div>
      </header>

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

      {/* ZONE 01: INPUT SHEET */}
      <section className="surface-panel no-print" aria-label="Lembar Input Data Metode">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '0.85rem',
          }}
        >
          <div className="sheet-section-label" style={{ marginBottom: 0 }}>
            01 · Lembar Input &amp; Parameter ({meta.code})
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <label
              htmlFor="input-job-title"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              Judul Kasus:
            </label>
            <input
              id="input-job-title"
              type="text"
              className="form-control"
              style={{ width: 250, height: 28, fontSize: 'var(--text-xs)' }}
              value={activeJob.title}
              onChange={(e) => updateJobMeta(activeJob.id, { title: e.target.value })}
            />
          </div>
        </div>

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
      <section className="surface-panel" aria-label="Keluaran Analitik dan Penjelasan 6-Pilar">
        <div className="sheet-section-label">
          02 · Keluaran Analitik Real-Time &amp; Penjelasan Jawaban (6-Pilar)
        </div>
        {liveResult ? (
          <ResultView job={activeJob} result={liveResult} />
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Sedang menghitung hasil di Web Worker Pool…
          </p>
        )}
      </section>
    </>
  );
}
