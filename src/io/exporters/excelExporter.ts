import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type {
  ForecastingInput,
  ModuleId,
  ModuleInputData,
  MpsInput,
  MrpInput,
  SchedulingInput,
} from '../../core/types/module.types.ts';
import type { BatchRunSummary, ModuleJob } from '../../core/types/workspace.types.ts';
import { DEFAULT_MODULE_INPUTS } from '../templates/sampleDatasets.ts';

function sanitizeSheetName(raw: string, used: Set<string>): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, '_').slice(0, 28) || 'Sheet';
  let name = cleaned;
  let counter = 2;
  while (used.has(name.toLowerCase())) {
    name = `${cleaned.slice(0, 25)}_${counter}`;
    counter += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export function computeAutoColWidths(
  rows: (string | number | boolean | null | undefined)[][],
  minWch = 12,
  maxWch = 64,
): { wch: number }[] {
  const colMax: number[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      const str = cell === null || cell === undefined ? '' : String(cell);
      const longestLine = str.split(/\r?\n/).reduce((m, line) => Math.max(m, line.length), 0);
      const next = Math.min(maxWch, Math.max(minWch, longestLine + 3));
      colMax[c] = Math.max(colMax[c] ?? minWch, next);
    }
  }
  return colMax.map((wch) => ({ wch }));
}

export function moduleInputToSheetRows(
  moduleId: ModuleId,
  input: ModuleInputData,
): (string | number | boolean | null)[][] {
  switch (moduleId) {
    case 'forecasting': {
      const d = input as ForecastingInput;
      return [
        ['#module', 'forecasting'],
        ['movingAvgWindow', d.movingAvgWindow],
        ['alpha', d.alpha],
        ['beta', d.beta],
        ['seasonalPeriod', d.seasonalPeriod ?? 4],
        ['seasonalType', d.seasonalType ?? 'none'],
        ['autoOptimize', String(Boolean(d.autoOptimize))],
        ['horizon', d.horizon],
        ['Periode', 'Permintaan'],
        ...d.periodLabels.map((lbl, i) => [lbl, d.values[i] ?? 0]),
      ];
    }

    case 'mps': {
      const d = input as MpsInput;
      return [
        ['#module', 'mps'],
        ['productName', d.productName],
        ['beginningInventory', d.beginningInventory],
        ['safetyStock', d.safetyStock],
        ['demandTimeFence', d.demandTimeFence],
        ['planningTimeFence', d.planningTimeFence],
        ['frozenZonePolicy', d.frozenZonePolicy],
        ['liquidZonePolicy', d.liquidZonePolicy],
        ['lotSizing', d.lotSizing],
        ['lotSize', d.lotSize],
        ['poqPeriods', d.poqPeriods],
        ['setupCost', d.setupCost],
        ['holdingCostPerUnit', d.holdingCostPerUnit],
        ['stdHoursPerUnit', d.stdHoursPerUnit],
        ['Periode', 'Forecast', 'CustomerOrders', 'FirmMPS', 'AvailableCapacity'],
        ...d.periodLabels.map((lbl, i) => [
          lbl,
          d.forecasts[i] ?? 0,
          d.customerOrders[i] ?? 0,
          d.firmMps[i] ?? '',
          d.availableCapacity[i] ?? 160,
        ]),
      ];
    }

    case 'mrp': {
      const d = input as MrpInput;
      const grHeaders = d.periodLabels.map((p) => `GR_${p}`);
      const srHeaders = d.periodLabels.map((p) => `SR_${p}`);
      return [
        ['#module', 'mrp'],
        ['periodLabels', d.periodLabels.join(', ')],
        [
          'Item',
          'Level',
          'Parent',
          'QtyPerParent',
          'LeadTime',
          'OnHand',
          'SafetyStock',
          'LotSizing',
          'FixedOrderQty',
          'FixedOrderPeriods',
          'SetupCost',
          'HoldingCostPerUnit',
          ...grHeaders,
          ...srHeaders,
        ],
        ...d.items.map((it) => [
          it.item,
          it.level,
          it.parent ?? '',
          it.qtyPerParent,
          it.leadTime,
          it.onHand,
          it.safetyStock,
          it.lotSizing,
          it.fixedOrderQty ?? 100,
          it.fixedOrderPeriods ?? 2,
          it.setupCost ?? 250000,
          it.holdingCostPerUnit ?? 1500,
          ...d.periodLabels.map((_, t) => it.grossRequirements[t] ?? 0),
          ...d.periodLabels.map((_, t) => it.scheduledReceipts[t] ?? 0),
        ]),
      ];
    }

    case 'scheduling': {
      const d = input as SchedulingInput;
      return [
        ['#module', 'scheduling'],
        ['mode', d.mode],
        ['JobID', 'ProcessingTime', 'DueDate', 'Weight', 'Machine2Time'],
        ...d.jobs.map((j) => [
          j.jobId,
          j.processingTime,
          j.dueDate,
          j.weight ?? 1,
          j.processingTimeMachine2 ?? '',
        ]),
      ];
    }
  }
}

export async function generateMasterTemplateArrayBuffer(): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  for (const mod of MODULE_REGISTRY) {
    const rows = moduleInputToSheetRows(mod.id, DEFAULT_MODULE_INPUTS[mod.id]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = computeAutoColWidths(rows);
    const sheetName = sanitizeSheetName(`${mod.stageNumber}_${mod.code}_${mod.name}`, used);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export async function downloadMasterTemplateExcel(): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  for (const mod of MODULE_REGISTRY) {
    const rows = moduleInputToSheetRows(mod.id, DEFAULT_MODULE_INPUTS[mod.id]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = computeAutoColWidths(rows);
    const sheetName = sanitizeSheetName(`${mod.stageNumber}_${mod.code}_${mod.name}`, used);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, 'Template_4_Metode_Ha_Jodeya.xlsx');
}

export function buildBatchReportWorkbookRows(
  jobs: ModuleJob[],
  summary: BatchRunSummary,
): { sheetName: string; rows: (string | number)[][] }[] {
  const sheets: { sheetName: string; rows: (string | number)[][] }[] = [];
  const used = new Set<string>();

  const execRows: (string | number)[][] = [
    ['LAPORAN EKSEKUTIF HA JODEYA — 4-STAGE PPIC WORKBENCH'],
    ['Waktu Eksekusi', new Date(summary.finishedAt).toLocaleString('id-ID')],
    ['Total Durasi Batch (ms)', summary.totalDurationMs],
    ['Total Metode Dieksekusi', summary.totalJobs],
    [],
    ['Tahap', 'Kode', 'Nama Pekerjaan', 'Status', 'KPI Utama', 'Keputusan Inti (Pilar 1)', 'Durasi (ms)'],
  ];

  for (const job of jobs) {
    const res = summary.resultsByJobId[job.id];
    if (!res) continue;
    const meta = MODULE_MAP[job.moduleId];
    const mainKpi = res.kpis[0];
    execRows.push([
      meta.stageNumber,
      meta.code,
      job.title,
      res.status.toUpperCase(),
      mainKpi ? `${mainKpi.value}${mainKpi.unit ? ` ${mainKpi.unit}` : ''}` : '-',
      res.explanation.keyDecision,
      res.executionMs,
    ]);
  }

  sheets.push({
    sheetName: sanitizeSheetName('Ringkasan_Eksekutif', used),
    rows: execRows,
  });

  for (const job of jobs) {
    const res = summary.resultsByJobId[job.id];
    if (!res) continue;
    const meta = MODULE_MAP[job.moduleId];
    const exp = res.explanation;

    const detailRows: (string | number)[][] = [
      [`[${meta.stageNumber} · ${meta.code}] ${job.title}`],
      ['Status', res.status.toUpperCase()],
      ['Waktu Proses (ms)', res.executionMs],
      ['Ringkasan', res.summaryText],
      [],
      ['METRIK KPI UTAMA', 'NILAI'],
      ...res.kpis.map((k) => [k.label, `${k.value}${k.unit ? ` ${k.unit}` : ''}`]),
      [],
      ['PENJELASAN & INTERPRETASI JAWABAN (6-PILAR)'],
      ['Pilar 1 · Keputusan Inti', exp.keyDecision],
      ['Pilar 1 · Ringkasan Sederhana', exp.plainSummary],
      [],
      ['Pilar 2 · Arti & Dampak Angka', 'Nilai', 'Artinya', 'Dampak Operasional'],
      ...exp.metricBreakdown.map((m) => [m.label, m.value, m.meaning, m.impact]),
      [],
      ['Pilar 3 · Langkah Perhitungan', 'Rumus Umum', 'Substitusi Angka Aktual', 'Hasil'],
      ...exp.workedSteps.map((s) => [
        `${s.stepNumber}. ${s.title}`,
        s.formula,
        s.substitution,
        s.result,
      ]),
      [],
      ['Pilar 4 · Mengapa Jawaban Ini Keluar / Optimal?'],
      ...exp.whyOptimal.map((reason, idx) => [`Alasan ${idx + 1}`, reason]),
      [],
      ['Pilar 5 · Diagnosa Risiko & Rekomendasi Aksi'],
      ...exp.risksAndNotes.map((n) => [n.heading, n.detail]),
      ...exp.recommendations.map((rec, idx) => [`Rekomendasi ${idx + 1}`, rec]),
    ];

    for (const tbl of res.tables) {
      detailRows.push([]);
      detailRows.push([tbl.title]);
      detailRows.push(tbl.headers);
      detailRows.push(...tbl.rows);
    }

    sheets.push({
      sheetName: sanitizeSheetName(`${meta.stageNumber}_${meta.code}_${job.title}`, used),
      rows: detailRows,
    });
  }

  return sheets;
}

export async function exportBatchResultsExcel(
  jobs: ModuleJob[],
  summary: BatchRunSummary,
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const sheets = buildBatchReportWorkbookRows(jobs, summary);

  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = computeAutoColWidths(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.sheetName);
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Laporan_Hasil_Ha_Jodeya_${dateTag}.xlsx`);
}
