import { useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Compass,
  Download,
  GraduationCap,
  HelpCircle,
  Layers,
  ListChecks,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { ModuleExecutionResult } from '../../core/types/module.types.ts';
import {
  downloadExplanationMarkdown,
  formatExplanationMarkdown,
} from '../../io/exporters/explanationExporter.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';

interface ExplanationPanelProps {
  result: ModuleExecutionResult;
  forceExpandAll?: boolean;
}

export function ExplanationPanel({
  result,
  forceExpandAll = false,
}: ExplanationPanelProps) {
  const { state, setExplanationMode } = useWorkspace();
  const [copied, setCopied] = useState(false);
  const exp = result.explanation;
  const showFull = forceExpandAll || state.explanationMode === 'complete';

  const handleCopy = async () => {
    try {
      const md = formatExplanationMarkdown(result);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadExplanationMarkdown(result);
    }
  };

  return (
    <div
      className="exp-root"
      data-testid={`explanation-panel-${result.moduleId}`}
      aria-label="Penjelasan & Interpretasi Jawaban 6-Pilar"
    >
      <div className="exp-toolbar no-print">
        <div className="result-tabs" role="group" aria-label="Mode Detail Penjelasan">
          <button
            type="button"
            className={`nav-tab ${state.explanationMode === 'complete' ? 'active' : ''}`}
            onClick={() => setExplanationMode('complete')}
          >
            <GraduationCap size={13} /> Mode Lengkap (6 Pilar)
          </button>
          <button
            type="button"
            className={`nav-tab ${state.explanationMode === 'compact' ? 'active' : ''}`}
            onClick={() => setExplanationMode('compact')}
          >
            <Sparkles size={13} /> Mode Ringkas
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check size={12} /> Tersalin!
              </>
            ) : (
              <>
                <ClipboardCopy size={12} /> Salin Penjelasan (.md)
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadExplanationMarkdown(result)}
          >
            <Download size={12} /> Unduh .md
          </button>
        </div>
      </div>

      {/* PILAR 1: KESIMPULAN INTI */}
      <section className="exp-hero">
        <div className="exp-kicker">
          <Sparkles size={12} />
          <span>Pilar 1 · Jawaban Inti &amp; Kesimpulan Bahasa Sehari-hari</span>
        </div>
        <h3 className="exp-key-decision">{exp.keyDecision}</h3>
        <p className="exp-plain-summary">{exp.plainSummary}</p>
      </section>

      {/* PILAR 4 (Selalu Tampil agar Alasan Keluarnya Jawaban Langsung Terbaca!) */}
      {exp.whyOptimal.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">4</span>
              <HelpCircle size={13} />
              <span>Mengapa Jawaban Ini yang Keluar? (Alasan Kausal &amp; Pembuktian)</span>
            </div>
            <span className="badge badge-primary mono-num">
              <CheckCircle2 size={11} /> {exp.whyOptimal.length} alasan
            </span>
          </div>
          <div className="exp-pillar-body">
            <ul className="exp-why-list">
              {exp.whyOptimal.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* PILAR 2: ARTI & DAMPAK SETIAP ANGKA */}
      {exp.metricBreakdown.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">2</span>
              <Layers size={13} />
              <span>Bedah Arti &amp; Dampak Operasional Setiap Angka</span>
            </div>
            <span className="badge mono-num">{exp.metricBreakdown.length} metrik</span>
          </div>
          <div className="exp-pillar-body">
            <div className="exp-metric-grid">
              {exp.metricBreakdown.map((item, idx) => (
                <div key={idx} className="exp-metric-item">
                  <div className="exp-metric-top">
                    <span className="exp-metric-name">{item.label}</span>
                    <span className="exp-metric-val">{item.value}</span>
                  </div>
                  <div className="exp-metric-meaning">
                    <strong>Artinya:</strong> {item.meaning}
                  </div>
                  <div className="exp-metric-impact">
                    <strong>Dampaknya:</strong> {item.impact}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PILAR 3: LANGKAH PERHITUNGAN & SUBSTITUSI ANGKA AKTUAL */}
      {showFull && exp.workedSteps.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">3</span>
              <ListChecks size={13} />
              <span>Langkah Perhitungan Bertahap &amp; Substitusi Angka Input Anda</span>
            </div>
            <span className="badge mono-num">{exp.workedSteps.length} langkah</span>
          </div>
          <div className="exp-pillar-body">
            <div className="exp-steps-list">
              {exp.workedSteps.map((step) => (
                <div key={step.stepNumber} className="exp-step-card">
                  <div className="exp-step-head">
                    <div className="exp-step-title">
                      Langkah {step.stepNumber}: {step.title}
                    </div>
                    <span className="exp-step-result">{step.result}</span>
                  </div>

                  <div className="exp-formula-box">
                    <div className="exp-formula-cell">
                      <div className="exp-formula-tag">Rumus Umum</div>
                      <div className="exp-formula-code">{step.formula}</div>
                    </div>
                    <div className="exp-formula-cell">
                      <div className="exp-formula-tag">Substitusi Angka Aktual</div>
                      <div className="exp-formula-code">{step.substitution}</div>
                    </div>
                  </div>

                  <div className="exp-step-note">{step.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PILAR 5: DIAGNOSA RISIKO & REKOMENDASI AKSI */}
      {(exp.risksAndNotes.length > 0 || exp.recommendations.length > 0) && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">5</span>
              <ShieldAlert size={13} />
              <span>Diagnosa Risiko, Kapasitas &amp; Rekomendasi Tindak Lanjut</span>
            </div>
          </div>
          <div className="exp-pillar-body">
            {exp.risksAndNotes.length > 0 && (
              <div className="exp-notes-grid">
                {exp.risksAndNotes.map((note, idx) => (
                  <div key={idx} className={`exp-note-cell tone-${note.tone}`}>
                    <div className="exp-note-heading">{note.heading}</div>
                    <div className="exp-note-detail">{note.detail}</div>
                  </div>
                ))}
              </div>
            )}

            {exp.recommendations.length > 0 && (
              <div>
                <div className="sheet-section-label">
                  <Compass size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                  Rekomendasi Tindakan Operasional
                </div>
                <ol className="exp-rec-list">
                  {exp.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {/* PILAR 6: KAMUS ISTILAH MODUL */}
      {showFull && exp.glossary.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">6</span>
              <BookOpen size={13} />
              <span>Kamus Istilah Penting ({result.moduleId.toUpperCase()})</span>
            </div>
          </div>
          <div className="exp-pillar-body">
            <div className="exp-glossary-grid">
              {exp.glossary.map((term, idx) => (
                <div key={idx} className="exp-glossary-item">
                  <div className="exp-glossary-term">{term.term}</div>
                  <div className="exp-glossary-def">{term.definition}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
