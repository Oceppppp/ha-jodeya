import { Layers, ShieldCheck, X } from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext.ts';

export function ArchitectureModal() {
  const { state, toggleArchModal } = useWorkspace();
  if (!state.showArchitectureModal) return null;

  return (
    <div
      className="modal-backdrop no-print"
      onClick={() => toggleArchModal(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Arsitektur Sistem Ha Jodeya"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} style={{ color: 'var(--primary)' }} />
            <strong style={{ fontSize: 'var(--text-md)' }}>
              Arsitektur Modular 5-Lapisan — Ha Jodeya
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => toggleArchModal(false)}
            aria-label="Tutup modal arsitektur"
          >
            <X size={14} />
          </button>
        </div>

        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginTop: 0,
          }}
        >
          <strong>Ha Jodeya</strong> dirancang dengan arsitektur berlapis sisi klien (100% lokal di browser, PWA offline-ready) yang memfokuskan seluruh kemampuan analitik ke <strong>4 metode inti PPIC</strong>:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', margin: '0.85rem 0' }}>
          {[
            [
              '1. Presentation Layer (src/ui/ & src/styles/)',
              'Hierarki 4-Lapisan Modern, 4-Stage PPIC Spine, ExplanationPanel 6-Pilar, 4 Editor Spreadsheet (Ctrl+V), & 5 Grafik SVG murni.',
            ],
            [
              '2. State & Worker Pool Layer (src/store/ & src/workers/)',
              'Multi-Proyek localStorage, Undo/Redo 30 langkah, 5 Skenario What-If, dan Reusable Web Worker Pool paralel anti-freeze.',
            ],
            [
              '3. Domain, Pipeline & 6-Pillar Explanation (src/core/)',
              'Kontrak tipe ketat, penjadwalan topologis Kahn DAG (FC → MPS → MRP → SC), dan mesin narasi alasan kausal 6-Pilar.',
            ],
            [
              '4. Universal Safe IO Layer (src/io/)',
              'Parser Excel multi-sheet, CSV, JSON, dan semua file JS (zero-eval!), Interactive Column Mapping, serta ekspor .xlsx/.csv/.md/PDF.',
            ],
            [
              '5. Pure Quantitative Engines (src/engines/)',
              '4 solver TypeScript murni: Forecasting (7 metode), MPS (DTF/PTF + PAB + ATP + RCCP), MRP (BOM Multi-Parent + 5 Lot-Sizing), & Scheduling (6 Aturan + Johnson 2M).',
            ],
          ].map(([title, desc]) => (
            <div
              key={title}
              style={{
                padding: '0.65rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--primary)' }}>
                {title}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border-hairline)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={13} style={{ color: 'var(--success)' }} /> 0 byte data dikirim ke server eksternal
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => toggleArchModal(false)}>
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
