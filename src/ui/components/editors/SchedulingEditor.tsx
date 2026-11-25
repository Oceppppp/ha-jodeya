import { Plus, Trash2 } from 'lucide-react';
import type { SchedulingInput, SchedulingJobInput } from '../../../core/types/module.types.ts';
import { parseClipboardGrid } from '../../utils/gridPaste.ts';

interface SchedulingEditorProps {
  input: SchedulingInput;
  onChange: (next: SchedulingInput) => void;
}

export function SchedulingEditor({ input, onChange }: SchedulingEditorProps) {
  const isJohnson = input.mode === 'johnson_two_machine';

  const updateJob = (idx: number, patch: Partial<SchedulingJobInput>) => {
    const next = input.jobs.map((j, i) => (i === idx ? { ...j, ...patch } : j));
    onChange({ ...input, jobs: next });
  };

  const handleAddJob = () => {
    const n = input.jobs.length + 1;
    onChange({
      ...input,
      jobs: [
        ...input.jobs,
        {
          jobId: `WO-10${n}`,
          processingTime: 4,
          dueDate: n * 5,
          weight: 1,
          processingTimeMachine2: 3,
        },
      ],
    });
  };

  const handleRemoveJob = (idx: number) => {
    if (input.jobs.length <= 2) return;
    onChange({ ...input, jobs: input.jobs.filter((_, i) => i !== idx) });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    const grid = parseClipboardGrid(text);
    if (grid.length < 2) return;
    e.preventDefault();

    const jobs: SchedulingJobInput[] = [];
    grid.forEach((row, idx) => {
      if (row.length < 2) return;
      const p1 = Number(row[1]?.replace(/,/g, '.'));
      if (!Number.isFinite(p1)) return;
      const due = Number((row[2] ?? String(p1 * 2)).replace(/,/g, '.'));
      const weight = Number((row[3] ?? '1').replace(/,/g, '.'));
      const p2 = Number((row[4] ?? String(p1)).replace(/,/g, '.'));

      jobs.push({
        jobId: row[0] || `WO-${idx + 1}`,
        processingTime: Math.max(0.1, p1),
        dueDate: Number.isFinite(due) ? Math.max(0, due) : p1 * 2,
        weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
        processingTimeMachine2: Number.isFinite(p2) ? Math.max(0, p2) : p1,
      });
    });

    if (jobs.length >= 2) {
      onChange({ ...input, jobs });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div className="result-tabs" role="group" aria-label="Mode Penjadwalan">
          <button
            type="button"
            className={`nav-tab ${!isJohnson ? 'active' : ''}`}
            onClick={() => onChange({ ...input, mode: 'single_machine' })}
          >
            Single-Machine (6 Aturan Serentak)
          </button>
          <button
            type="button"
            className={`nav-tab ${isJohnson ? 'active' : ''}`}
            onClick={() => onChange({ ...input, mode: 'johnson_two_machine' })}
          >
            Flow Shop 2-Mesin (Algoritma Johnson)
          </button>
        </div>

        <button type="button" className="btn btn-sm" onClick={handleAddJob}>
          <Plus size={12} /> Tambah Work Order
        </button>
      </div>

      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        {isJohnson
          ? 'Mode Johnson 2-Mesin: masukkan waktu proses Mesin 1 diikuti Mesin 2 untuk mencari urutan Makespan tercepat.'
          : 'Mode Mesin Tunggal: mengevaluasi FCFS, SPT, WSPT (berbobot w), LPT, EDD, dan Critical Ratio sekaligus · Mendukung Ctrl+V Excel.'}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 46 }}>#</th>
              <th>ID Work Order / Job</th>
              <th>{isJohnson ? 'Waktu Mesin 1 (t₁)' : 'Waktu Proses (t)'}</th>
              {!isJohnson && <th>Due Date (Tenggat)</th>}
              {!isJohnson && <th>Bobot Prioritas (w)</th>}
              {isJohnson && <th>Waktu Mesin 2 (t₂)</th>}
              <th style={{ width: 48 }} />
            </tr>
          </thead>
          <tbody onPaste={handlePaste}>
            {input.jobs.map((job, idx) => (
              <tr key={idx}>
                <td className="mono-num" style={{ color: 'var(--text-muted)' }}>
                  {idx + 1}
                </td>
                <td>
                  <input
                    type="text"
                    className="grid-input"
                    value={job.jobId}
                    onChange={(e) => updateJob(idx, { jobId: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    className="grid-input mono-num"
                    value={job.processingTime}
                    onChange={(e) =>
                      updateJob(idx, {
                        processingTime: Math.max(0.1, Number(e.target.value) || 0.5),
                      })
                    }
                  />
                </td>
                {!isJohnson && (
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="grid-input mono-num"
                      value={job.dueDate}
                      onChange={(e) =>
                        updateJob(idx, { dueDate: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                )}
                {!isJohnson && (
                  <td>
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      className="grid-input mono-num"
                      value={job.weight ?? 1}
                      onChange={(e) =>
                        updateJob(idx, { weight: Math.max(0.1, Number(e.target.value) || 1) })
                      }
                    />
                  </td>
                )}
                {isJohnson && (
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="grid-input mono-num"
                      value={job.processingTimeMachine2 ?? 2}
                      onChange={(e) =>
                        updateJob(idx, {
                          processingTimeMachine2: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={input.jobs.length <= 2}
                    onClick={() => handleRemoveJob(idx)}
                    aria-label={`Hapus ${job.jobId}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
