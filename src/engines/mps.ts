import { buildErrorExplanation } from '../core/explanation/explanationBuilder.ts';
import { GLOSSARY_BY_MODULE } from '../core/explanation/glossaryCatalog.ts';
import { formatNum, roundTo } from '../core/math/matrix.ts';
import type {
  ModuleExecutionResult,
  MpsInput,
  MpsLotSizingMethod,
  ResultTable,
} from '../core/types/module.types.ts';

interface MpsLotSimulation {
  method: MpsLotSizingMethod;
  label: string;
  mpsReceipts: number[];
  pab: number[];
  discreteAtp: (number | null)[];
  cumulativeAtp: number[];
  orderCount: number;
  totalMpsUnits: number;
  setupCostTotal: number;
  holdingCostTotal: number;
  totalRelevantCost: number;
  minPab: number;
  minDiscreteAtp: number;
  overPromisePeriods: string[];
}

const ALL_MPS_LOT_METHODS: MpsLotSizingMethod[] = ['L4L', 'FOQ', 'LOT_MULTIPLE', 'POQ'];

function formatLotMethodLabel(
  method: MpsLotSizingMethod,
  lotSize: number,
  poqPeriods: number,
): string {
  if (method === 'L4L') return 'L4L (Lot-for-Lot)';
  if (method === 'FOQ') return `FOQ (${lotSize})`;
  if (method === 'LOT_MULTIPLE') return `Lot-Multiple (×${lotSize})`;
  return `POQ (${poqPeriods} periode)`;
}

function simulateMpsLotMethod(
  method: MpsLotSizingMethod,
  input: MpsInput,
  effectiveDemand: number[],
  customerOrders: number[],
  firmMps: (number | null)[],
): MpsLotSimulation {
  const T = input.periodLabels.length;
  const begInv = Math.max(0, input.beginningInventory);
  const ss = Math.max(0, input.safetyStock);
  const lotSize = Math.max(1, Math.round(input.lotSize || 100));
  const poqPeriods = Math.max(1, Math.round(input.poqPeriods || 2));
  const setupCost = Math.max(0, input.setupCost || 0);
  const holdingCost = Math.max(0, input.holdingCostPerUnit || 0);

  const mpsReceipts = Array<number>(T).fill(0);
  const pab = Array<number>(T).fill(0);
  let prevPab = begInv;
  let orderCount = 0;

  for (let t = 0; t < T; t += 1) {
    const req = effectiveDemand[t];
    const firm = firmMps[t];

    if (firm !== null && firm !== undefined && Number.isFinite(firm) && firm >= 0) {
      mpsReceipts[t] = firm;
    } else {
      const projectedWithoutMps = prevPab - req;
      if (projectedWithoutMps < ss - 1e-9) {
        const netShortage = ss - projectedWithoutMps;
        if (method === 'L4L') {
          mpsReceipts[t] = netShortage;
        } else if (method === 'FOQ') {
          // Standard FOQ orders one fixed batch; if a single batch is smaller than shortage, order enough batches to cover SS
          mpsReceipts[t] = netShortage <= lotSize ? lotSize : Math.ceil(netShortage / lotSize) * lotSize;
        } else if (method === 'LOT_MULTIPLE') {
          mpsReceipts[t] = Math.ceil(netShortage / lotSize) * lotSize;
        } else {
          // POQ: cover net shortage at t plus incremental demand for next (poqPeriods - 1) non-firm periods
          let qty = netShortage;
          let simPab = ss;
          const maxK = Math.min(T - 1, t + poqPeriods - 1);
          for (let k = t + 1; k <= maxK; k += 1) {
            if (firmMps[k] !== null && firmMps[k] !== undefined) break;
            const dNext = effectiveDemand[k];
            if (simPab - dNext < ss) {
              qty += ss - (simPab - dNext);
              simPab = ss;
            } else {
              simPab -= dNext;
            }
          }
          mpsReceipts[t] = qty;
        }
      } else {
        mpsReceipts[t] = 0;
      }
    }

    if (mpsReceipts[t] > 1e-9) {
      orderCount += 1;
    }
    pab[t] = roundTo(prevPab + mpsReceipts[t] - req, 4);
    prevPab = pab[t];
  }

  // Discrete ATP (Look-ahead until next positive MPS receipt; Period 0 always evaluated)
  const discreteAtp: (number | null)[] = Array<number | null>(T).fill(null);
  const overPromisePeriods: string[] = [];
  let minDiscreteAtp = Infinity;

  for (let t = 0; t < T; t += 1) {
    const isAtpAnchor = t === 0 || mpsReceipts[t] > 1e-9;
    if (!isAtpAnchor) continue;

    let nextMpsIdx = T;
    for (let k = t + 1; k < T; k += 1) {
      if (mpsReceipts[k] > 1e-9) {
        nextMpsIdx = k;
        break;
      }
    }

    let coWindowSum = 0;
    for (let k = t; k < nextMpsIdx; k += 1) {
      coWindowSum += customerOrders[k];
    }

    const supply = (t === 0 ? begInv : 0) + mpsReceipts[t];
    const atpVal = roundTo(supply - coWindowSum, 4);
    discreteAtp[t] = atpVal;
    if (atpVal < minDiscreteAtp) minDiscreteAtp = atpVal;
    if (atpVal < -1e-6) {
      overPromisePeriods.push(
        `${input.periodLabels[t] ?? `P${t + 1}`} (${formatNum(atpVal, 1)} unit)`,
      );
    }
  }

  if (!Number.isFinite(minDiscreteAtp)) minDiscreteAtp = 0;

  // Cumulative ATP
  const cumulativeAtp = Array<number>(T).fill(0);
  let runningCumAtp = begInv;
  for (let t = 0; t < T; t += 1) {
    runningCumAtp = roundTo(runningCumAtp + mpsReceipts[t] - customerOrders[t], 4);
    cumulativeAtp[t] = runningCumAtp;
  }

  const setupCostTotal = roundTo(orderCount * setupCost, 2);
  const holdingCostTotal = roundTo(
    pab.reduce((acc, v) => acc + Math.max(0, v) * holdingCost, 0),
    2,
  );
  const totalMpsUnits = roundTo(mpsReceipts.reduce((a, b) => a + b, 0), 2);
  const minPab = pab.length > 0 ? Math.min(...pab) : begInv;

  return {
    method,
    label: formatLotMethodLabel(method, lotSize, poqPeriods),
    mpsReceipts,
    pab,
    discreteAtp,
    cumulativeAtp,
    orderCount,
    totalMpsUnits,
    setupCostTotal,
    holdingCostTotal,
    totalRelevantCost: roundTo(setupCostTotal + holdingCostTotal, 2),
    minPab,
    minDiscreteAtp,
    overPromisePeriods,
  };
}

export function solveMps(
  jobId: string,
  jobTitle: string,
  input: MpsInput,
): ModuleExecutionResult {
  const start = performance.now();
  const T = input.periodLabels.length;

  if (T === 0) {
    const errPack = buildErrorExplanation(
      'mps',
      'Horizon periode MPS kosong sehingga jadwal produksi induk tidak dapat disusun.',
      'Tambahkan minimal 1 periode beserta angka Forecast dan Customer Orders.',
    );
    return {
      jobId,
      moduleId: 'mps',
      jobTitle,
      status: 'error',
      executionMs: 0,
      summaryText: 'Horizon periode MPS kosong.',
      kpis: [],
      tables: [],
      charts: [],
      warnings: ['Tambahkan minimal 1 periode perencanaan MPS.'],
      derivedValues: {},
      auditSteps: [],
      analysis: errPack.analysis,
      explanation: errPack.explanation,
      error: 'Horizon periode MPS kosong.',
    };
  }

  const dtf = Math.max(0, Math.min(T, Math.round(input.demandTimeFence || 0)));
  const ptf = Math.max(dtf, Math.min(T, Math.round(input.planningTimeFence || dtf)));
  const begInv = Math.max(0, input.beginningInventory || 0);
  const ss = Math.max(0, input.safetyStock || 0);
  const stdHours = Math.max(0, input.stdHoursPerUnit || 0);

  const forecasts = Array.from({ length: T }, (_, t) => Math.max(0, input.forecasts[t] ?? 0));
  const customerOrders = Array.from({ length: T }, (_, t) =>
    Math.max(0, input.customerOrders[t] ?? 0),
  );
  const firmMps = Array.from({ length: T }, (_, t) => {
    const raw = input.firmMps?.[t];
    return raw !== null && raw !== undefined && Number.isFinite(raw) && raw >= 0 ? raw : null;
  });
  const availableCap = Array.from({ length: T }, (_, t) =>
    Math.max(0, input.availableCapacity?.[t] ?? 0),
  );

  // 1. Zone & Effective Demand per period
  const zoneLabels: string[] = [];
  const effectiveDemand: number[] = [];

  for (let t = 0; t < T; t += 1) {
    const periodNum = t + 1;
    const f = forecasts[t];
    const co = customerOrders[t];
    if (periodNum <= dtf) {
      zoneLabels.push('Frozen');
      effectiveDemand.push(input.frozenZonePolicy === 'orders_only' ? co : Math.max(f, co));
    } else if (periodNum <= ptf) {
      zoneLabels.push('Slushy');
      effectiveDemand.push(Math.max(f, co));
    } else {
      zoneLabels.push('Liquid');
      effectiveDemand.push(input.liquidZonePolicy === 'forecast_only' ? f : Math.max(f, co));
    }
  }

  // 2. Simulate active method & all 4 lot-sizing methods
  const allSims = ALL_MPS_LOT_METHODS.map((m) =>
    simulateMpsLotMethod(m, input, effectiveDemand, customerOrders, firmMps),
  );
  const chosen = allSims.find((s) => s.method === input.lotSizing) ?? allSims[0];
  const bestCostSim = [...allSims].sort((a, b) => a.totalRelevantCost - b.totalRelevantCost)[0];

  // 3. Rough-Cut Capacity Planning (RCCP)
  const rccpLoad = chosen.mpsReceipts.map((qty) => roundTo(qty * stdHours, 2));
  const rccpUtilPct = rccpLoad.map((load, t) => {
    const cap = availableCap[t];
    if (cap <= 1e-9) return load > 1e-9 ? 999 : 0;
    return roundTo((load / cap) * 100, 2);
  });

  const overloadPeriods: string[] = [];
  rccpUtilPct.forEach((u, t) => {
    if (u > 100 + 1e-6) {
      const excessHrs = roundTo(rccpLoad[t] - availableCap[t], 2);
      overloadPeriods.push(
        `${input.periodLabels[t] ?? `P${t + 1}`} (${formatNum(u, 1)}%, kelebihan +${formatNum(excessHrs, 1)} jam)`,
      );
    }
  });

  const peakUtil = rccpUtilPct.length > 0 ? Math.max(...rccpUtilPct) : 0;
  const totalPositiveDiscreteAtp = roundTo(
    chosen.discreteAtp.reduce<number>((sum, val) => sum + (val !== null && val > 0 ? val : 0), 0),
    2,
  );
  const totalEffectiveDemand = roundTo(effectiveDemand.reduce((a, b) => a + b, 0), 2);
  const potentialLotSavings = Math.max(0, roundTo(chosen.totalRelevantCost - bestCostSim.totalRelevantCost, 2));

  const warnings: string[] = [];
  if (chosen.overPromisePeriods.length > 0) {
    warnings.push(
      `Over-Promise ATP (< 0) terdeteksi pada: ${chosen.overPromisePeriods.join(', ')}. Komitmen Customer Orders melebihi stok + MPS!`,
    );
  }
  if (chosen.minPab < -1e-6) {
    warnings.push(
      `Saldo PAB bernilai negatif (${formatNum(chosen.minPab, 1)} unit) akibat Firm MPS terlalu kecil dibanding Effective Demand.`,
    );
  }
  if (overloadPeriods.length > 0) {
    warnings.push(
      `Overload Kapasitas RCCP (> 100%) terdeteksi pada: ${overloadPeriods.join('; ')}.`,
    );
  }

  // Tables
  const mpsMasterTable: ResultTable = {
    id: 'mps-master-grid',
    title: `Tabel Induk MPS: ${input.productName || 'Produk Jadi'} (I₀=${begInv}, SS=${ss}, DTF=${dtf}, PTF=${ptf}, ${chosen.label})`,
    headers: ['Baris MPS', ...input.periodLabels.map((lbl, i) => `${lbl} (${zoneLabels[i]})`)],
    rows: [
      ['Forecast Permintaan', ...forecasts.map((v) => roundTo(v, 2))],
      ['Customer Orders (Pesanan)', ...customerOrders.map((v) => roundTo(v, 2))],
      ['Effective Demand (Dₜ)', ...effectiveDemand.map((v) => roundTo(v, 2))],
      ['Projected Available Balance (PAB)', ...chosen.pab.map((v) => roundTo(v, 2))],
      ['MPS Receipts (Jadwal Produksi)', ...chosen.mpsReceipts.map((v) => roundTo(v, 2))],
      [
        'Discrete ATP (Stok Bebas Janji)',
        ...chosen.discreteAtp.map((v) => (v !== null ? roundTo(v, 2) : '—')),
      ],
      ['Cumulative ATP', ...chosen.cumulativeAtp.map((v) => roundTo(v, 2))],
    ],
    highlightRowIndices: [4, 5],
  };

  const rccpTable: ResultTable = {
    id: 'mps-rccp-table',
    title: `Verifikasi Kapasitas Kasar (RCCP — ${formatNum(stdHours, 2)} Jam/Unit)`,
    headers: ['Periode', 'Zona', 'MPS Receipt', 'Beban Jam (Load)', 'Kapasitas Tersedia', 'Utilisasi (%)', 'Status RCCP'],
    rows: input.periodLabels.map((lbl, t) => [
      lbl,
      zoneLabels[t],
      roundTo(chosen.mpsReceipts[t], 2),
      rccpLoad[t],
      roundTo(availableCap[t], 2),
      `${formatNum(rccpUtilPct[t], 1)}%`,
      rccpUtilPct[t] > 100 + 1e-6 ? 'OVERLOAD' : rccpLoad[t] === 0 ? 'Idle (0%)' : 'Layak',
    ]),
    highlightRowIndices: rccpUtilPct
      .map((u, idx) => (u > 100 + 1e-6 ? idx : -1))
      .filter((idx) => idx >= 0),
  };

  const lotCompTable: ResultTable = {
    id: 'mps-lot-comparison',
    title: 'Perbandingan Biaya Aturan Lot-Sizing MPS (Setup + Simpan PAB)',
    headers: ['Metode Lot MPS', 'Frekuensi Batch', 'Total Unit MPS', 'Biaya Setup', 'Biaya Simpan', 'Total Biaya Relevan'],
    rows: allSims.map((sim) => [
      `${sim.label}${sim.method === chosen.method ? ' (Aktif)' : ''}${sim.method === bestCostSim.method ? ' ★' : ''}`,
      sim.orderCount,
      sim.totalMpsUnits,
      sim.setupCostTotal,
      sim.holdingCostTotal,
      sim.totalRelevantCost,
    ]),
    highlightRowIndices: [allSims.findIndex((s) => s.method === bestCostSim.method)],
  };

  // Triggered vs Zero-MPS period breakdown for causal explanation
  const activeMpsPeriods = chosen.mpsReceipts
    .map((q, i) => (q > 1e-9 ? `${input.periodLabels[i]} (${formatNum(q, 0)} unit)` : null))
    .filter((x): x is string => x !== null);
  const zeroMpsPeriods = chosen.mpsReceipts
    .map((q, i) => (q <= 1e-9 ? input.periodLabels[i] : null))
    .filter((x): x is string => x !== null);

  // Pick first period that triggered MPS for worked substitution
  const firstTriggerIdx = chosen.mpsReceipts.findIndex((q) => q > 1e-9);
  const sampleIdx = firstTriggerIdx >= 0 ? firstTriggerIdx : 0;
  const samplePrevPab = sampleIdx === 0 ? begInv : chosen.pab[sampleIdx - 1];
  const sampleLbl = input.periodLabels[sampleIdx] ?? `P${sampleIdx + 1}`;

  const whyOptimalReasons: string[] = [
    activeMpsPeriods.length > 0
      ? `Jadwal produksi MPS muncul tepat pada ${activeMpsPeriods.join(', ')} karena pada periode-periode tersebut saldo persediaan berjalan dikurangi Effective Demand akan jatuh di bawah batas Safety Stock (${formatNum(ss, 0)} unit) bila tidak diproduksi (contoh pada ${sampleLbl}: PAB awal ${formatNum(samplePrevPab, 0)} - Demand ${formatNum(effectiveDemand[sampleIdx], 0)} = ${formatNum(samplePrevPab - effectiveDemand[sampleIdx], 0)} < SS ${formatNum(ss, 0)} → sistem memicu produksi ${formatNum(chosen.mpsReceipts[sampleIdx], 0)} unit).`
      : `Seluruh periode bernilai MPS = 0 karena persediaan awal (${formatNum(begInv, 0)} unit) sudah mencukupi seluruh Effective Demand (${formatNum(totalEffectiveDemand, 0)} unit) tanpa menyentuh bawah Safety Stock.`,
    zeroMpsPeriods.length > 0
      ? `Pada periode ${zeroMpsPeriods.join(', ')}, angka MPS bernilai 0 unit karena sisa saldo PAB dari batch sebelumnya masih cukup menutup permintaan efektif sekaligus menjaga Safety Stock ${formatNum(ss, 0)} unit.`
      : 'Produksi dijadwalkan di setiap periode mengikuti permintaan bersih berjalan (pola mendekati Lot-for-Lot).',
    overloadPeriods.length > 0
      ? `Terdeteksi Overload RCCP pada ${overloadPeriods.join('; ')} karena ukuran batch MPS dikali ${formatNum(stdHours, 2)} jam/unit melampaui jam kapasitas reguler stasiun kritis pada periode tersebut.`
      : `Seluruh ${T} periode dinyatakan Layak Kapasitas (puncak utilisasi RCCP ${formatNum(peakUtil, 1)}% ≤ 100%), sehingga jadwal induk realistis dieksekusi lantai produksi.`,
    potentialLotSavings > 1e-6
      ? `Perbandingan 4 metode lot menunjukkan "${bestCostSim.label}" mampu menurunkan total biaya Setup + Simpan dari ${formatNum(chosen.totalRelevantCost, 2)} menjadi ${formatNum(bestCostSim.totalRelevantCost, 2)} (hemat ${formatNum(potentialLotSavings, 2)}).`
      : `Aturan lot "${chosen.label}" yang aktif sudah menjadi metode paling ekonomis (★) dengan total biaya Setup + Simpan minimum ${formatNum(chosen.totalRelevantCost, 2)}.`,
  ];

  const analysisSections = [
    {
      heading: 'Ketersediaan ATP & Kebijakan Time Fence (DTF / PTF)',
      body:
        chosen.overPromisePeriods.length > 0
          ? `PERINGATAN OVER-PROMISE: Discrete ATP bernilai negatif pada ${chosen.overPromisePeriods.join(', ')}. Pesanan pelanggan yang masuk melampaui stok awal + batch MPS pada jendela tersebut.`
          : `Komitmen pesanan pelanggan sepenuhnya aman (0 Over-Promise). Tersedia total Discrete ATP positif sebesar ${formatNum(totalPositiveDiscreteAtp, 0)} unit yang siap dijanjikan tim sales untuk order baru tanpa mengganggu pesanan eksisting.`,
      tone: chosen.overPromisePeriods.length > 0 ? ('critical' as const) : ('positive' as const),
    },
    {
      heading: 'Kelayakan Kapasitas Kasar (RCCP) & Efisiensi Lot',
      body:
        overloadPeriods.length > 0
          ? `Puncak beban RCCP mencapai ${formatNum(peakUtil, 1)}% dengan overload pada ${overloadPeriods.join('; ')}.${potentialLotSavings > 1e-6 ? ` Mengganti aturan lot ke ${bestCostSim.label} juga berpotensi menghemat biaya ${formatNum(potentialLotSavings, 2)}.` : ''}`
          : `Beban jam kerja stasiun kritis terkendali dengan puncak utilisasi ${formatNum(peakUtil, 1)}% (aman di bawah 100%).${potentialLotSavings > 1e-6 ? ` Namun biaya lot masih dapat dihemat ${formatNum(potentialLotSavings, 2)} jika beralih ke ${bestCostSim.label}.` : ' Aturan lot saat ini juga sudah paling hemat biaya.'}`,
      tone:
        overloadPeriods.length > 0 || potentialLotSavings > 1e-6
          ? ('caution' as const)
          : ('positive' as const),
    },
  ];

  const recommendations: string[] = [];
  if (overloadPeriods.length > 0) {
    recommendations.push(
      `Atasi Overload RCCP pada ${overloadPeriods.join('; ')} dengan memajukan sebagian produksi (load-leveling) ke periode sebelumnya yang masih longgar, menambah jam lembur, atau mengecilkan ukuran batch MPS.`,
    );
  }
  if (chosen.overPromisePeriods.length > 0) {
    recommendations.push(
      `Negosiasikan ulang tanggal pengiriman pesanan baru atau naikkan Firm MPS pada ${chosen.overPromisePeriods.join(', ')} agar nilai Discrete ATP kembali ≥ 0.`,
    );
  }
  if (potentialLotSavings > 1e-6) {
    recommendations.push(
      `Pertimbangkan beralih dari ${chosen.label} ke ${bestCostSim.label} untuk menghemat biaya relevan sebesar ${formatNum(potentialLotSavings, 2)}.`,
    );
  }
  recommendations.push(
    `Salurkan deret MPS Receipts [${chosen.mpsReceipts.map((v) => roundTo(v, 0)).join(', ')}] langsung sebagai Gross Requirements Level-0 pada modul MRP (Tahap 03).`,
  );

  const auditSteps = [
    {
      title: '1. Penentuan Effective Demand Berdasarkan Time Fence (DTF & PTF)',
      formula: `Frozen (t ≤ ${dtf}): ${input.frozenZonePolicy === 'orders_only' ? 'COₜ' : 'max(Fₜ, COₜ)'} · Slushy (${dtf} < t ≤ ${ptf}): max(Fₜ, COₜ) · Liquid (t > ${ptf}): ${input.liquidZonePolicy === 'forecast_only' ? 'Fₜ' : 'max(Fₜ, COₜ)'}`,
      detail: `Menghasilkan total Effective Demand ${formatNum(totalEffectiveDemand, 0)} unit sepanjang ${T} periode.`,
    },
    {
      title: `2. Netting PAB & Pemicu Produksi MPS (${chosen.label})`,
      formula: 'Jika PABₜ₋₁ - Dₜ < SafetyStock maka picu MPSₜ;  PABₜ = PABₜ₋₁ + MPSₜ - Dₜ',
      detail: `Contoh pada ${sampleLbl}: PAB awal ${formatNum(samplePrevPab, 0)} - Dₜ ${formatNum(effectiveDemand[sampleIdx], 0)} + MPS ${formatNum(chosen.mpsReceipts[sampleIdx], 0)} = PAB akhir ${formatNum(chosen.pab[sampleIdx], 0)} unit.`,
    },
    {
      title: '3. Perhitungan Discrete ATP & Utilisasi Kapasitas RCCP',
      formula: 'ATP₁ = I₀ + MPS₁ - ∑CO(sebelum MPS berikut) · Utilₜ = (MPSₜ × StdHours) / Capₜ × 100%',
      detail: `Total Discrete ATP bebas = ${formatNum(totalPositiveDiscreteAtp, 0)} unit; puncak utilisasi RCCP = ${formatNum(peakUtil, 1)}% (${overloadPeriods.length} periode overload).`,
    },
  ];

  const headlineStatus =
    chosen.overPromisePeriods.length > 0
      ? `Peringatan Kritis: Over-Promise ATP pada ${chosen.overPromisePeriods.length} Periode`
      : overloadPeriods.length > 0
        ? `Jadwal MPS Memenuhi ATP (${formatNum(totalPositiveDiscreteAtp, 0)} Unit), Namun Overload RCCP di ${overloadPeriods.length} Periode`
        : `Jadwal Induk MPS Layak Penuh — ${formatNum(chosen.totalMpsUnits, 0)} Unit (${chosen.orderCount} Batch) & Kapasitas Aman`;

  const elapsed = roundTo(performance.now() - start, 2);

  return {
    jobId,
    moduleId: 'mps',
    jobTitle,
    status: warnings.length > 0 ? 'warning' : 'success',
    executionMs: elapsed,
    summaryText: `MPS (${chosen.label}): total produksi ${formatNum(chosen.totalMpsUnits, 0)} unit (${chosen.orderCount} batch), Discrete ATP bebas ${formatNum(totalPositiveDiscreteAtp, 0)} unit, puncak RCCP ${formatNum(peakUtil, 1)}%.`,
    kpis: [
      { label: 'Total Produksi MPS', value: formatNum(chosen.totalMpsUnits, 0), unit: 'unit', emphasis: 'primary' },
      {
        label: 'Discrete ATP Bebas',
        value: formatNum(totalPositiveDiscreteAtp, 0),
        unit: 'unit',
        emphasis: chosen.overPromisePeriods.length > 0 ? 'error' : 'success',
      },
      {
        label: 'Puncak Utilisasi RCCP',
        value: `${formatNum(peakUtil, 1)}%`,
        emphasis: overloadPeriods.length > 0 ? 'warning' : 'success',
      },
      { label: 'Total Biaya Lot MPS', value: formatNum(chosen.totalRelevantCost, 2) },
    ],
    tables: [mpsMasterTable, rccpTable, lotCompTable],
    charts: [
      {
        kind: 'line',
        id: 'mps-balance-chart',
        title: 'Profil Effective Demand, MPS Receipts & Saldo PAB',
        subtitle: `Produk: ${input.productName || 'Produk Jadi'} · Safety Stock = ${formatNum(ss, 0)} unit`,
        xLabel: 'Periode',
        yLabel: 'Unit',
        series: [
          {
            name: 'Effective Demand',
            colorToken: 'var(--chart-1)',
            points: input.periodLabels.map((lbl, i) => ({ x: lbl, y: roundTo(effectiveDemand[i], 2) })),
          },
          {
            name: 'MPS Receipts',
            colorToken: 'var(--chart-2)',
            points: input.periodLabels.map((lbl, i) => ({ x: lbl, y: roundTo(chosen.mpsReceipts[i], 2) })),
          },
          {
            name: 'Saldo Akhir (PAB)',
            colorToken: 'var(--chart-3)',
            dashed: true,
            points: input.periodLabels.map((lbl, i) => ({ x: lbl, y: roundTo(chosen.pab[i], 2) })),
          },
        ],
        referenceLines:
          ss > 0
            ? [{ label: `Safety Stock (${ss})`, value: ss, colorToken: 'var(--warning)' }]
            : undefined,
      },
      {
        kind: 'bar',
        id: 'mps-rccp-chart',
        title: 'Profil Utilisasi Kapasitas Kasar (RCCP %)',
        subtitle: 'Merah menandakan periode Overload (> 100% kapasitas tersedia)',
        xLabel: 'Periode',
        yLabel: 'Utilisasi (%)',
        bars: input.periodLabels.map((lbl, i) => ({
          label: lbl,
          value: roundTo(Math.min(200, rccpUtilPct[i]), 1),
          annotation: `${formatNum(rccpLoad[i], 0)}j`,
          tone: rccpUtilPct[i] > 100 + 1e-6 ? 'error' : rccpUtilPct[i] > 85 ? 'warning' : 'success',
        })),
        referenceLines: [{ label: 'Batas Kapasitas 100%', value: 100, colorToken: 'var(--error)' }],
      },
    ],
    warnings,
    auditSteps,
    analysis: {
      headline: headlineStatus,
      interpretation: `Untuk memenuhi total Effective Demand ${formatNum(totalEffectiveDemand, 0)} unit dengan stok awal ${formatNum(begInv, 0)} unit dan Safety Stock ${formatNum(ss, 0)} unit, aturan "${chosen.label}" menjadwalkan ${chosen.orderCount} batch produksi berjumlah ${formatNum(chosen.totalMpsUnits, 0)} unit (biaya setup ${formatNum(chosen.setupCostTotal, 2)} + biaya simpan ${formatNum(chosen.holdingCostTotal, 2)} = ${formatNum(chosen.totalRelevantCost, 2)}).`,
      sections: analysisSections,
      recommendations,
    },
    explanation: {
      keyDecision: `Jadwalkan total produksi MPS sebesar ${formatNum(chosen.totalMpsUnits, 0)} unit dalam ${chosen.orderCount} batch [${chosen.mpsReceipts.map((v) => roundTo(v, 0)).join(', ')}]; tersedia ${formatNum(totalPositiveDiscreteAtp, 0)} unit ATP untuk pesanan baru.`,
      plainSummary: `Modul MPS memadukan ramalan permintaan (Forecast) dan pesanan nyata pelanggan (Customer Orders) sesuai aturan zona waktu (Frozen/Slushy/Liquid). Setiap kali stok produk jadi diperkirakan turun menembus Safety Stock (${formatNum(ss, 0)} unit), sistem otomatis menjadwalkan batch produksi baru sekaligus memeriksa apakah jam kerja mesin/stasiun kritis mencukupi (RCCP).`,
      metricBreakdown: [
        {
          label: 'Total MPS Receipts',
          value: `${formatNum(chosen.totalMpsUnits, 0)} unit (${chosen.orderCount} batch)`,
          meaning: 'Total produk jadi yang harus selesai diproduksi sepanjang horizon perencanaan.',
          impact: 'Deret angka per periode ini menjadi Gross Requirements Level-0 yang memicu kebutuhan komponen di MRP.',
        },
        {
          label: 'Discrete ATP Bebas',
          value: `${formatNum(totalPositiveDiscreteAtp, 0)} unit`,
          meaning: 'Sisa unit dari stok awal + jadwal MPS yang belum diklaim oleh Customer Orders saat ini.',
          impact:
            chosen.overPromisePeriods.length > 0
              ? `Terdapat ATP negatif (${chosen.overPromisePeriods.join(', ')}) yang berarti janji kirim melebihi pasokan!`
              : 'Menjadi kuota aman bagi tim Sales untuk menyanggupi pesanan pelanggan baru secara instan.',
        },
        {
          label: 'Puncak Utilisasi RCCP',
          value: `${formatNum(peakUtil, 1)}%`,
          meaning: `Persentase pemakaian jam stasiun kerja tertinggi dari jadwal MPS (${formatNum(stdHours, 2)} jam/unit).`,
          impact:
            overloadPeriods.length > 0
              ? `Melebihi 100% pada ${overloadPeriods.length} periode sehingga jadwal wajib disesuaikan atau ditambah lembur.`
              : 'Di bawah 100% di seluruh periode, membuktikan jadwal induk tidak melebihi kapasitas stasiun kritis.',
        },
        {
          label: 'Total Biaya Lot MPS',
          value: formatNum(chosen.totalRelevantCost, 2),
          meaning: `Gabungan biaya setup (${formatNum(chosen.setupCostTotal, 2)}) dan biaya simpan saldo PAB (${formatNum(chosen.holdingCostTotal, 2)}).`,
          impact:
            potentialLotSavings > 1e-6
              ? `Masih dapat dihemat ${formatNum(potentialLotSavings, 2)} bila diganti ke ${bestCostSim.label}.`
              : 'Sudah merupakan aturan lot-sizing paling hemat biaya di antara 4 alternatif.',
        },
      ],
      workedSteps: [
        {
          stepNumber: 1,
          title: `Menentukan Effective Demand pada ${sampleLbl} (${zoneLabels[sampleIdx]})`,
          formula:
            zoneLabels[sampleIdx] === 'Frozen' && input.frozenZonePolicy === 'orders_only'
              ? 'Dₜ = CustomerOrdersₜ (Zona Frozen ≤ DTF)'
              : zoneLabels[sampleIdx] === 'Liquid' && input.liquidZonePolicy === 'forecast_only'
                ? 'Dₜ = Forecastₜ (Zona Liquid > PTF)'
                : 'Dₜ = max(Forecastₜ, CustomerOrdersₜ)',
          substitution: `Forecast = ${formatNum(forecasts[sampleIdx], 0)}, Customer Orders = ${formatNum(customerOrders[sampleIdx], 0)}`,
          result: `D(${sampleLbl}) = ${formatNum(effectiveDemand[sampleIdx], 0)} unit`,
          explanation: 'Memastikan jadwal produksi tidak pernah lebih kecil dari komitmen nyata maupun ekspektasi pasar sesuai zona Time Fence.',
        },
        {
          stepNumber: 2,
          title: `Uji Saldo PAB & Penentuan Batch MPS pada ${sampleLbl}`,
          formula: 'Kekurangan = SafetyStock - (PABₜ₋₁ - Dₜ);  PABₜ = PABₜ₋₁ + MPSₜ - Dₜ',
          substitution: `PAB awal = ${formatNum(samplePrevPab, 0)}, Dₜ = ${formatNum(effectiveDemand[sampleIdx], 0)}, SS = ${formatNum(ss, 0)} → MPS = ${formatNum(chosen.mpsReceipts[sampleIdx], 0)} (${chosen.label})`,
          result: `MPS(${sampleLbl}) = ${formatNum(chosen.mpsReceipts[sampleIdx], 0)} unit · PAB akhir = ${formatNum(chosen.pab[sampleIdx], 0)} unit`,
          explanation: 'Produksi hanya dipicu ketika saldo tanpa produksi turun ke bawah batas pengaman Safety Stock.',
        },
        {
          stepNumber: 3,
          title: 'Menghitung Discrete ATP Periode Awal & Beban RCCP',
          formula: 'ATP₁ = I₀ + MPS₁ - ∑CO(sebelum MPS berikut);  Utilₜ = (MPSₜ × StdHours) / Capₜ × 100%',
          substitution: `I₀ = ${formatNum(begInv, 0)}, MPS₁ = ${formatNum(chosen.mpsReceipts[0], 0)} · Beban ${sampleLbl} = ${formatNum(chosen.mpsReceipts[sampleIdx], 0)} × ${formatNum(stdHours, 2)} = ${formatNum(rccpLoad[sampleIdx], 1)} jam vs Kapasitas ${formatNum(availableCap[sampleIdx], 1)} jam`,
          result: `ATP₁ = ${formatNum(chosen.discreteAtp[0] ?? 0, 0)} unit · Util(${sampleLbl}) = ${formatNum(rccpUtilPct[sampleIdx], 1)}%`,
          explanation: 'Memvalidasi sekaligus ketersediaan unit untuk tim penjualan dan kecukupan kapasitas mesin.',
        },
      ],
      whyOptimal: whyOptimalReasons,
      risksAndNotes: analysisSections.map((s) => ({
        heading: s.heading,
        detail: s.body,
        tone: s.tone,
      })),
      recommendations,
      glossary: GLOSSARY_BY_MODULE.mps,
    },
    derivedValues: {
      mpsSchedule: chosen.mpsReceipts.map((v) => roundTo(v, 2)).join(', '),
      totalMpsUnits: chosen.totalMpsUnits,
      totalEffectiveDemand,
      minPab: roundTo(chosen.minPab, 2),
      totalAtp: totalPositiveDiscreteAtp,
      peakCapacityUtilPct: roundTo(peakUtil, 2),
      overloadCount: overloadPeriods.length,
      totalMpsCost: chosen.totalRelevantCost,
    },
  };
}
