import { MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type { ModuleId } from '../../core/types/module.types.ts';

export type RawCell = string | number | boolean | null;
export type RawGrid = RawCell[][];

export interface DetectionOutcome {
  moduleId: ModuleId;
  confidence: number;
  reason: string;
}

const VALID_IDS = new Set<string>(MODULE_REGISTRY.map((m) => m.id));

const SHEET_ALIASES: Record<ModuleId, string[]> = {
  forecasting: ['forecasting', 'forecast', 'peramalan', 'ramalan', 'demand', 'fc'],
  mps: ['mps', 'masterproductionschedule', 'jadwalinduk', 'atp', 'rccp', 'pab'],
  mrp: ['mrp', 'bom', 'materialrequirements', 'kebutuhanmaterial', 'lotsizing'],
  scheduling: ['scheduling', 'schedule', 'penjadwalan', 'jobshop', 'johnson', 'spt', 'edd', 'sc'],
};

export function detectModuleFromGrid(
  fileName: string,
  sheetName: string,
  rows: RawGrid,
): DetectionOutcome {
  const flatText = rows
    .slice(0, 14)
    .flat()
    .map((c) => String(c ?? '').trim().toLowerCase())
    .join(' ');

  // 1. Explicit #module tag
  for (let r = 0; r < Math.min(6, rows.length); r += 1) {
    const first = String(rows[r][0] ?? '').trim().toLowerCase();
    const second = String(rows[r][1] ?? '').trim().toLowerCase();
    if (first === '#module' || first === 'module' || first === 'modul') {
      if (VALID_IDS.has(second)) {
        return {
          moduleId: second as ModuleId,
          confidence: 0.99,
          reason: `Tag eksplisit #module = ${second}`,
        };
      }
      if (second === 'mr') {
        return { moduleId: 'mrp', confidence: 0.98, reason: 'Tag eksplisit #module = mrp' };
      }
      if (second === 'sc') {
        return { moduleId: 'scheduling', confidence: 0.98, reason: 'Tag eksplisit #module = scheduling' };
      }
      if (second === 'fc') {
        return { moduleId: 'forecasting', confidence: 0.98, reason: 'Tag eksplisit #module = forecasting' };
      }
    }
  }

  // 2. Match sheet/file name against aliases
  const combined = `${sheetName} ${fileName}`.toLowerCase().replace(/\.[^.]+$/, '');
  for (const mod of MODULE_REGISTRY) {
    for (const alias of SHEET_ALIASES[mod.id]) {
      const regex = new RegExp(`(^|[^a-z0-9])${alias}([^a-z0-9]|$)`, 'i');
      if (regex.test(combined)) {
        return {
          moduleId: mod.id,
          confidence: 0.9,
          reason: `Nama sheet/berkas cocok dengan metode "${mod.name}"`,
        };
      }
    }
  }

  // 3. Heuristic header/content matching across the 4 PPIC methods
  if (
    (flatText.includes('customerorder') ||
      flatText.includes('customer order') ||
      flatText.includes('pesanan pelanggan') ||
      flatText.includes('dtf') ||
      flatText.includes('ptf') ||
      flatText.includes('rccp')) &&
    (flatText.includes('forecast') || flatText.includes('ramalan') || flatText.includes('kapasitas'))
  ) {
    return {
      moduleId: 'mps',
      confidence: 0.91,
      reason: 'Kolom Forecast + Customer Orders / Time Fence / RCCP terdeteksi (MPS)',
    };
  }

  if (
    (flatText.includes('onhand') || flatText.includes('on hand') || flatText.includes('leadtime') || flatText.includes('lead time')) &&
    (flatText.includes('parent') || flatText.includes('induk') || flatText.includes('level') || flatText.includes('lotsizing'))
  ) {
    return {
      moduleId: 'mrp',
      confidence: 0.9,
      reason: 'Kolom struktur BOM, Lead Time & On-Hand terdeteksi (MRP)',
    };
  }

  if (
    flatText.includes('duedate') ||
    flatText.includes('due date') ||
    flatText.includes('tenggat') ||
    flatText.includes('processingtime') ||
    flatText.includes('waktu proses') ||
    flatText.includes('machine2')
  ) {
    return {
      moduleId: 'scheduling',
      confidence: 0.88,
      reason: 'Kolom Waktu Proses & Due Date / Mesin 2 terdeteksi (Scheduling)',
    };
  }

  return {
    moduleId: 'forecasting',
    confidence: 0.72,
    reason: 'Deret waktu permintaan terdeteksi (Forecasting — dapat diubah di pratinjau)',
  };
}
