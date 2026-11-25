import { safeNum } from '../../core/math/matrix.ts';
import type {
  ForecastingInput,
  ModuleId,
  ModuleInputData,
  MpsInput,
  MpsLotSizingMethod,
  MrpInput,
  MrpItemInput,
  MrpLotSizingMethod,
  SchedulingInput,
  SchedulingJobInput,
} from '../../core/types/module.types.ts';
import { DEFAULT_MODULE_INPUTS } from '../templates/sampleDatasets.ts';
import {
  autoSuggestColumnMapping,
  detectHeaderRowIndex,
  isMetadataRow,
} from './columnMapping.ts';
import type { RawCell, RawGrid } from './fileDetector.ts';

function readMetaMap(rows: RawGrid, maxRow: number): Record<string, string> {
  const meta: Record<string, string> = {};
  for (let i = 0; i < Math.min(maxRow, rows.length); i += 1) {
    const row = rows[i];
    if (!isMetadataRow(row)) continue;
    const key = String(row[0] ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_#-]+/g, '');
    const val = String(row[1] ?? '').trim();
    if (key) meta[key] = val;
  }
  return meta;
}

function parseOptionalNumber(cell: RawCell): number | null {
  if (cell === null || cell === undefined) return null;
  const s = String(cell).trim();
  if (!s || s === '-' || s === '—') return null;
  const num = Number(s.replace(/,/g, '.'));
  return Number.isFinite(num) ? num : null;
}

function parseMpsLotMethod(raw: string | undefined, fallback: MpsLotSizingMethod): MpsLotSizingMethod {
  if (!raw) return fallback;
  const u = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (u === 'L4L' || u === 'LOT_FOR_LOT') return 'L4L';
  if (u === 'FOQ') return 'FOQ';
  if (u === 'LOT_MULTIPLE' || u === 'MULTIPLE') return 'LOT_MULTIPLE';
  if (u === 'POQ') return 'POQ';
  return fallback;
}

function parseMrpLotMethod(raw: string | undefined, fallback: MrpLotSizingMethod): MrpLotSizingMethod {
  if (!raw) return fallback;
  const u = raw.trim().toUpperCase();
  if (u.startsWith('L4L')) return 'L4L';
  if (u.startsWith('FOQ')) return 'FOQ';
  if (u.startsWith('POQ')) return 'POQ';
  if (u.startsWith('EOQ')) return 'EOQ';
  if (u === 'SM' || u.includes('SILVER')) return 'SM';
  return fallback;
}

export function mapGridToModuleInput(
  moduleId: ModuleId,
  rows: RawGrid,
  headerRowOverride?: number,
  columnMappingOverride?: Record<string, number>,
): ModuleInputData {
  const headerIdx =
    headerRowOverride !== undefined && headerRowOverride >= 0 && headerRowOverride < rows.length
      ? headerRowOverride
      : detectHeaderRowIndex(rows);

  const headerRow = rows[headerIdx] ?? [];
  const meta = readMetaMap(rows, headerIdx);
  const colMap = {
    ...autoSuggestColumnMapping(moduleId, headerRow),
    ...columnMappingOverride,
  };
  const dataRows = rows
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));

  switch (moduleId) {
    case 'forecasting': {
      const def = structuredClone(DEFAULT_MODULE_INPUTS.forecasting) as ForecastingInput;
      const pCol = colMap.period ?? 0;
      const vCol = colMap.value ?? (headerRow.length > 1 ? 1 : 0);
      const periodLabels: string[] = [];
      const values: number[] = [];

      dataRows.forEach((r, idx) => {
        const val = parseOptionalNumber(r[vCol]);
        if (val === null) return;
        const lbl = String(r[pCol] ?? '').trim() || `P${idx + 1}`;
        periodLabels.push(lbl);
        values.push(val);
      });

      const sTypeRaw = meta.seasonaltype?.toLowerCase();
      const seasonalType: ForecastingInput['seasonalType'] =
        sTypeRaw === 'additive' || sTypeRaw === 'multiplicative' || sTypeRaw === 'none'
          ? sTypeRaw
          : def.seasonalType;

      return {
        moduleId: 'forecasting',
        periodLabels: periodLabels.length >= 3 ? periodLabels : def.periodLabels,
        values: values.length >= 3 ? values : def.values,
        movingAvgWindow: Math.max(2, Math.round(safeNum(meta.movingavgwindow, def.movingAvgWindow))),
        weightedWeights: def.weightedWeights,
        alpha: safeNum(meta.alpha, def.alpha),
        beta: safeNum(meta.beta, def.beta),
        gamma: safeNum(meta.gamma, def.gamma ?? 0.3),
        seasonalPeriod: Math.max(2, Math.round(safeNum(meta.seasonalperiod, def.seasonalPeriod ?? 4))),
        seasonalType,
        autoOptimize:
          meta.autooptimize !== undefined
            ? meta.autooptimize.toLowerCase() === 'true' || meta.autooptimize === '1'
            : def.autoOptimize,
        horizon: Math.max(1, Math.round(safeNum(meta.horizon, def.horizon))),
      };
    }

    case 'mps': {
      const def = structuredClone(DEFAULT_MODULE_INPUTS.mps) as MpsInput;
      const pCol = colMap.period ?? 0;
      const fCol = colMap.forecast ?? 1;
      const coCol = colMap.customerOrders ?? 2;
      const firmCol = colMap.firmMps;
      const capCol = colMap.availableCapacity;

      const periodLabels: string[] = [];
      const forecasts: number[] = [];
      const customerOrders: number[] = [];
      const firmMps: (number | null)[] = [];
      const availableCapacity: number[] = [];

      dataRows.forEach((r, idx) => {
        const fVal = parseOptionalNumber(r[fCol]);
        const coVal = parseOptionalNumber(r[coCol]);
        if (fVal === null && coVal === null) return;
        periodLabels.push(String(r[pCol] ?? '').trim() || `Mgg ${idx + 1}`);
        forecasts.push(Math.max(0, fVal ?? 0));
        customerOrders.push(Math.max(0, coVal ?? 0));
        firmMps.push(firmCol !== undefined ? parseOptionalNumber(r[firmCol]) : null);
        availableCapacity.push(
          capCol !== undefined ? Math.max(0, safeNum(r[capCol], 160)) : 160,
        );
      });

      return {
        moduleId: 'mps',
        productName: meta.productname || def.productName,
        beginningInventory: Math.max(0, safeNum(meta.beginninginventory, def.beginningInventory)),
        safetyStock: Math.max(0, safeNum(meta.safetystock, def.safetyStock)),
        demandTimeFence: Math.max(0, Math.round(safeNum(meta.demandtimefence, def.demandTimeFence))),
        planningTimeFence: Math.max(0, Math.round(safeNum(meta.planningtimefence, def.planningTimeFence))),
        frozenZonePolicy:
          meta.frozenzonepolicy === 'max' ? 'max' : 'orders_only',
        liquidZonePolicy:
          meta.liquidzonepolicy === 'forecast_only' ? 'forecast_only' : 'max',
        lotSizing: parseMpsLotMethod(meta.lotsizing, def.lotSizing),
        lotSize: Math.max(1, Math.round(safeNum(meta.lotsize, def.lotSize))),
        poqPeriods: Math.max(1, Math.round(safeNum(meta.poqperiods, def.poqPeriods))),
        setupCost: Math.max(0, safeNum(meta.setupcost, def.setupCost)),
        holdingCostPerUnit: Math.max(0, safeNum(meta.holdingcostperunit, def.holdingCostPerUnit)),
        stdHoursPerUnit: Math.max(0.01, safeNum(meta.stdhoursperunit, def.stdHoursPerUnit)),
        periodLabels: periodLabels.length > 0 ? periodLabels : def.periodLabels,
        forecasts: forecasts.length > 0 ? forecasts : def.forecasts,
        customerOrders: customerOrders.length > 0 ? customerOrders : def.customerOrders,
        firmMps: firmMps.length > 0 ? firmMps : def.firmMps,
        availableCapacity: availableCapacity.length > 0 ? availableCapacity : def.availableCapacity,
      };
    }

    case 'mrp': {
      const def = structuredClone(DEFAULT_MODULE_INPUTS.mrp) as MrpInput;
      const itemCol = colMap.item ?? 0;
      const lvlCol = colMap.level ?? 1;
      const parentCol = colMap.parent ?? 2;
      const qtyCol = colMap.qtyPerParent ?? 3;
      const ltCol = colMap.leadTime ?? 4;
      const ohCol = colMap.onHand ?? 5;
      const ssCol = colMap.safetyStock ?? 6;
      const lotCol = colMap.lotSizing ?? 7;
      const foqCol = colMap.fixedOrderQty ?? 8;
      const poqCol = colMap.fixedOrderPeriods ?? 9;
      const setupCol = colMap.setupCost ?? 10;
      const holdCol = colMap.holdingCostPerUnit ?? 11;

      // Detect trailing Gross/Sched period columns if present (e.g. GR_1..GR_T and SR_1..SR_T)
      const grColIndices: { col: number; label: string }[] = [];
      const srColIndices: number[] = [];
      headerRow.forEach((hCell, cIdx) => {
        const hStr = String(hCell ?? '').trim();
        if (/^gr[_\s:-]/i.test(hStr)) {
          grColIndices.push({ col: cIdx, label: hStr.replace(/^gr[_\s:-]+/i, '').trim() || `P${grColIndices.length + 1}` });
        } else if (/^sr[_\s:-]/i.test(hStr)) {
          srColIndices.push(cIdx);
        }
      });

      const periodLabels =
        grColIndices.length > 0
          ? grColIndices.map((g) => g.label)
          : meta.periodlabels
            ? meta.periodlabels.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean)
            : def.periodLabels;
      const T = periodLabels.length;

      const items: MrpItemInput[] = [];
      dataRows.forEach((r) => {
        const name = String(r[itemCol] ?? '').trim();
        if (!name) return;
        const grossRequirements =
          grColIndices.length > 0
            ? grColIndices.map((g) => Math.max(0, safeNum(r[g.col], 0)))
            : Array<number>(T).fill(0);
        const scheduledReceipts =
          srColIndices.length > 0
            ? Array.from({ length: T }, (_, t) =>
                srColIndices[t] !== undefined ? Math.max(0, safeNum(r[srColIndices[t]], 0)) : 0,
              )
            : Array<number>(T).fill(0);

        items.push({
          item: name,
          level: Math.max(0, Math.round(safeNum(r[lvlCol], 0))),
          parent: String(r[parentCol] ?? '').trim(),
          qtyPerParent: Math.max(0.01, safeNum(r[qtyCol], 1)),
          leadTime: Math.max(0, Math.round(safeNum(r[ltCol], 1))),
          onHand: Math.max(0, safeNum(r[ohCol], 0)),
          safetyStock: Math.max(0, safeNum(r[ssCol], 0)),
          lotSizing: parseMrpLotMethod(String(r[lotCol] ?? ''), 'L4L'),
          fixedOrderQty: Math.max(1, Math.round(safeNum(r[foqCol], 100))),
          fixedOrderPeriods: Math.max(1, Math.round(safeNum(r[poqCol], 2))),
          setupCost: Math.max(0, safeNum(r[setupCol], 250000)),
          holdingCostPerUnit: Math.max(0, safeNum(r[holdCol], 1500)),
          grossRequirements,
          scheduledReceipts,
        });
      });

      // If Level-0 had no GR columns in CSV, preserve default Level-0 demand so solver produces meaningful output
      if (items.length > 0 && grColIndices.length === 0 && items[0].grossRequirements.every((v) => v === 0)) {
        items[0].grossRequirements = def.items[0].grossRequirements.slice(0, T);
      }

      return {
        moduleId: 'mrp',
        periodLabels,
        items: items.length > 0 ? items : def.items,
      };
    }

    case 'scheduling': {
      const def = structuredClone(DEFAULT_MODULE_INPUTS.scheduling) as SchedulingInput;
      const idCol = colMap.jobId ?? 0;
      const p1Col = colMap.processingTime ?? 1;
      const dueCol = colMap.dueDate ?? 2;
      const wCol = colMap.weight;
      const p2Col = colMap.processingTimeMachine2;

      const jobs: SchedulingJobInput[] = [];
      dataRows.forEach((r, idx) => {
        const proc = parseOptionalNumber(r[p1Col]);
        if (proc === null) return;
        const jobId = String(r[idCol] ?? '').trim() || `WO-${idx + 1}`;
        const dueDate = dueCol !== undefined ? Math.max(0, safeNum(r[dueCol], proc * 2)) : proc * 2;
        const weight = wCol !== undefined ? Math.max(0.1, safeNum(r[wCol], 1)) : 1;
        const m2 = p2Col !== undefined ? parseOptionalNumber(r[p2Col]) : null;
        jobs.push({
          jobId,
          processingTime: Math.max(0.1, proc),
          dueDate,
          weight,
          processingTimeMachine2: m2 !== null ? Math.max(0, m2) : undefined,
        });
      });

      const modeRaw = meta.mode?.toLowerCase() ?? '';
      const mode: SchedulingInput['mode'] =
        modeRaw.includes('johnson') || modeRaw.includes('two')
          ? 'johnson_two_machine'
          : 'single_machine';

      return {
        moduleId: 'scheduling',
        mode,
        jobs: jobs.length > 0 ? jobs : def.jobs,
      };
    }
  }
}
