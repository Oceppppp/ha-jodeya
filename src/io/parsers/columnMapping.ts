import type { ModuleId } from '../../core/types/module.types.ts';
import type { RawCell, RawGrid } from './fileDetector.ts';

export interface ColumnFieldSpec {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

const META_ROW_KEYS = new Set([
  'mode',
  'alpha',
  'beta',
  'gamma',
  'seasonalperiod',
  'seasonaltype',
  'autooptimize',
  'horizon',
  'movingavgwindow',
  'weightedweights',
  'productname',
  'beginninginventory',
  'safetystock',
  'demandtimefence',
  'planningtimefence',
  'frozenzonepolicy',
  'liquidzonepolicy',
  'lotsizing',
  'lotsize',
  'poqperiods',
  'setupcost',
  'holdingcostperunit',
  'stdhoursperunit',
  'periodlabels',
]);

export function isMetadataRow(row: RawCell[]): boolean {
  const c0 = String(row[0] ?? '').trim().toLowerCase();
  if (!c0) return false;
  if (c0.startsWith('#') || c0 === 'module' || c0 === 'modul') return true;
  const nonEmptyCount = row.filter((c) => String(c ?? '').trim() !== '').length;
  return nonEmptyCount <= 2 && META_ROW_KEYS.has(c0.replace(/[\s_-]+/g, ''));
}

export function detectHeaderRowIndex(rows: RawGrid): number {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) continue;
    if (isMetadataRow(row)) continue;
    return i;
  }
  return 0;
}

export function getModuleMappingFields(moduleId: ModuleId): ColumnFieldSpec[] {
  switch (moduleId) {
    case 'forecasting':
      return [
        {
          key: 'period',
          label: 'Label Periode',
          aliases: ['periode', 'period', 'bulan', 'month', 'minggu', 'week', 'kuartal', 'tanggal', 'tahun'],
        },
        {
          key: 'value',
          label: 'Permintaan Aktual (Y)',
          required: true,
          aliases: ['permintaan', 'demand', 'aktual', 'actual', 'qty', 'jumlah', 'penjualan', 'sales', 'value', 'nilai'],
        },
      ];
    case 'mps':
      return [
        {
          key: 'period',
          label: 'Label Periode',
          aliases: ['periode', 'period', 'minggu', 'week', 'bulan', 'month'],
        },
        {
          key: 'forecast',
          label: 'Forecast Permintaan',
          required: true,
          aliases: ['forecast', 'forecasts', 'ramalan', 'peramalan', 'proyeksi'],
        },
        {
          key: 'customerOrders',
          label: 'Customer Orders',
          required: true,
          aliases: ['customerorders', 'customerorder', 'orders', 'pesanan', 'pesananpelanggan', 'co', 'booked'],
        },
        {
          key: 'firmMps',
          label: 'Firm MPS (Opsional)',
          aliases: ['firmmps', 'firm', 'mpsmanual', 'jadwalmanual'],
        },
        {
          key: 'availableCapacity',
          label: 'Kapasitas RCCP (Jam)',
          aliases: ['availablecapacity', 'capacity', 'kapasitas', 'jamtersedia', 'rccpcap'],
        },
      ];
    case 'mrp':
      return [
        {
          key: 'item',
          label: 'Nama Item / Komponen',
          required: true,
          aliases: ['item', 'material', 'komponen', 'part', 'sku', 'nama'],
        },
        {
          key: 'level',
          label: 'Level BOM',
          aliases: ['level', 'lvl', 'llc', 'tingkat'],
        },
        {
          key: 'parent',
          label: 'Induk (Parent)',
          aliases: ['parent', 'induk', 'assembly'],
        },
        {
          key: 'qtyPerParent',
          label: 'Qty / Induk',
          aliases: ['qtyperparent', 'qty', 'jumlah', 'pemakaian', 'bomqty'],
        },
        {
          key: 'leadTime',
          label: 'Lead Time',
          aliases: ['leadtime', 'lt', 'tunggu', 'waktutunggu'],
        },
        {
          key: 'onHand',
          label: 'Stok On-Hand',
          aliases: ['onhand', 'stok', 'inventory', 'persediaan'],
        },
        {
          key: 'safetyStock',
          label: 'Safety Stock',
          aliases: ['safetystock', 'safety', 'ss', 'stokpengaman'],
        },
        {
          key: 'lotSizing',
          label: 'Metode Lot-Sizing',
          aliases: ['lotsizing', 'lotsize', 'lot', 'metode'],
        },
        {
          key: 'fixedOrderQty',
          label: 'Ukuran Lot (FOQ)',
          aliases: ['fixedorderqty', 'foq', 'orderqty'],
        },
        {
          key: 'fixedOrderPeriods',
          label: 'Periode POQ',
          aliases: ['fixedorderperiods', 'poqperiods', 'poq'],
        },
        {
          key: 'setupCost',
          label: 'Biaya Setup / Pesan',
          aliases: ['setupcost', 'ordercost', 'biayapesan', 'biayasetup'],
        },
        {
          key: 'holdingCostPerUnit',
          label: 'Biaya Simpan / Unit',
          aliases: ['holdingcostperunit', 'holdingcost', 'biayasimpan'],
        },
      ];
    case 'scheduling':
      return [
        {
          key: 'jobId',
          label: 'ID Job / Work Order',
          required: true,
          aliases: ['jobid', 'job', 'workorder', 'wo', 'order', 'id', 'nama'],
        },
        {
          key: 'processingTime',
          label: 'Waktu Proses (Mesin 1)',
          required: true,
          aliases: ['processingtime', 'waktuproses', 'proses', 'mesin1', 'machine1', 'durasi', 't1', 'p1'],
        },
        {
          key: 'dueDate',
          label: 'Due Date / Tenggat',
          aliases: ['duedate', 'due', 'tenggat', 'deadline', 'batas'],
        },
        {
          key: 'weight',
          label: 'Bobot Prioritas (w)',
          aliases: ['weight', 'bobot', 'prioritas', 'w'],
        },
        {
          key: 'processingTimeMachine2',
          label: 'Waktu Proses Mesin 2',
          aliases: ['processingtimemachine2', 'machine2time', 'mesin2', 'machine2', 't2', 'p2'],
        },
      ];
  }
}

function normHeader(val: RawCell): string {
  return String(val ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function autoSuggestColumnMapping(
  moduleId: ModuleId,
  headerRow: RawCell[] = [],
): Record<string, number> {
  const fields = getModuleMappingFields(moduleId);
  const mapping: Record<string, number> = {};
  const normalizedHeaders = headerRow.map(normHeader);
  const usedCols = new Set<number>();

  for (const field of fields) {
    const exactIdx = normalizedHeaders.findIndex(
      (h, colIdx) => !usedCols.has(colIdx) && field.aliases.includes(h),
    );
    if (exactIdx >= 0) {
      mapping[field.key] = exactIdx;
      usedCols.add(exactIdx);
      continue;
    }
    const partialIdx = normalizedHeaders.findIndex(
      (h, colIdx) =>
        !usedCols.has(colIdx) &&
        h.length > 0 &&
        field.aliases.some(
          (alias) => alias.length >= 3 && (h.includes(alias) || alias.includes(h)),
        ),
    );
    if (partialIdx >= 0) {
      mapping[field.key] = partialIdx;
      usedCols.add(partialIdx);
    }
  }

  return mapping;
}
