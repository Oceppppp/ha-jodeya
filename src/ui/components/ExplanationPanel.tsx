import { useState } from 'react';
import {
  AlertTriangle,
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

function classifyReasonTone(reason: string): 'caution' | 'positive' | 'neutral' {
  const lower = reason.toLowerCase();
  if (
    lower.includes('overload') ||
    lower.includes('past-due') ||
    lower.includes('terlambat') ||
    lower.includes('defisit') ||
    lower.includes('over-promise') ||
    lower.includes('melebihi 100%') ||
    lower.includes('melampaui')
  ) {
    return 'caution';
  }
  if (
    lower.includes('hemat') ||
    lower.includes('menurunkan total biaya') ||
    lower.includes('optimal') ||
    lower.includes('terendah') ||
    lower.includes('terkecil') ||
    lower.includes('terbaik') ||
    lower.includes('memenuhi') ||
    lower.includes('aman')
  ) {
    return 'positive';
  }
  return 'neutral';
}

export function ExplanationPanel({
  result,
  forceExpandAll = false,
}: ExplanationPanelProps) {
  const { state, setExplanationMode } = useWorkspace();
  const [copied, setCopied] = useState(false);
  const exp = result.explanation;
  const showFull = forceExpandAll || state.explanationMode === 'complete';
  const useBalanced2Col =
    exp.metricBreakdown.length === 2 || exp.metricBreakdown.length === 4;

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

      {/* 01 · KESIMPULAN INTI */}
      <section className="exp-hero">
        <div className="exp-kicker">
          <Sparkles size={12} />
          <span>01 · KESIMPULAN · Jawaban Inti &amp; Ringkasan Bahasa Sehari-hari</span>
        </div>
        <h3 className="exp-key-decision">{exp.keyDecision}</h3>
        <p className="exp-plain-summary">{exp.plainSummary}</p>
      </section>

      {/* 02 · ALASAN KAUSAL (Selalu Tampil agar Alasan Keluarnya Jawaban Langsung Terbaca!) */}
      {exp.whyOptimal.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">02 · ALASAN KAUSAL</span>
              <HelpCircle size={13} />
              <span>Mengapa Jawaban Ini yang Keluar? (Pembuktian Angka Aktual)</span>
            </div>
            <span className="badge badge-primary mono-num">
              <CheckCircle2 size={11} /> {exp.whyOptimal.length} alasan
            </span>
          </div>
          <div className="exp-pillar-body">
            <ul className="exp-why-list">
              {exp.whyOptimal.map((reason, idx) => {
                const tone = classifyReasonTone(reason);
                return (
                  <li key={idx} className={`exp-why-item tone-${tone}`}>
                    <span className="exp-why-icon" aria-hidden="true">
                      {tone === 'caution' ? (
                        <AlertTriangle size={14} />
                      ) : tone === 'positive' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </span>
                    <span>{reason}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* 03 · ARTI & DAMPAK SETIAP ANGKA */}
      {exp.metricBreakdown.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">03 · ARTI ANGKA</span>
              <Layers size={13} />
              <span>Bedah Arti &amp; Dampak Operasional Setiap Angka</span>
            </div>
            <span className="badge mono-num">{exp.metricBreakdown.length} metrik</span>
          </div>
          <div className="exp-pillar-body">
            <div className={`exp-metric-grid ${useBalanced2Col ? 'exp-metric-grid-even' : ''}`}>
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

      {/* 04 · LANGKAH PERHITUNGAN & SUBSTITUSI ANGKA AKTUAL */}
      {showFull && exp.workedSteps.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">04 · HITUNGAN</span>
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

      {/* 05 · DIAGNOSA RISIKO & REKOMENDASI AKSI */}
      {(exp.risksAndNotes.length > 0 || exp.recommendations.length > 0) && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">05 · RISIKO &amp; AKSI</span>
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

      {/* 06 · KAMUS ISTILAH MODUL */}
      {showFull && exp.glossary.length > 0 && (
        <section className="exp-pillar-card">
          <div className="exp-pillar-head">
            <div className="exp-pillar-title">
              <span className="exp-pillar-num">06 · KAMUS</span>
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

