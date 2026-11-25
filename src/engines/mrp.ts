import { buildErrorExplanation } from '../core/explanation/explanationBuilder.ts';
import { GLOSSARY_BY_MODULE } from '../core/explanation/glossaryCatalog.ts';
import { formatNum, roundTo } from '../core/math/matrix.ts';
import type { BomTreeNodeItem } from '../core/types/chart.types.ts';
import type {
  ModuleExecutionResult,
  MrpInput,
  MrpItemInput,
  MrpLotSizingMethod,
  ResultTable,
} from '../core/types/module.types.ts';

interface ParentRef {
  parentName: string;
  qty: number;
}

interface SimulatedItemSchedule {
  poh: number[];
  netReq: number[];
  plannedRec: number[];
  plannedRel: number[];
  pastDue: number;
  orderCount: number;
  setupCostTotal: number;
  holdingCostTotal: number;
  totalRelevantCost: number;
  effectiveParamNote: string;
}

const ALL_LOT_METHODS: MrpLotSizingMethod[] = ['L4L', 'FOQ', 'POQ', 'EOQ', 'SM'];

export function parseParentRefs(parentStr: string | undefined, defaultQty: number): ParentRef[] {
  if (!parentStr) return [];
  const fallback = Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 1;
  return parentStr
    .split(/[,;|]+/)
    .map((raw) => raw.trim())
    .filter((s) => s !== '' && s !== '-' && s !== '—')
    .map((entry) => {
      const colonIdx = entry.indexOf(':');
      if (colonIdx > 0) {
        const pName = entry.slice(0, colonIdx).trim();
        const qVal = Number(entry.slice(colonIdx + 1).trim());
        return {
          parentName: pName,
          qty: Number.isFinite(qVal) && qVal > 0 ? qVal : fallback,
        };
      }
      const multMatch = /^(.+?)\s*[x×*]\s*([0-9.]+)$/i.exec(entry);
      if (multMatch) {
        const qVal = Number(multMatch[2]);
        return {
          parentName: multMatch[1].trim(),
          qty: Number.isFinite(qVal) && qVal > 0 ? qVal : fallback,
        };
      }
      return { parentName: entry, qty: fallback };
    })
    .filter((ref) => Boolean(ref.parentName));
}

function computeLowLevelOrder(items: MrpItemInput[]): {
  ordered: (MrpItemInput & { effectiveLevel: number; parentRefs: ParentRef[] })[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byName = new Map<string, MrpItemInput>();
  for (const it of items) {
    byName.set(it.item, it);
  }

  const effectiveLevel = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveLevel = (name: string): number => {
    if (effectiveLevel.has(name)) return effectiveLevel.get(name)!;
    const item = byName.get(name);
    if (!item) return 0;
    if (visiting.has(name)) {
      warnings.push(
        `Siklus BOM terdeteksi melibatkan "${name}"; menggunakan level input manual (${item.level}).`,
      );
      return item.level;
    }
    visiting.add(name);
    let maxParentLvl = -1;
    for (const ref of parseParentRefs(item.parent, item.qtyPerParent)) {
      if (byName.has(ref.parentName)) {
        maxParentLvl = Math.max(maxParentLvl, resolveLevel(ref.parentName));
      }
    }
    visiting.delete(name);
    const lvl = Math.max(item.level, maxParentLvl + 1);
    effectiveLevel.set(name, lvl);
    return lvl;
  };

  for (const it of items) resolveLevel(it.item);

  const enriched = items.map((it) => ({
    ...it,
    effectiveLevel: effectiveLevel.get(it.item) ?? it.level,
    parentRefs: parseParentRefs(it.parent, it.qtyPerParent),
  }));

  enriched.sort((a, b) => a.effectiveLevel - b.effectiveLevel || a.level - b.level);
  return { ordered: enriched, warnings };
}

function computeFutureIncrementalNeeds(
  startT: number,
  initialAvailableAfterOrderZero: number,
  gross: number[],
  sched: number[],
  safetyStock: number,
): number[] {
  const T = gross.length;
  const reqK: number[] = [];
  let proj = initialAvailableAfterOrderZero;

  for (let t = startT + 1; t < T; t += 1) {
    const avail = proj + sched[t];
    const need = gross[t] + safetyStock;
    if (avail < need) {
      const shortage = need - avail;
      reqK.push(shortage);
      proj = safetyStock;
    } else {
      reqK.push(0);
      proj = avail - gross[t];
    }
  }
  return reqK;
}

function simulateItemSchedule(
  item: MrpItemInput,
  method: MrpLotSizingMethod,
  gross: number[],
  sched: number[],
): SimulatedItemSchedule {
  const T = gross.length;
  const poh = Array<number>(T).fill(0);
  const netReq = Array<number>(T).fill(0);
  const plannedRec = Array<number>(T).fill(0);
  const plannedRel = Array<number>(T).fill(0);
  let pastDue = 0;
  let orderCount = 0;

  const setupCost = Math.max(0, item.setupCost ?? 100);
  const holdingCost = Math.max(0, item.holdingCostPerUnit ?? 2);
  const totalGross = gross.reduce((a, b) => a + b, 0);
  const avgDemand = Math.max(1e-6, totalGross / Math.max(1, T));
  const rawEoq =
    holdingCost > 1e-6 ? Math.sqrt((2 * avgDemand * setupCost) / holdingCost) : Math.max(1, avgDemand);
  const eoqQty = Math.max(1, Math.round(rawEoq));
  const poqPeriods = Math.max(
    1,
    Math.round(
      item.fixedOrderPeriods && item.fixedOrderPeriods >= 1
        ? item.fixedOrderPeriods
        : eoqQty / avgDemand,
    ),
  );
  const foqQty = Math.max(1, Math.round(item.fixedOrderQty ?? eoqQty));
  const ss = Math.max(0, item.safetyStock || 0);

  let effectiveParamNote: string = method;
  if (method === 'FOQ') effectiveParamNote = `FOQ=${foqQty}`;
  else if (method === 'EOQ') effectiveParamNote = `EOQ=${eoqQty}`;
  else if (method === 'POQ') effectiveParamNote = `POQ=${poqPeriods} per`;
  else if (method === 'SM') effectiveParamNote = 'Silver-Meal';

  let prevOh = Math.max(0, item.onHand || 0);
  for (let t = 0; t < T; t += 1) {
    const available = prevOh + sched[t];
    const need = gross[t] + ss;

    if (available >= need - 1e-9) {
      netReq[t] = 0;
      plannedRec[t] = 0;
      poh[t] = roundTo(available - gross[t], 4);
    } else {
      netReq[t] = roundTo(need - available, 4);
      let orderQty = netReq[t];

      if (method === 'FOQ') {
        orderQty = Math.ceil(netReq[t] / foqQty) * foqQty;
      } else if (method === 'EOQ') {
        orderQty = Math.ceil(netReq[t] / eoqQty) * eoqQty;
      } else if (method === 'POQ') {
        const futureNeeds = computeFutureIncrementalNeeds(t, ss, gross, sched, ss);
        const span = Math.min(poqPeriods - 1, futureNeeds.length);
        for (let k = 0; k < span; k += 1) {
          orderQty += futureNeeds[k];
        }
      } else if (method === 'SM') {
        const futureNeeds = computeFutureIncrementalNeeds(t, ss, gross, sched, ss);
        let bestAvgCost = setupCost;
        let holdAcc = 0;
        let candQty = orderQty;
        for (let k = 0; k < futureNeeds.length; k += 1) {
          const stepsAhead = k + 1;
          holdAcc += stepsAhead * holdingCost * futureNeeds[k];
          const avgCost = (setupCost + holdAcc) / (stepsAhead + 1);
          if (avgCost <= bestAvgCost + 1e-9) {
            bestAvgCost = avgCost;
            candQty += futureNeeds[k];
            orderQty = candQty;
          } else {
            break;
          }
        }
      }

      plannedRec[t] = roundTo(orderQty, 4);
      poh[t] = roundTo(available + plannedRec[t] - gross[t], 4);
    }

    if (plannedRec[t] > 1e-9) {
      orderCount += 1;
      const relPeriod = t - Math.max(0, Math.round(item.leadTime || 0));
      if (relPeriod >= 0) {
        plannedRel[relPeriod] = roundTo(plannedRel[relPeriod] + plannedRec[t], 4);
      } else {
        pastDue = roundTo(pastDue + plannedRec[t], 4);
      }
    }

    prevOh = poh[t];
  }

  const setupCostTotal = roundTo(orderCount * setupCost, 2);
  const holdingCostTotal = roundTo(
    poh.reduce((sum, q) => sum + Math.max(0, q) * holdingCost, 0),
    2,
  );

  return {
    poh,
    netReq,
    plannedRec,
    plannedRel,
    pastDue,
    orderCount,
    setupCostTotal,
    holdingCostTotal,
    totalRelevantCost: roundTo(setupCostTotal + holdingCostTotal, 2),
    effectiveParamNote,
  };
}

export function solveMrp(
  jobId: string,
  jobTitle: string,
  input: MrpInput,
): ModuleExecutionResult {
  const start = performance.now();
  const T = input.periodLabels.length;
  if (T === 0 || input.items.length === 0) {
    const errPack = buildErrorExplanation(
      'mrp',
      'Daftar komponen BOM atau horizon periode MRP masih kosong.',
      'Masukkan minimal 1 item BOM (Level 0) dan minimal 1 periode perencanaan.',
    );
    return {
      jobId,
      moduleId: 'mrp',
      jobTitle,
      status: 'error',
      executionMs: 0,
      summaryText: 'Data MRP atau horizon periode kosong.',
      kpis: [],
      tables: [],
      charts: [],
      warnings: ['Masukkan minimal 1 item BOM dan 1 periode perencanaan.'],
      derivedValues: {},
      auditSteps: [],
      analysis: errPack.analysis,
      explanation: errPack.explanation,
      error: 'Data MRP kosong.',
    };
  }

  const { ordered: sortedItems, warnings: bomWarnings } = computeLowLevelOrder(input.items);
  const releasesByItem = new Map<string, number[]>();
  const pastDueByItem = new Map<string, number>();
  const tables: ResultTable[] = [];
  const warnings: string[] = [...bomWarnings];

  let totalPlannedReleases = 0;
  let totalOrders = 0;
  let totalSelectedCost = 0;
  let totalSetupCost = 0;
  let totalHoldingCost = 0;
  let optimalCostSum = 0;
  let totalPastDueUnits = 0;

  const pastDueItems: string[] = [];
  const suboptimalNotes: string[] = [];
  const explosionCausalNotes: string[] = [];
  const itemTotals: { item: string; totalRelease: number }[] = [];
  const comparisonRows: (string | number)[][] = [];
  const level0Releases = Array<number>(T).fill(0);
  const bomTreeNodes: BomTreeNodeItem[] = [];
  const workOrderTokens: string[] = [];
  const maxBomLevel = sortedItems.reduce((mx, it) => Math.max(mx, it.effectiveLevel), 0);

  let firstSampleStepInfo: {
    itemName: string;
    periodLabel: string;
    grossVal: number;
    ssVal: number;
    prevOh: number;
    schedVal: number;
    netVal: number;
    recVal: number;
    lt: number;
    relTarget: string;
  } | null = null;

  for (const item of sortedItems) {
    const gross = Array.from({ length: T }, (_, t) => Math.max(0, item.grossRequirements[t] ?? 0));

    for (const ref of item.parentRefs) {
      if (releasesByItem.has(ref.parentName)) {
        const parentRel = releasesByItem.get(ref.parentName)!;
        for (let t = 0; t < T; t += 1) {
          gross[t] = roundTo(gross[t] + parentRel[t] * ref.qty, 4);
        }
        const parentPastDue = pastDueByItem.get(ref.parentName) ?? 0;
        if (parentPastDue > 0) {
          const urgentChildQty = roundTo(parentPastDue * ref.qty, 2);
          warnings.push(
            `Item "${item.item}": induk "${ref.parentName}" memiliki Past Due ${formatNum(parentPastDue, 0)} unit, memicu kebutuhan mendesak ${formatNum(urgentChildQty, 0)} unit.`,
          );
        }
      } else {
        warnings.push(
          `Induk "${ref.parentName}" untuk item "${item.item}" tidak ditemukan pada daftar BOM.`,
        );
      }
    }

    if (item.parentRefs.length > 0) {
      const parentDesc = item.parentRefs
        .map((r) => `${r.parentName} (×${r.qty})`)
        .join(' + ');
      explosionCausalNotes.push(
        `"${item.item}" (LLC Level ${item.effectiveLevel}) menerima total GrossReq ${formatNum(gross.reduce((a, b) => a + b, 0), 0)} unit dari ledakan induk: ${parentDesc}`,
      );
    }

    const sched = Array.from({ length: T }, (_, t) => Math.max(0, item.scheduledReceipts[t] ?? 0));
    const chosen = simulateItemSchedule(item, item.lotSizing, gross, sched);

    if (!firstSampleStepInfo) {
      const netIdx = chosen.netReq.findIndex((nr) => nr > 1e-9);
      const tIdx = netIdx >= 0 ? netIdx : 0;
      const lt = Math.max(0, Math.round(item.leadTime || 0));
      const relIdx = tIdx - lt;
      firstSampleStepInfo = {
        itemName: item.item,
        periodLabel: input.periodLabels[tIdx] ?? `P${tIdx + 1}`,
        grossVal: gross[tIdx],
        ssVal: Math.max(0, item.safetyStock || 0),
        prevOh: tIdx === 0 ? Math.max(0, item.onHand || 0) : chosen.poh[tIdx - 1],
        schedVal: sched[tIdx],
        netVal: chosen.netReq[tIdx],
        recVal: chosen.plannedRec[tIdx],
        lt,
        relTarget:
          relIdx >= 0 ? (input.periodLabels[relIdx] ?? `P${relIdx + 1}`) : 'Past-Due (Sebelum P1)',
      };
    }

    if (chosen.pastDue > 0) {
      totalPastDueUnits += chosen.pastDue;
      pastDueItems.push(`${item.item} (${formatNum(chosen.pastDue, 0)} unit)`);
      for (let t = 0; t < Math.min(T, Math.max(0, Math.round(item.leadTime || 0))); t += 1) {
        if (chosen.plannedRec[t] > 0) {
          warnings.push(
            `Item "${item.item}": order ${formatNum(chosen.plannedRec[t], 0)} unit pada ${input.periodLabels[t]} melewati Lead Time (${item.leadTime} periode → Past Due).`,
          );
        }
      }
    }

    releasesByItem.set(item.item, chosen.plannedRel);
    pastDueByItem.set(item.item, chosen.pastDue);

    if (item.effectiveLevel === 0) {
      for (let t = 0; t < T; t += 1) level0Releases[t] += chosen.plannedRel[t];
    }

    // Collect manufacturing work orders (Level 0 & Level 1 releases) for downstream Scheduling pipeline
    if (item.effectiveLevel <= 1) {
      const lt = Math.max(1, Math.round(item.leadTime || 1));
      chosen.plannedRel.forEach((relQty, tIdx) => {
        if (relQty > 1e-9 && workOrderTokens.length < 12) {
          const cleanCode = item.item.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'ITEM';
          const dueDay = (tIdx + lt) * 5;
          const weight = item.effectiveLevel === 0 ? 2 : 1;
          workOrderTokens.push(`${cleanCode}-P${tIdx + 1}:${roundTo(relQty, 2)}:${dueDay}:${weight}`);
        }
      });
    }

    const itemSumRel = chosen.plannedRel.reduce((a, b) => a + b, 0) + chosen.pastDue;
    totalPlannedReleases += itemSumRel;
    totalOrders += chosen.orderCount;
    totalSelectedCost += chosen.totalRelevantCost;
    totalSetupCost += chosen.setupCostTotal;
    totalHoldingCost += chosen.holdingCostTotal;
    itemTotals.push({ item: item.item, totalRelease: itemSumRel });

    bomTreeNodes.push({
      id: item.item,
      name: item.item,
      level: item.effectiveLevel,
      parents: item.parentRefs.map((r) => ({ parentName: r.parentName, qtyPerParent: r.qty })),
      leadTime: Math.max(0, Math.round(item.leadTime || 0)),
      lotMethod: chosen.effectiveParamNote,
      totalRelease: roundTo(itemSumRel, 2),
      pastDue: roundTo(chosen.pastDue, 2),
    });

    const allSims = ALL_LOT_METHODS.map((m) => ({
      method: m,
      sim: simulateItemSchedule(item, m, gross, sched),
    }));
    const bestSim = [...allSims].sort(
      (a, b) => a.sim.totalRelevantCost - b.sim.totalRelevantCost,
    )[0];
    optimalCostSum += bestSim.sim.totalRelevantCost;

    if (
      item.lotSizing !== bestSim.method &&
      chosen.totalRelevantCost > bestSim.sim.totalRelevantCost + 1e-6
    ) {
      const save = chosen.totalRelevantCost - bestSim.sim.totalRelevantCost;
      suboptimalNotes.push(
        `${item.item}: ubah ${chosen.effectiveParamNote} → ${bestSim.sim.effectiveParamNote} (hemat ${formatNum(save, 2)})`,
      );
    }

    for (const entry of allSims) {
      comparisonRows.push([
        item.item,
        `${entry.sim.effectiveParamNote}${entry.method === item.lotSizing ? ' (Dipilih)' : ''}${entry.method === bestSim.method ? ' ★' : ''}`,
        entry.sim.orderCount,
        roundTo(entry.sim.setupCostTotal, 2),
        roundTo(entry.sim.holdingCostTotal, 2),
        roundTo(entry.sim.totalRelevantCost, 2),
      ]);
    }

    tables.push({
      id: `mrp-${item.item}`,
      title: `Jadwal MRP: ${item.item} (LLC Level ${item.effectiveLevel}, LT=${item.leadTime}, On-Hand=${item.onHand}, ${chosen.effectiveParamNote})`,
      headers: ['Baris MRP', ...(chosen.pastDue > 0 ? ['Past Due'] : []), ...input.periodLabels],
      rows: [
        ['Gross Requirements', ...(chosen.pastDue > 0 ? ['-'] : []), ...gross.map((v) => roundTo(v, 2))],
        ['Scheduled Receipts', ...(chosen.pastDue > 0 ? ['-'] : []), ...sched.map((v) => roundTo(v, 2))],
        ['Projected On-Hand', ...(chosen.pastDue > 0 ? [item.onHand] : []), ...chosen.poh.map((v) => roundTo(v, 2))],
        ['Net Requirements', ...(chosen.pastDue > 0 ? ['-'] : []), ...chosen.netReq.map((v) => roundTo(v, 2))],
        ['Planned Order Receipts', ...(chosen.pastDue > 0 ? ['-'] : []), ...chosen.plannedRec.map((v) => roundTo(v, 2))],
        [
          'Planned Order Releases',
          ...(chosen.pastDue > 0 ? [roundTo(chosen.pastDue, 2)] : []),
          ...chosen.plannedRel.map((v) => roundTo(v, 2)),
        ],
      ],
      highlightRowIndices: [5],
    });
  }

  tables.push({
    id: 'mrp-lotsize-comparison',
    title: 'Perbandingan Biaya 5 Metode Lot-Sizing MRP (★ = Biaya Termurah)',
    headers: ['Item BOM', 'Metode Lot-Sizing', 'Jumlah Order', 'Biaya Setup', 'Biaya Simpan', 'Total Biaya Relevan'],
    rows: comparisonRows,
  });

  const potentialSavings = Math.max(0, roundTo(totalSelectedCost - optimalCostSum, 2));
  const savingsPct = totalSelectedCost > 1e-9 ? (potentialSavings / totalSelectedCost) * 100 : 0;
  const setupShare = totalSelectedCost > 1e-9 ? (totalSetupCost / totalSelectedCost) * 100 : 0;
  const holdingShare = totalSelectedCost > 1e-9 ? (totalHoldingCost / totalSelectedCost) * 100 : 0;

  const whyOptimalReasons: string[] = [
    explosionCausalNotes.length > 0
      ? `Urutan perhitungan dikunci menggunakan Low-Level Coding (${maxBomLevel + 1} level BOM) sehingga komponen anak hanya dihitung setelah seluruh Planned Order Release induknya tuntas: ${explosionCausalNotes.slice(0, 3).join('; ')}.`
      : `Item Level-0 dihitung langsung dari Gross Requirements tanpa komponen anak tambahan.`,
    suboptimalNotes.length > 0
      ? `Simulasi 5 metode Lot-Sizing (L4L, FOQ, POQ, EOQ, Silver-Meal) membuktikan total biaya saat ini (${formatNum(totalSelectedCost, 2)}) belum minimum karena ketidakseimbangan biaya Setup (${formatNum(setupShare, 1)}%) vs Simpan (${formatNum(holdingShare, 1)}%): ${suboptimalNotes.join('; ')}.`
      : `Aturan lot-sizing yang dipilih pada seluruh ${sortedItems.length} item sudah mencapai biaya relevan terendah (${formatNum(totalSelectedCost, 2)}) di antara ke-5 metode.`,
    totalPastDueUnits > 0
      ? `Muncul ${formatNum(totalPastDueUnits, 0)} unit Past-Due pada [${pastDueItems.join(', ')}] karena kebutuhan bersih jatuh pada periode awal yang jaraknya lebih pendek daripada Lead Time komponen tersebut (t - LT < 1).`
      : `Tidak ada order Past-Due (0 unit) karena seluruh kebutuhan bersih memiliki jarak periode ≥ Lead Time masing-masing komponen.`,
  ];

  const analysisSections = [
    {
      heading: 'Audit Efisiensi 5 Metode Lot-Sizing',
      body:
        suboptimalNotes.length > 0
          ? `Terdapat peluang penghematan ${formatNum(potentialSavings, 2)} (${formatNum(savingsPct, 1)}%) dari ${formatNum(totalSelectedCost, 2)} menjadi ${formatNum(optimalCostSum, 2)} dengan penyesuaian: ${suboptimalNotes.join('; ')}.`
          : `Seluruh ${sortedItems.length} komponen telah menggunakan metode lot-sizing paling ekonomis (★) di antara L4L, FOQ, POQ, EOQ, dan Silver-Meal.`,
      tone: suboptimalNotes.length > 0 ? ('caution' as const) : ('positive' as const),
    },
    {
      heading: 'Kelaikan Lead Time & Rambatan Past-Due',
      body:
        totalPastDueUnits > 0
          ? `PERINGATAN PAST-DUE: Total ${formatNum(totalPastDueUnits, 0)} unit pada ${pastDueItems.join(', ')} terlambat dilepas. Tanpa expediting pemasok atau revisi MPS, perakitan induk berisiko tertunda.`
          : 'Seluruh Planned Order Releases jatuh di dalam jendela periode perencanaan (0 Past-Due); jadwal pengadaan material sepenuhnya layak secara Lead Time.',
      tone: totalPastDueUnits > 0 ? ('critical' as const) : ('positive' as const),
    },
  ];

  const recommendations: string[] = [
    ...(suboptimalNotes.length > 0
      ? [
          `Ubah aturan lot-sizing pada item berikut (${suboptimalNotes.slice(0, 3).join('; ')}) untuk langsung memangkas biaya sebesar ${formatNum(potentialSavings, 2)}.`,
        ]
      : [
          'Pertahankan konfigurasi lot-sizing saat ini karena sudah berada di titik biaya Setup + Simpan terendah.',
        ]),
    totalPastDueUnits > 0
      ? `Lakukan expediting pengiriman komponen (${pastDueItems.join(', ')}) atau geser sebagian batch MPS periode awal ke periode berikutnya.`
      : 'Kunci rilis order periode awal sebagai Firm Planned Orders dan teruskan daftar Work Order manufaktur ke modul Scheduling (Tahap 04).',
  ];

  const auditSteps = [
    {
      title: '1. Low-Level Coding & BOM Explosion',
      formula: 'Gross(Anak, t) = ∑ [ PORel(Indukᵢ, t) × QtyPerParentᵢ ]',
      detail: `Mengurutkan ${sortedItems.length} item pada ${maxBomLevel + 1} level BOM secara topologis agar common parts menghimpun seluruh kebutuhan induk terlebih dahulu.`,
    },
    {
      title: '2. Netting, Lot-Sizing & Offsetting Lead Time',
      formula: 'NetReqₜ = max(0, Grossₜ + SS - POHₜ₋₁ - SchedRecₜ)  ·  PORelₜ₋ₗₜ = PORcₜ',
      detail: firstSampleStepInfo
        ? `Contoh ${firstSampleStepInfo.itemName} (${firstSampleStepInfo.periodLabel}): NetReq = max(0, ${formatNum(firstSampleStepInfo.grossVal, 0)} + ${formatNum(firstSampleStepInfo.ssVal, 0)} - ${formatNum(firstSampleStepInfo.prevOh, 0)} - ${formatNum(firstSampleStepInfo.schedVal, 0)}) = ${formatNum(firstSampleStepInfo.netVal, 0)} → PORc ${formatNum(firstSampleStepInfo.recVal, 0)} ditarik LT=${firstSampleStepInfo.lt} ke ${firstSampleStepInfo.relTarget}.`
        : 'Menghitung kebutuhan bersih dan menggeser pelepasan order sejauh Lead Time.',
    },
    {
      title: '3. Evaluasi Total Biaya Setup + Simpan',
      formula: `Total Biaya = ∑(Orders × S) + ∑(POH × H) = ${formatNum(totalSetupCost, 2)} + ${formatNum(totalHoldingCost, 2)} = ${formatNum(totalSelectedCost, 2)}`,
      detail: `Kombinasi aturan terbaik (★) menghasilkan biaya minimum ${formatNum(optimalCostSum, 2)} (potensi hemat ${formatNum(potentialSavings, 2)}).`,
    },
  ];

  const sampleStep = firstSampleStepInfo!;
  const elapsed = roundTo(performance.now() - start, 2);

  return {
    jobId,
    moduleId: 'mrp',
    jobTitle,
    status: warnings.length > 0 ? 'warning' : 'success',
    executionMs: elapsed,
    summaryText: `Ledakan BOM MRP (${sortedItems.length} item, ${maxBomLevel + 1} level) memicu ${totalOrders} order (${formatNum(totalPlannedReleases, 0)} unit), total biaya ${formatNum(totalSelectedCost, 2)}.`,
    kpis: [
      { label: 'Total Komponen BOM', value: `${sortedItems.length} item (${maxBomLevel + 1} lvl)`, emphasis: 'primary' },
      { label: 'Total Planned Releases', value: formatNum(totalPlannedReleases, 0), unit: 'unit', emphasis: 'success' },
      {
        label: 'Potensi Hemat Lot-Sizing',
        value: `${formatNum(potentialSavings, 2)} (${formatNum(savingsPct, 1)}%)`,
        emphasis: potentialSavings > 1e-6 ? 'warning' : 'success',
      },
      {
        label: 'Order Past-Due',
        value: `${formatNum(totalPastDueUnits, 0)} unit`,
        emphasis: totalPastDueUnits > 0 ? 'error' : 'success',
      },
    ],
    tables,
    charts: [
      {
        kind: 'bom-tree',
        id: 'mrp-bom-tree',
        title: 'Struktur Pohon BOM Multi-Level & Aliran Komponen',
        subtitle: 'Menampilkan Low-Level Code, kuantitas per induk, Lead Time, aturan Lot, dan status Past-Due',
        nodes: bomTreeNodes,
      },
      {
        kind: 'bar',
        id: 'mrp-releases-bar',
        title: 'Total Planned Order Release per Komponen BOM',
        xLabel: 'Komponen',
        yLabel: 'Total Unit Release',
        bars: itemTotals.map((it) => ({
          label: it.item,
          value: roundTo(it.totalRelease, 2),
          tone: (pastDueByItem.get(it.item) ?? 0) > 0 ? 'error' : 'primary',
        })),
      },
    ],
    warnings,
    auditSteps,
    analysis: {
      headline:
        potentialSavings > 1e-6
          ? `BOM ${maxBomLevel + 1}-Level Selesai — Peluang Penghematan ${formatNum(potentialSavings, 2)} (${formatNum(savingsPct, 1)}%) Lewat Optimasi Lot-Sizing`
          : `Jadwal MRP Optimal pada Biaya Minimum ${formatNum(totalSelectedCost, 2)} untuk ${sortedItems.length} Komponen`,
      interpretation: `Eksplosi Bill of Materials atas ${sortedItems.length} item sepanjang ${T} periode menghasilkan ${totalOrders} kali pelepasan order (total ${formatNum(totalPlannedReleases, 0)} unit), terdiri dari biaya pesan/setup ${formatNum(totalSetupCost, 2)} (${formatNum(setupShare, 1)}%) dan biaya simpan ${formatNum(totalHoldingCost, 2)} (${formatNum(holdingShare, 1)}%).`,
      sections: analysisSections,
      recommendations,
    },
    explanation: {
      keyDecision: `Lepaskan ${totalOrders} order pengadaan/produksi berjumlah ${formatNum(totalPlannedReleases, 0)} unit sesuai baris Planned Order Releases${potentialSavings > 1e-6 ? `, dan optimalkan aturan lot untuk menghemat ${formatNum(potentialSavings, 2)}` : ''}.`,
      plainSummary: `Modul MRP memecah jadwal produk jadi dari MPS menjadi jadwal pemesanan tiap komponen anak berdasarkan pohon BOM dan Lead Time masing-masing. Selain menghitung kapan order harus dilepas (PORel), sistem membandingkan 5 metode ukuran lot sekaligus agar biaya pesan dan biaya simpan gudang paling efisien.`,
      metricBreakdown: [
        {
          label: 'Total Planned Order Releases',
          value: `${formatNum(totalPlannedReleases, 0)} unit (${totalOrders} order)`,
          meaning: 'Akumulasi seluruh kuantitas order yang wajib dilepas ke lantai pabrik atau pemasok.',
          impact: 'Menjadi acuan langsung penerbitan Purchase Order (PO) dan Work Order (WO) produksi.',
        },
        {
          label: 'Total Biaya Lot-Sizing Aktif',
          value: formatNum(totalSelectedCost, 2),
          meaning: `Biaya setup/pesan (${formatNum(totalSetupCost, 2)}) ditambah biaya simpan persediaan (${formatNum(totalHoldingCost, 2)}).`,
          impact: `Biaya minimum teoritis lintas 5 metode adalah ${formatNum(optimalCostSum, 2)} (selisih hemat ${formatNum(potentialSavings, 2)}).`,
        },
        {
          label: 'Unit Order Past-Due',
          value: `${formatNum(totalPastDueUnits, 0)} unit`,
          meaning: 'Jumlah unit yang seharusnya sudah dipesan sebelum Periode 1 agar tiba tepat waktu.',
          impact:
            totalPastDueUnits > 0
              ? `Kritis: membutuhkan percepatan (expediting) pada ${pastDueItems.join(', ')}.`
              : 'Aman (0 unit): seluruh waktu tunggu komponen masih tercakup di dalam horizon.',
        },
      ],
      workedSteps: [
        {
          stepNumber: 1,
          title: 'Pengurutan Topologis Low-Level Coding & Eksplosi BOM',
          formula: 'Gross(Anak, t) = ∑ [ PORel(Indukᵢ, t) × QtyPerParentᵢ ]',
          substitution:
            explosionCausalNotes[0] ??
            `Level 0 (${sortedItems[0].item}) mengambil Gross Requirements langsung dari jadwal induk`,
          result: `${sortedItems.length} item terurut dalam ${maxBomLevel + 1} level BOM`,
          explanation: 'Mencegah komponen bersama (common part) dihitung berulang sebelum seluruh kebutuhan induknya terkumpul.',
        },
        {
          stepNumber: 2,
          title: `Perhitungan Netting & Offsetting pada "${sampleStep.itemName}" (${sampleStep.periodLabel})`,
          formula: 'NetReqₜ = max(0, Grossₜ + SS - POHₜ₋₁ - SchedRecₜ);  PORelₜ₋ₗₜ = PORcₜ',
          substitution: `max(0, ${formatNum(sampleStep.grossVal, 0)} + ${formatNum(sampleStep.ssVal, 0)} - ${formatNum(sampleStep.prevOh, 0)} - ${formatNum(sampleStep.schedVal, 0)}) = ${formatNum(sampleStep.netVal, 0)} → Lot PORc = ${formatNum(sampleStep.recVal, 0)}, LT = ${sampleStep.lt}`,
          result: `PORel dilepas pada: ${sampleStep.relTarget}`,
          explanation: 'Menentukan kekurangan bersih lalu menarik mundur jadwal pelepasan order sejauh waktu tunggu komponen.',
        },
        {
          stepNumber: 3,
          title: 'Komparasi 5 Metode Lot-Sizing (L4L, FOQ, POQ, EOQ, Silver-Meal)',
          formula: 'Total Biaya = (Frekuensi Order × SetupCost) + (∑POHₜ × HoldingCost)',
          substitution: `${formatNum(totalSetupCost, 2)} (Setup) + ${formatNum(totalHoldingCost, 2)} (Simpan) vs Optimal ★ ${formatNum(optimalCostSum, 2)}`,
          result:
            potentialSavings > 1e-6
              ? `Potensi Penghematan = ${formatNum(potentialSavings, 2)} (${formatNum(savingsPct, 1)}%)`
              : `Sudah Optimal Minimum = ${formatNum(totalSelectedCost, 2)}`,
          explanation: 'Membandingkan metode pesanan tepat (L4L) terhadap metode penggabungan batch untuk menekan biaya total.',
        },
      ],
      whyOptimal: whyOptimalReasons,
      risksAndNotes: analysisSections.map((s) => ({
        heading: s.heading,
        detail: s.body,
        tone: s.tone,
      })),
      recommendations,
      glossary: GLOSSARY_BY_MODULE.mrp,
    },
    derivedValues: {
      totalPlannedReleases: roundTo(totalPlannedReleases, 2),
      totalOrders,
      totalMrpCost: roundTo(totalSelectedCost, 2),
      optimalLotSizingCost: roundTo(optimalCostSum, 2),
      potentialSavings,
      totalPastDueUnits: roundTo(totalPastDueUnits, 2),
      level0PlannedReleases: level0Releases.map((v) => roundTo(v, 2)).join(', '),
      workOrderList: workOrderTokens.join('; '),
    },
  };
}
