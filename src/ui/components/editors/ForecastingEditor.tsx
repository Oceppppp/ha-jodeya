import { Plus, Trash2 } from 'lucide-react';
import type { ForecastingInput } from '../../../core/types/module.types.ts';
import { parseClipboardGrid, parseClipboardNumber } from '../../utils/gridPaste.ts';

interface ForecastingEditorProps {
  input: ForecastingInput;
  onChange: (next: ForecastingInput) => void;
}

export function ForecastingEditor({ input, onChange }: ForecastingEditorProps) {
  const handleAddPeriod = () => {
    const nextIdx = input.periodLabels.length + 1;
    const lastVal = input.values[input.values.length - 1] ?? 100;
    onChange({
      ...input,
      periodLabels: [...input.periodLabels, `P${nextIdx}`],
      values: [...input.values, lastVal],
    });
  };

  const handleRemovePeriod = (idx: number) => {
    if (input.values.length <= 3) return;
    onChange({
      ...input,
      periodLabels: input.periodLabels.filter((_, i) => i !== idx),
      values: input.values.filter((_, i) => i !== idx),
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    const grid = parseClipboardGrid(text);
    if (grid.length < 2) return;
    e.preventDefault();

    const periodLabels: string[] = [];
    const values: number[] = [];
    grid.forEach((row, idx) => {
      if (row.length >= 2) {
        const num = Number(row[1].replace(/,/g, '.'));
        if (!Number.isFinite(num)) return;
        periodLabels.push(row[0] || `P${idx + 1}`);
        values.push(num);
      } else if (row.length === 1) {
        const num = Number(row[0].replace(/,/g, '.'));
        if (!Number.isFinite(num)) return;
        periodLabels.push(`P${idx + 1}`);
        values.push(num);
      }
    });

    if (values.length >= 3) {
      onChange({ ...input, periodLabels, values });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div className="param-grid">
        <div className="field-group">
          <label className="field-label">Horizon Proyeksi (h)</label>
          <input
            type="number"
            min={1}
            max={24}
            className="form-control mono-num"
            value={input.horizon}
            onChange={(e) =>
              onChange({ ...input, horizon: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })
            }
          />
        </div>

        <div className="field-group">
          <label className="field-label">Jendela Moving Avg (k)</label>
          <input
            type="number"
            min={2}
            max={12}
            className="form-control mono-num"
            value={input.movingAvgWindow}
            onChange={(e) =>
              onChange({ ...input, movingAvgWindow: Math.max(2, Number(e.target.value) || 3) })
            }
          />
        </div>

        <div className="field-group">
          <label className="field-label">Alpha Smoothing (α)</label>
          <input
            type="number"
            step={0.05}
            min={0.01}
            max={0.99}
            className="form-control mono-num"
            value={input.alpha}
            onChange={(e) =>
              onChange({ ...input, alpha: parseClipboardNumber(e.target.value, 0.3) })
            }
          />
        </div>

        <div className="field-group">
          <label className="field-label">Beta Tren Holt (β)</label>
          <input
            type="number"
            step={0.05}
            min={0.01}
            max={0.99}
            className="form-control mono-num"
            value={input.beta}
            onChange={(e) =>
              onChange({ ...input, beta: parseClipboardNumber(e.target.value, 0.2) })
            }
          />
        </div>

        <div className="field-group">
          <label className="field-label">Mode Musiman (Seasonal)</label>
          <select
            className="form-control"
            value={input.seasonalType ?? 'none'}
            onChange={(e) =>
              onChange({
                ...input,
                seasonalType: e.target.value as ForecastingInput['seasonalType'],
              })
            }
          >
            <option value="none">Tanpa Musiman</option>
            <option value="multiplicative">Multiplikatif (Holt-Winters)</option>
            <option value="additive">Aditif (Holt-Winters)</option>
          </select>
        </div>

        {input.seasonalType && input.seasonalType !== 'none' && (
          <div className="field-group">
            <label className="field-label">Panjang Siklus Musim (L)</label>
            <input
              type="number"
              min={2}
              max={12}
              className="form-control mono-num"
              value={input.seasonalPeriod ?? 4}
              onChange={(e) =>
                onChange({ ...input, seasonalPeriod: Math.max(2, Number(e.target.value) || 4) })
              }
            />
          </div>
        )}

        <div className="field-group" style={{ justifyContent: 'flex-end' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              height: 32,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(input.autoOptimize)}
              onChange={(e) => onChange({ ...input, autoOptimize: e.target.checked })}
            />
            Auto-Optimize (α, β) via Grid Search
          </label>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Data Historis ({input.values.length} periode) · Tempel langsung blok 2 kolom dari Excel (Ctrl+V)
        </span>
        <button type="button" className="btn btn-sm" onClick={handleAddPeriod}>
          <Plus size={12} /> Tambah Periode
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 54 }}>#</th>
              <th>Label Periode</th>
              <th>Permintaan Aktual (Y)</th>
              <th style={{ width: 54 }} />
            </tr>
          </thead>
          <tbody onPaste={handlePaste}>
            {input.values.map((val, idx) => (
              <tr key={idx}>
                <td className="mono-num" style={{ color: 'var(--text-muted)' }}>
                  {idx + 1}
                </td>
                <td>
                  <input
                    type="text"
                    className="grid-input"
                    value={input.periodLabels[idx] ?? `P${idx + 1}`}
                    onChange={(e) => {
                      const next = [...input.periodLabels];
                      next[idx] = e.target.value;
                      onChange({ ...input, periodLabels: next });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="grid-input mono-num"
                    value={val}
                    onChange={(e) => {
                      const next = [...input.values];
                      next[idx] = Number(e.target.value) || 0;
                      onChange({ ...input, values: next });
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={input.values.length <= 3}
                    onClick={() => handleRemovePeriod(idx)}
                    aria-label={`Hapus periode ${idx + 1}`}
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
