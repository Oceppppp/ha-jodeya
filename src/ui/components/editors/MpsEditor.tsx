import { Plus, Trash2 } from 'lucide-react';
import type { MpsInput, MpsLotSizingMethod } from '../../../core/types/module.types.ts';
import { parseClipboardGrid } from '../../utils/gridPaste.ts';

interface MpsEditorProps {
  input: MpsInput;
  onChange: (next: MpsInput) => void;
}

export function MpsEditor({ input, onChange }: MpsEditorProps) {
  const T = input.periodLabels.length;

  const handleAddPeriod = () => {
    const nextIdx = T + 1;
    const lastF = input.forecasts[T - 1] ?? 180;
    const lastCap = input.availableCapacity[T - 1] ?? 160;
    onChange({
      ...input,
      periodLabels: [...input.periodLabels, `Mgg ${nextIdx}`],
      forecasts: [...input.forecasts, lastF],
      customerOrders: [...input.customerOrders, 0],
      firmMps: [...input.firmMps, null],
      availableCapacity: [...input.availableCapacity, lastCap],
    });
  };

  const handleRemovePeriod = (idx: number) => {
    if (T <= 2) return;
    onChange({
      ...input,
      periodLabels: input.periodLabels.filter((_, i) => i !== idx),
      forecasts: input.forecasts.filter((_, i) => i !== idx),
      customerOrders: input.customerOrders.filter((_, i) => i !== idx),
      firmMps: input.firmMps.filter((_, i) => i !== idx),
      availableCapacity: input.availableCapacity.filter((_, i) => i !== idx),
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    const grid = parseClipboardGrid(text);
    if (grid.length < 2) return;
    e.preventDefault();

    const periodLabels: string[] = [];
    const forecasts: number[] = [];
    const customerOrders: number[] = [];
    const firmMps: (number | null)[] = [];
    const availableCapacity: number[] = [];

    grid.forEach((row, idx) => {
      if (row.length < 2) return;
      const f = Number(row[1]?.replace(/,/g, '.'));
      if (!Number.isFinite(f)) return;
      const co = Number((row[2] ?? '0').replace(/,/g, '.'));
      const firmRaw = (row[3] ?? '').trim();
      const firmVal =
        firmRaw !== '' && firmRaw !== '-' ? Number(firmRaw.replace(/,/g, '.')) : null;
      const cap = Number((row[4] ?? '160').replace(/,/g, '.'));

      periodLabels.push(row[0] || `Mgg ${idx + 1}`);
      forecasts.push(Math.max(0, f));
      customerOrders.push(Number.isFinite(co) ? Math.max(0, co) : 0);
      firmMps.push(firmVal !== null && Number.isFinite(firmVal) ? Math.max(0, firmVal) : null);
      availableCapacity.push(Number.isFinite(cap) && cap > 0 ? cap : 160);
    });

    if (periodLabels.length >= 1) {
      onChange({
        ...input,
        periodLabels,
        forecasts,
        customerOrders,
        firmMps,
        availableCapacity,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div className="param-section-stack">
        {/* Group 1: Produk & Persediaan Awal (3 cols) */}
        <div className="param-subcard">
          <div className="param-subcard-title">Identitas Produk &amp; Persediaan</div>
          <div className="param-grid-3">
            <div className="field-group">
              <label className="field-label">Nama Produk Jadi</label>
              <input
                type="text"
                className="form-control"
                value={input.productName}
                onChange={(e) => onChange({ ...input, productName: e.target.value })}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Stok Awal (Beginning Inv.)</label>
              <input
                type="number"
                min={0}
                className="form-control mono-num"
                value={input.beginningInventory}
                onChange={(e) =>
                  onChange({
                    ...input,
                    beginningInventory: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label">Safety Stock (SS)</label>
              <input
                type="number"
                min={0}
                className="form-control mono-num"
                value={input.safetyStock}
                onChange={(e) =>
                  onChange({ ...input, safetyStock: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
          </div>
        </div>

        {/* Group 2: Time Fence & Aturan Lot-Sizing (4 cols) */}
        <div className="param-subcard">
          <div className="param-subcard-title">Kebijakan Time Fence &amp; Lot-Sizing MPS</div>
          <div className="param-grid-4">
            <div className="field-group">
              <label className="field-label">Demand Time Fence (DTF)</label>
              <input
                type="number"
                min={0}
                max={T}
                className="form-control mono-num"
                value={input.demandTimeFence}
                onChange={(e) => {
                  const dtf = Math.max(0, Math.min(T, Number(e.target.value) || 0));
                  onChange({
                    ...input,
                    demandTimeFence: dtf,
                    planningTimeFence: Math.max(dtf, input.planningTimeFence),
                  });
                }}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Planning Time Fence (PTF)</label>
              <input
                type="number"
                min={input.demandTimeFence}
                max={T}
                className="form-control mono-num"
                value={input.planningTimeFence}
                onChange={(e) =>
                  onChange({
                    ...input,
                    planningTimeFence: Math.max(
                      input.demandTimeFence,
                      Math.min(T, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label">Kebijakan Zona Frozen (≤ DTF)</label>
              <select
                className="form-control"
                value={input.frozenZonePolicy}
                onChange={(e) =>
                  onChange({
                    ...input,
                    frozenZonePolicy: e.target.value as MpsInput['frozenZonePolicy'],
                  })
                }
              >
                <option value="orders_only">Hanya Customer Orders</option>
                <option value="max">Max(Forecast, Customer Orders)</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">Aturan Lot-Sizing MPS</label>
              <select
                className="form-control"
                value={input.lotSizing}
                onChange={(e) =>
                  onChange({ ...input, lotSizing: e.target.value as MpsLotSizingMethod })
                }
              >
                <option value="FOQ">FOQ (Fixed Order Qty)</option>
                <option value="L4L">L4L (Lot-for-Lot)</option>
                <option value="LOT_MULTIPLE">Lot-Multiple (Kelipatan Q)</option>
                <option value="POQ">POQ (Periodic Order Qty)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Group 3: Ukuran Batch, Kapasitas RCCP & Parameter Biaya */}
        <div className="param-subcard">
          <div className="param-subcard-title">Kapasitas RCCP &amp; Parameter Biaya</div>
          <div
            className={
              input.lotSizing === 'L4L' ? 'param-grid-3' : 'param-grid-4'
            }
          >
            {(input.lotSizing === 'FOQ' || input.lotSizing === 'LOT_MULTIPLE') && (
              <div className="field-group">
                <label className="field-label">Ukuran Batch Lot (Q)</label>
                <input
                  type="number"
                  min={1}
                  className="form-control mono-num"
                  value={input.lotSize}
                  onChange={(e) =>
                    onChange({ ...input, lotSize: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
            )}

            {input.lotSizing === 'POQ' && (
              <div className="field-group">
                <label className="field-label">Cakupan Periode POQ</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="form-control mono-num"
                  value={input.poqPeriods}
                  onChange={(e) =>
                    onChange({ ...input, poqPeriods: Math.max(1, Number(e.target.value) || 2) })
                  }
                />
              </div>
            )}

            <div className="field-group">
              <label className="field-label">Jam Standar / Unit (RCCP)</label>
              <input
                type="number"
                step={0.05}
                min={0.01}
                className="form-control mono-num"
                value={input.stdHoursPerUnit}
                onChange={(e) =>
                  onChange({
                    ...input,
                    stdHoursPerUnit: Math.max(0.01, Number(e.target.value) || 0.5),
                  })
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label">Biaya Setup per Batch</label>
              <input
                type="number"
                min={0}
                className="form-control mono-num"
                value={input.setupCost}
                onChange={(e) =>
                  onChange({ ...input, setupCost: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label">Biaya Simpan / Unit / Periode</label>
              <input
                type="number"
                min={0}
                className="form-control mono-num"
                value={input.holdingCostPerUnit}
                onChange={(e) =>
                  onChange({
                    ...input,
                    holdingCostPerUnit: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
          </div>
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
          Jadwal Permintaan &amp; Kapasitas ({T} periode) · Kosongkan Firm MPS untuk perhitungan otomatis · Mendukung Ctrl+V Excel
        </span>
        <button type="button" className="btn btn-sm" onClick={handleAddPeriod}>
          <Plus size={12} /> Tambah Periode
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Zona</th>
              <th>Forecast</th>
              <th>Customer Orders</th>
              <th>Firm MPS (Opsional)</th>
              <th>Kapasitas RCCP (Jam)</th>
              <th style={{ width: 48 }} />
            </tr>
          </thead>
          <tbody onPaste={handlePaste}>
            {input.periodLabels.map((lbl, idx) => {
              const pNum = idx + 1;
              const zone =
                pNum <= input.demandTimeFence
                  ? 'Frozen'
                  : pNum <= input.planningTimeFence
                    ? 'Slushy'
                    : 'Liquid';
              return (
                <tr key={idx}>
                  <td>
                    <input
                      type="text"
                      className="grid-input"
                      value={lbl}
                      onChange={(e) => {
                        const next = [...input.periodLabels];
                        next[idx] = e.target.value;
                        onChange({ ...input, periodLabels: next });
                      }}
                    />
                  </td>
                  <td>
                    <span
                      className={`badge mono-num ${
                        zone === 'Frozen'
                          ? 'badge-primary'
                          : zone === 'Slushy'
                            ? 'badge-warning'
                            : ''
                      }`}
                    >
                      {zone}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="grid-input mono-num"
                      value={input.forecasts[idx] ?? 0}
                      onChange={(e) => {
                        const next = [...input.forecasts];
                        next[idx] = Math.max(0, Number(e.target.value) || 0);
                        onChange({ ...input, forecasts: next });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="grid-input mono-num"
                      value={input.customerOrders[idx] ?? 0}
                      onChange={(e) => {
                        const next = [...input.customerOrders];
                        next[idx] = Math.max(0, Number(e.target.value) || 0);
                        onChange({ ...input, customerOrders: next });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      placeholder="Auto"
                      className="grid-input mono-num"
                      value={input.firmMps[idx] ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const next = [...input.firmMps];
                        next[idx] = raw === '' ? null : Math.max(0, Number(raw) || 0);
                        onChange({ ...input, firmMps: next });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="grid-input mono-num"
                      value={input.availableCapacity[idx] ?? 160}
                      onChange={(e) => {
                        const next = [...input.availableCapacity];
                        next[idx] = Math.max(0, Number(e.target.value) || 0);
                        onChange({ ...input, availableCapacity: next });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={T <= 2}
                      onClick={() => handleRemovePeriod(idx)}
                      aria-label={`Hapus periode ${lbl}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
