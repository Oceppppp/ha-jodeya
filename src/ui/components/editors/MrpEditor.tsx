import { Plus, Trash2 } from 'lucide-react';
import type {
  MrpInput,
  MrpItemInput,
  MrpLotSizingMethod,
} from '../../../core/types/module.types.ts';
import { parseClipboardGrid } from '../../utils/gridPaste.ts';

interface MrpEditorProps {
  input: MrpInput;
  onChange: (next: MrpInput) => void;
}

export function MrpEditor({ input, onChange }: MrpEditorProps) {
  const T = input.periodLabels.length;

  const updateItem = (idx: number, patch: Partial<MrpItemInput>) => {
    const next = input.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ ...input, items: next });
  };

  const handleAddPeriod = () => {
    const nextLbl = `Mgg ${T + 1}`;
    onChange({
      ...input,
      periodLabels: [...input.periodLabels, nextLbl],
      items: input.items.map((it) => ({
        ...it,
        grossRequirements: [...it.grossRequirements, 0],
        scheduledReceipts: [...it.scheduledReceipts, 0],
      })),
    });
  };

  const handleRemovePeriod = () => {
    if (T <= 2) return;
    onChange({
      ...input,
      periodLabels: input.periodLabels.slice(0, -1),
      items: input.items.map((it) => ({
        ...it,
        grossRequirements: it.grossRequirements.slice(0, -1),
        scheduledReceipts: it.scheduledReceipts.slice(0, -1),
      })),
    });
  };

  const handleAddItem = () => {
    const parentDefault = input.items[0]?.item ?? '';
    const newItem: MrpItemInput = {
      item: `Komponen-${input.items.length + 1}`,
      level: 1,
      parent: parentDefault ? `${parentDefault}:1` : '',
      qtyPerParent: 1,
      leadTime: 1,
      onHand: 20,
      safetyStock: 0,
      lotSizing: 'L4L',
      fixedOrderQty: 150,
      fixedOrderPeriods: 2,
      setupCost: 250000,
      holdingCostPerUnit: 1500,
      grossRequirements: Array<number>(T).fill(0),
      scheduledReceipts: Array<number>(T).fill(0),
    };
    onChange({ ...input, items: [...input.items, newItem] });
  };

  const handleRemoveItem = (idx: number) => {
    if (input.items.length <= 1) return;
    onChange({ ...input, items: input.items.filter((_, i) => i !== idx) });
  };

  const handlePasteBom = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    const grid = parseClipboardGrid(text);
    if (grid.length < 2) return;
    e.preventDefault();

    const parsedItems: MrpItemInput[] = [];
    grid.forEach((row) => {
      if (!row[0]) return;
      const lvl = Number(row[1]);
      if (!Number.isFinite(lvl)) return;
      parsedItems.push({
        item: row[0],
        level: Math.max(0, Math.round(lvl)),
        parent: row[2] ?? '',
        qtyPerParent: Math.max(0.1, Number(row[3]) || 1),
        leadTime: Math.max(0, Math.round(Number(row[4]) || 1)),
        onHand: Math.max(0, Number(row[5]) || 0),
        safetyStock: Math.max(0, Number(row[6]) || 0),
        lotSizing: (['L4L', 'FOQ', 'POQ', 'EOQ', 'SM'].includes(
          (row[7] ?? '').toUpperCase(),
        )
          ? (row[7].toUpperCase() as MrpLotSizingMethod)
          : 'L4L'),
        fixedOrderQty: Math.max(1, Number(row[8]) || 150),
        fixedOrderPeriods: 2,
        setupCost: Math.max(0, Number(row[9]) || 250000),
        holdingCostPerUnit: Math.max(0, Number(row[10]) || 1500),
        grossRequirements: Array<number>(T).fill(0),
        scheduledReceipts: Array<number>(T).fill(0),
      });
    });

    if (parsedItems.length > 0) {
      parsedItems[0].grossRequirements =
        input.items[0]?.grossRequirements.slice(0, T) ?? Array<number>(T).fill(100);
      onChange({ ...input, items: parsedItems });
    }
  };

  const level0Items = input.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.level === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
          Daftar Struktur BOM ({input.items.length} item, {T} periode) · Multi-parent tulis <code>IndukA:2, IndukB:1</code>
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" onClick={handleAddPeriod}>
            <Plus size={12} /> + Periode
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={T <= 2}
            onClick={handleRemovePeriod}
          >
            - Periode
          </button>
          <button type="button" className="btn btn-sm" onClick={handleAddItem}>
            <Plus size={12} /> Tambah Item BOM
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item / Komponen</th>
              <th>Lvl</th>
              <th>Induk (Parent:Qty)</th>
              <th>Qty</th>
              <th>LT</th>
              <th>On-Hand</th>
              <th>SS</th>
              <th>Metode Lot</th>
              <th>FOQ / POQ</th>
              <th>Setup (S)</th>
              <th>Simpan (H)</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody onPaste={handlePasteBom}>
            {input.items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    className="grid-input"
                    style={{ minWidth: 130 }}
                    value={it.item}
                    onChange={(e) => updateItem(idx, { item: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    className="grid-input mono-num"
                    style={{ width: 52, minWidth: 52 }}
                    value={it.level}
                    onChange={(e) =>
                      updateItem(idx, { level: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder={it.level === 0 ? '— (Produk Jadi)' : 'Induk:1'}
                    className="grid-input"
                    style={{ minWidth: 135 }}
                    value={it.parent ?? ''}
                    onChange={(e) => updateItem(idx, { parent: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    className="grid-input mono-num"
                    style={{ width: 58, minWidth: 58 }}
                    value={it.qtyPerParent}
                    onChange={(e) =>
                      updateItem(idx, { qtyPerParent: Math.max(0.1, Number(e.target.value) || 1) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="grid-input mono-num"
                    style={{ width: 54, minWidth: 54 }}
                    value={it.leadTime}
                    onChange={(e) =>
                      updateItem(idx, { leadTime: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="grid-input mono-num"
                    value={it.onHand}
                    onChange={(e) =>
                      updateItem(idx, { onHand: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="grid-input mono-num"
                    value={it.safetyStock}
                    onChange={(e) =>
                      updateItem(idx, { safetyStock: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <select
                    className="grid-input"
                    style={{ minWidth: 92 }}
                    value={it.lotSizing}
                    onChange={(e) =>
                      updateItem(idx, { lotSizing: e.target.value as MrpLotSizingMethod })
                    }
                  >
                    <option value="L4L">L4L</option>
                    <option value="FOQ">FOQ</option>
                    <option value="POQ">POQ</option>
                    <option value="EOQ">EOQ</option>
                    <option value="SM">Silver-Meal</option>
                  </select>
                </td>
                <td>
                  {it.lotSizing === 'POQ' ? (
                    <input
                      type="number"
                      min={1}
                      className="grid-input mono-num"
                      title="Periode POQ"
                      value={it.fixedOrderPeriods ?? 2}
                      onChange={(e) =>
                        updateItem(idx, {
                          fixedOrderPeriods: Math.max(1, Number(e.target.value) || 2),
                        })
                      }
                    />
                  ) : (
                    <input
                      type="number"
                      min={1}
                      className="grid-input mono-num"
                      title="Ukuran Lot FOQ"
                      value={it.fixedOrderQty ?? 100}
                      onChange={(e) =>
                        updateItem(idx, {
                          fixedOrderQty: Math.max(1, Number(e.target.value) || 100),
                        })
                      }
                    />
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="grid-input mono-num"
                    value={it.setupCost ?? 250000}
                    onChange={(e) =>
                      updateItem(idx, { setupCost: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="grid-input mono-num"
                    value={it.holdingCostPerUnit ?? 1500}
                    onChange={(e) =>
                      updateItem(idx, {
                        holdingCostPerUnit: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={input.items.length <= 1}
                    onClick={() => handleRemoveItem(idx)}
                    aria-label={`Hapus item ${it.item}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Level-0 Gross Requirements & Scheduled Receipts Period Matrix */}
      {level0Items.length > 0 && (
        <div>
          <div className="sheet-section-label">
            Gross Requirements Level-0 &amp; Scheduled Receipts per Periode
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item / Jenis Baris</th>
                  {input.periodLabels.map((lbl, t) => (
                    <th key={t}>
                      <input
                        type="text"
                        className="grid-input mono-num"
                        style={{ minWidth: 64 }}
                        value={lbl}
                        onChange={(e) => {
                          const next = [...input.periodLabels];
                          next[t] = e.target.value;
                          onChange({ ...input, periodLabels: next });
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {level0Items.map(({ it, idx }) => (
                  <tr key={`gr-${idx}`}>
                    <td style={{ fontWeight: 600 }}>
                      {it.item} · <span className="badge badge-primary">Gross Req</span>
                    </td>
                    {input.periodLabels.map((_, t) => (
                      <td key={t}>
                        <input
                          type="number"
                          min={0}
                          className="grid-input mono-num"
                          value={it.grossRequirements[t] ?? 0}
                          onChange={(e) => {
                            const nextGr = [...it.grossRequirements];
                            nextGr[t] = Math.max(0, Number(e.target.value) || 0);
                            updateItem(idx, { grossRequirements: nextGr });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

                {input.items.map((it, idx) => (
                  <tr key={`sr-${idx}`}>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {it.item} · Scheduled Receipts
                    </td>
                    {input.periodLabels.map((_, t) => (
                      <td key={t}>
                        <input
                          type="number"
                          min={0}
                          className="grid-input mono-num"
                          value={it.scheduledReceipts[t] ?? 0}
                          onChange={(e) => {
                            const nextSr = [...it.scheduledReceipts];
                            nextSr[t] = Math.max(0, Number(e.target.value) || 0);
                            updateItem(idx, { scheduledReceipts: nextSr });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
