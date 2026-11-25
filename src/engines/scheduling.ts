import { buildErrorExplanation } from '../core/explanation/explanationBuilder.ts';
import { GLOSSARY_BY_MODULE } from '../core/explanation/glossaryCatalog.ts';
import { formatNum, roundTo } from '../core/math/matrix.ts';
import type {
  ModuleExecutionResult,
  ResultTable,
  SchedulingInput,
  SchedulingJobInput,
} from '../core/types/module.types.ts';

interface SingleMachineSlot {
  jobId: string;
  start: number;
  finish: number;
  dueDate: number;
  lateness: number;
  weight: number;
}

interface RuleEval {
  ruleName: string;
  shortCode: string;
  sequence: string[];
  sumFlow: number;
  avgCompletion: number;
  weightedFlowTime: number;
  utilizationPct: number;
  avgJobsInSystem: number;
  avgLateness: number;
  maxLateness: number;
  tardyCount: number;
  makespan: number;
  slots: SingleMachineSlot[];
  detailRows: (string | number)[][];
}

function evaluateSingleMachineRule(
  ruleName: string,
  shortCode: string,
  orderedJobs: SchedulingJobInput[],
): RuleEval {
  let time = 0;
  let sumFlow = 0;
  let sumWeightedFlow = 0;
  let sumProc = 0;
  let sumLateness = 0;
  let maxLateness = 0;
  let tardyCount = 0;
  const slots: SingleMachineSlot[] = [];
  const detailRows: (string | number)[][] = [];

  for (const job of orderedJobs) {
    const proc = Math.max(0, job.processingTime);
    const weight =
      job.weight !== undefined && Number.isFinite(job.weight) && job.weight > 0 ? job.weight : 1;
    const start = time;
    const finish = start + proc;
    const lateness = Math.max(0, finish - job.dueDate);
    if (lateness > 1e-9) tardyCount += 1;
    if (lateness > maxLateness) maxLateness = lateness;

    time = finish;
    sumFlow += finish;
    sumWeightedFlow += weight * finish;
    sumProc += proc;
    sumLateness += lateness;

    slots.push({ jobId: job.jobId, start, finish, dueDate: job.dueDate, lateness, weight });
    detailRows.push([
      job.jobId,
      roundTo(proc, 2),
      roundTo(weight, 2),
      roundTo(job.dueDate, 2),
      roundTo(start, 2),
      roundTo(finish, 2),
      roundTo(lateness, 2),
    ]);
  }

  const n = Math.max(1, orderedJobs.length);
  return {
    ruleName,
    shortCode,
    sequence: orderedJobs.map((j) => j.jobId),
    sumFlow,
    avgCompletion: sumFlow / n,
    weightedFlowTime: sumWeightedFlow,
    utilizationPct: sumFlow > 0 ? (sumProc / sumFlow) * 100 : 100,
    avgJobsInSystem: sumProc > 0 ? sumFlow / sumProc : 1,
    avgLateness: sumLateness / n,
    maxLateness,
    tardyCount,
    makespan: time,
    slots,
    detailRows,
  };
}

interface JohnsonScheduleSlot {
  jobId: string;
  t1: number;
  t2: number;
  m1Start: number;
  m1End: number;
  m2Start: number;
  m2End: number;
  idleM2: number;
}

function solveJohnson(jobs: SchedulingJobInput[]): {
  sequence: SchedulingJobInput[];
  partitionLog: string[];
  makespan: number;
  totalM1: number;
  totalM2: number;
  slots: JohnsonScheduleSlot[];
  rows: (string | number)[][];
} {
  const remaining = [...jobs];
  const left: SchedulingJobInput[] = [];
  const right: SchedulingJobInput[] = [];
  const partitionLog: string[] = [];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestTime = Infinity;
    let onMachine1 = true;

    remaining.forEach((j, idx) => {
      const t1 = Math.max(0, j.processingTime);
      const t2 = Math.max(0, j.processingTimeMachine2 ?? 0);
      if (t1 < bestTime) {
        bestTime = t1;
        bestIdx = idx;
        onMachine1 = true;
      }
      if (t2 < bestTime) {
        bestTime = t2;
        bestIdx = idx;
        onMachine1 = false;
      }
    });

    const [picked] = remaining.splice(bestIdx, 1);
    if (onMachine1) {
      left.push(picked);
      partitionLog.push(`${picked.jobId} (min M1=${picked.processingTime} → Depan)`);
    } else {
      right.unshift(picked);
      partitionLog.push(`${picked.jobId} (min M2=${picked.processingTimeMachine2 ?? 0} → Belakang)`);
    }
  }

  const sequence = [...left, ...right];
  let m1Time = 0;
  let m2Time = 0;
  let totalM1 = 0;
  let totalM2 = 0;
  const slots: JohnsonScheduleSlot[] = [];
  const rows: (string | number)[][] = [];

  for (const job of sequence) {
    const t1 = Math.max(0, job.processingTime);
    const t2 = Math.max(0, job.processingTimeMachine2 ?? 0);
    const m1Start = m1Time;
    const m1End = m1Start + t1;
    const m2Start = Math.max(m1End, m2Time);
    const m2End = m2Start + t2;
    const idleM2 = Math.max(0, m1End - m2Time);

    m1Time = m1End;
    m2Time = m2End;
    totalM1 += t1;
    totalM2 += t2;

    slots.push({ jobId: job.jobId, t1, t2, m1Start, m1End, m2Start, m2End, idleM2 });
    rows.push([
      job.jobId,
      roundTo(t1, 2),
      roundTo(t2, 2),
      `${roundTo(m1Start, 1)} – ${roundTo(m1End, 1)}`,
      `${roundTo(m2Start, 1)} – ${roundTo(m2End, 1)}`,
      roundTo(idleM2, 2),
    ]);
  }

  return { sequence, partitionLog, makespan: m2Time, totalM1, totalM2, slots, rows };
}

export function solveScheduling(
  jobId: string,
  jobTitle: string,
  input: SchedulingInput,
): ModuleExecutionResult {
  const start = performance.now();
  if (input.jobs.length === 0) {
    const errPack = buildErrorExplanation(
      'scheduling',
      'Daftar pekerjaan (Work Orders) masih kosong sehingga pengurutan mesin belum dapat dihitung.',
      'Tambahkan minimal 1 pekerjaan beserta waktu proses dan tenggat (due date).',
    );
    return {
      jobId,
      moduleId: 'scheduling',
      jobTitle,
      status: 'error',
      executionMs: 0,
      summaryText: 'Daftar job penjadwalan kosong.',
      kpis: [],
      tables: [],
      charts: [],
      warnings: ['Tambahkan minimal 1 pekerjaan (job).'],
      derivedValues: {},
      auditSteps: [],
      analysis: errPack.analysis,
      explanation: errPack.explanation,
      error: 'Daftar job kosong.',
    };
  }

  const isJohnson =
    input.mode === 'johnson_two_machine' ||
    (input.mode as string) === 'johnson-two-machine';

  if (isJohnson) {
    const jRes = solveJohnson(input.jobs);
    const seqStr = jRes.sequence.map((j) => j.jobId).join(' → ');
    const totalIdleM2 = roundTo(jRes.slots.reduce((s, slot) => s + slot.idleM2, 0), 2);
    const totalIdleM1 = roundTo(Math.max(0, jRes.makespan - jRes.totalM1), 2);
    const utilM1 = jRes.makespan > 1e-9 ? (jRes.totalM1 / jRes.makespan) * 100 : 100;
    const utilM2 = jRes.makespan > 1e-9 ? (jRes.totalM2 / jRes.makespan) * 100 : 100;
    const bottleneckMachine = jRes.totalM1 >= jRes.totalM2 ? 'Mesin 1 (M1)' : 'Mesin 2 (M2)';

    // Compare against naive input order makespan
    let naiveM1 = 0;
    let naiveM2 = 0;
    for (const j of input.jobs) {
      naiveM1 += Math.max(0, j.processingTime);
      naiveM2 = Math.max(naiveM1, naiveM2) + Math.max(0, j.processingTimeMachine2 ?? 0);
    }
    const savedTimeVsFcfs = Math.max(0, roundTo(naiveM2 - jRes.makespan, 2));

    const ganttTasks = jRes.slots.flatMap((slot) => [
      {
        id: `${slot.jobId}-M1`,
        label: `${slot.jobId} (M1)`,
        es: roundTo(slot.m1Start, 2),
        ef: roundTo(slot.m1End, 2),
        ls: roundTo(slot.m1Start, 2),
        lf: roundTo(slot.m1End, 2),
        slack: 0,
        isCritical: false,
      },
      {
        id: `${slot.jobId}-M2`,
        label: `${slot.jobId} (M2)`,
        es: roundTo(slot.m2Start, 2),
        ef: roundTo(slot.m2End, 2),
        ls: roundTo(slot.m2Start, 2),
        lf: roundTo(slot.m2End, 2),
        slack: 0,
        isCritical: true,
      },
    ]);

    const analysisSections = [
      {
        heading: 'Keseimbangan Beban & Identifikasi Mesin Bottleneck',
        body: `${bottleneckMachine} memikul beban kerja terbesar (${formatNum(Math.max(jRes.totalM1, jRes.totalM2), 2)} vs ${formatNum(Math.min(jRes.totalM1, jRes.totalM2), 2)} satuan waktu). Job pembuka "${jRes.sequence[0].jobId}" membuat Mesin 2 hanya menunggu ${formatNum(jRes.slots[0].m1End, 2)} satuan di awal.`,
        tone: totalIdleM2 <= jRes.slots[0].m1End + 1e-6 ? ('positive' as const) : ('neutral' as const),
      },
    ];

    const recommendations = [
      `Eksekusi seluruh ${input.jobs.length} pekerjaan secara konsisten mengikuti urutan Johnson (${seqStr}) pada Mesin 1 maupun Mesin 2.`,
      `Prioritaskan reduksi waktu setup (SMED) pada ${bottleneckMachine} untuk memangkas Makespan total lebih lanjut.`,
    ];

    const elapsed = roundTo(performance.now() - start, 2);

    return {
      jobId,
      moduleId: 'scheduling',
      jobTitle,
      status: 'success',
      executionMs: elapsed,
      summaryText: `Algoritma Johnson 2-Mesin: urutan optimal ${seqStr} menghasilkan Makespan minimum ${formatNum(jRes.makespan, 2)}.`,
      kpis: [
        { label: 'Urutan Optimal Johnson', value: seqStr, emphasis: 'primary' },
        { label: 'Makespan Minimum (C_max)', value: formatNum(jRes.makespan, 2), emphasis: 'success' },
        { label: 'Total Idle Mesin 2', value: formatNum(totalIdleM2, 2) },
        { label: 'Utilisasi M1 / M2', value: `${formatNum(utilM1, 1)}% / ${formatNum(utilM2, 1)}%` },
      ],
      tables: [
        {
          id: 'scheduling-johnson',
          title: 'Jadwal Flow Shop 2-Mesin (Algoritma Johnson)',
          headers: ['Job', 'Waktu Mesin 1', 'Waktu Mesin 2', 'Jadwal M1', 'Jadwal M2', 'Idle M2'],
          rows: jRes.rows,
        },
      ],
      charts: [
        {
          kind: 'gantt',
          id: 'scheduling-johnson-gantt',
          title: 'Gantt Chart Flow Shop 2-Mesin (Urutan Johnson)',
          subtitle: 'Hijau/Biru = Mesin 1 (M1) · Merah/Aksen = Mesin 2 (M2)',
          totalDuration: Math.max(1, roundTo(jRes.makespan, 2)),
          tasks: ganttTasks,
        },
      ],
      warnings: [],
      auditSteps: [
        {
          title: '1. Partisi Kiri–Kanan Algoritma Johnson',
          formula: 'Pilih min(t₁ᵢ, t₂ᵢ): jika di M1 taruh dari depan; jika di M2 taruh dari belakang',
          detail: `Langkah pemilihan: ${jRes.partitionLog.join(' → ')} menghasilkan urutan ${seqStr}.`,
        },
        {
          title: '2. Simulasi Waktu Mulai/Selesai & Idle M2',
          formula: 'Start_M2(k) = max(End_M1(k), End_M2(k-1))',
          detail: `Makespan akhir = ${formatNum(jRes.makespan, 2)} (hemat ${formatNum(savedTimeVsFcfs, 2)} dibanding urutan awal FCFS = ${formatNum(naiveM2, 2)}).`,
        },
      ],
      analysis: {
        headline: `Makespan Minimum Global ${formatNum(jRes.makespan, 2)} Dicapai Lewat Urutan ${seqStr}`,
        interpretation: `Algoritma Johnson meminimalkan waktu menganggur Mesin 2 menjadi ${formatNum(totalIdleM2, 2)} (utilisasi M1 ${formatNum(utilM1, 1)}%, M2 ${formatNum(utilM2, 1)}%; sisa akhir M1 ${formatNum(totalIdleM1, 2)}).`,
        sections: analysisSections,
        recommendations,
      },
      explanation: {
        keyDecision: `Jalankan pekerjaan dengan urutan ${seqStr} untuk mencapai Makespan tercepat ${formatNum(jRes.makespan, 2)}.`,
        plainSummary: `Pada sistem 2 mesin berurutan (Mesin 1 → Mesin 2), urutan kerja yang salah membuat Mesin 2 sering menganggur menunggu Mesin 1 selesai. Algoritma Johnson menaruh job berdurasi M1 singkat di paling awal (agar M2 cepat mulai bekerja) dan job berdurasi M2 singkat di paling akhir (agar ekor penyelesaian M2 sesingkat mungkin).`,
        metricBreakdown: [
          {
            label: 'Makespan Minimum (C_max)',
            value: formatNum(jRes.makespan, 2),
            meaning: 'Total waktu dari dimulainya job pertama di Mesin 1 hingga tuntasnya job terakhir di Mesin 2.',
            impact:
              savedTimeVsFcfs > 0
                ? `Menghemat ${formatNum(savedTimeVsFcfs, 2)} satuan waktu dibandingkan urutan kedatangan awal (${formatNum(naiveM2, 2)}).`
                : 'Urutan saat ini sudah mencapai batas waktu penyelesaian tercepat yang mungkin.',
          },
          {
            label: 'Total Idle Time Mesin 2',
            value: formatNum(totalIdleM2, 2),
            meaning: 'Akumulasi waktu Mesin 2 berhenti menunggu kiriman barang setengah jadi dari Mesin 1.',
            impact: 'Semakin kecil idle time M2, semakin padat dan produktif aliran lintasan produksi.',
          },
          {
            label: 'Utilisasi M1 / M2',
            value: `${formatNum(utilM1, 1)}% / ${formatNum(utilM2, 1)}%`,
            meaning: 'Persentase jam efektif mesin bekerja produktif selama rentang Makespan.',
            impact: `Menunjukkan bahwa ${bottleneckMachine} adalah stasiun pembatas kecepatan lini.`,
          },
        ],
        workedSteps: [
          {
            stepNumber: 1,
            title: 'Seleksi Nilai Waktu Terkecil & Partisi Depan–Belakang',
            formula: 'min(t₁ᵢ, t₂ᵢ) pada M1 → isi dari kiri; pada M2 → isi dari kanan',
            substitution: jRes.partitionLog.join(' | '),
            result: `Urutan Optimal: ${seqStr}`,
            explanation: 'Memastikan Mesin 2 segera mendapat pasokan pekerjaan di awal dan tidak memiliki ekor panjang di akhir.',
          },
          {
            stepNumber: 2,
            title: 'Menghitung Jadwal Kumulatif M1 & M2',
            formula: 'End_M2(k) = max(End_M1(k), End_M2(k-1)) + t₂(k)',
            substitution: `Total M1 = ${formatNum(jRes.totalM1, 2)}, Total M2 = ${formatNum(jRes.totalM2, 2)}, Total Idle M2 = ${formatNum(totalIdleM2, 2)}`,
            result: `Makespan = ${formatNum(jRes.makespan, 2)}`,
            explanation: 'Job terakhir selesai di Mesin 2 tepat pada titik waktu Makespan minimum.',
          },
        ],
        whyOptimal: [
          `Urutan ${seqStr} keluar sebagai jawaban karena aturan Johnson terbukti secara matematis menghasilkan Makespan global paling minimum pada flow-shop 2 mesin.`,
          `Job pembuka "${jRes.sequence[0].jobId}" memiliki durasi M1 pendek (${formatNum(jRes.slots[0].t1, 2)}), sehingga Mesin 2 langsung aktif secepat mungkin.`,
          savedTimeVsFcfs > 0
            ? `Dibandingkan memproses sesuai urutan input awal (Makespan ${formatNum(naiveM2, 2)}), urutan ini memangkas waktu penyelesaian sebesar ${formatNum(savedTimeVsFcfs, 2)}.`
            : `Urutan ini mempertahankan waktu tunggu Mesin 2 serendah mungkin (${formatNum(totalIdleM2, 2)}).`,
        ],
        risksAndNotes: analysisSections.map((s) => ({
          heading: s.heading,
          detail: s.body,
          tone: s.tone,
        })),
        recommendations,
        glossary: GLOSSARY_BY_MODULE.scheduling,
      },
      derivedValues: {
        bestFlowTime: roundTo(jRes.makespan, 4),
        makespan: roundTo(jRes.makespan, 4),
        totalIdleM2,
        utilizationM1: roundTo(utilM1, 2),
        utilizationM2: roundTo(utilM2, 2),
        sequence: seqStr,
      },
    };
  }

  // Mode A: Single-Machine 6 Dispatching Rules
  const evals: RuleEval[] = [
    evaluateSingleMachineRule('FCFS (First Come First Served)', 'FCFS', [...input.jobs]),
    evaluateSingleMachineRule(
      'SPT (Shortest Processing Time)',
      'SPT',
      [...input.jobs].sort((a, b) => a.processingTime - b.processingTime),
    ),
    evaluateSingleMachineRule(
      'WSPT (Weighted SPT)',
      'WSPT',
      [...input.jobs].sort((a, b) => {
        const wa = a.weight !== undefined && Number.isFinite(a.weight) && a.weight > 0 ? a.weight : 1;
        const wb = b.weight !== undefined && Number.isFinite(b.weight) && b.weight > 0 ? b.weight : 1;
        return a.processingTime / wa - b.processingTime / wb;
      }),
    ),
    evaluateSingleMachineRule(
      'LPT (Longest Processing Time)',
      'LPT',
      [...input.jobs].sort((a, b) => b.processingTime - a.processingTime),
    ),
    evaluateSingleMachineRule(
      'EDD (Earliest Due Date)',
      'EDD',
      [...input.jobs].sort((a, b) => a.dueDate - b.dueDate),
    ),
    evaluateSingleMachineRule(
      'CR (Critical Ratio)',
      'CR',
      [...input.jobs].sort(
        (a, b) =>
          a.dueDate / Math.max(1e-6, a.processingTime) -
          b.dueDate / Math.max(1e-6, b.processingTime),
      ),
    ),
  ];

  const bestFlow = [...evals].sort((a, b) => a.avgCompletion - b.avgCompletion)[0];
  const bestAvgLate = [...evals].sort((a, b) => a.avgLateness - b.avgLateness)[0];
  const bestMaxLate = [...evals].sort((a, b) => a.maxLateness - b.maxLateness)[0];
  const fcfs = evals[0];
  const sptRule = evals[1];
  const wsptRule = evals[2];
  const eddRule = evals[4];
  const hasDistinctWeights = input.jobs.some(
    (j) => j.weight !== undefined && Number.isFinite(j.weight) && Math.abs(j.weight - 1) > 1e-6,
  );
  const ganttSource = hasDistinctWeights ? wsptRule : bestFlow;

  const compTable: ResultTable = {
    id: 'scheduling-rules',
    title: 'Perbandingan Serentak 6 Aturan Prioritas Mesin Tunggal',
    headers: [
      'Aturan Prioritas',
      'Urutan Pengerjaan',
      'Avg Flow Time',
      'Weighted Flow (∑w·C)',
      'Utilisasi (%)',
      'WIP (Avg Job)',
      'Avg Tardiness',
      'Max Tardiness',
      'Job Terlambat',
    ],
    rows: evals.map((e) => [
      `${e.ruleName}${e.shortCode === sptRule.shortCode || e.shortCode === eddRule.shortCode ? ' ★' : ''}`,
      e.sequence.join(' → '),
      roundTo(e.avgCompletion, 2),
      roundTo(e.weightedFlowTime, 2),
      `${roundTo(e.utilizationPct, 1)}%`,
      roundTo(e.avgJobsInSystem, 2),
      roundTo(e.avgLateness, 2),
      roundTo(e.maxLateness, 2),
      e.tardyCount,
    ]),
    highlightRowIndices: [
      evals.findIndex((e) => e.shortCode === (hasDistinctWeights ? 'WSPT' : 'SPT')),
      evals.findIndex((e) => e.shortCode === 'EDD'),
    ],
  };

  const detailTable: ResultTable = {
    id: 'scheduling-spt-detail',
    title: `Detail Jadwal Eksekusi: ${ganttSource.ruleName}`,
    headers: ['Job', 'Waktu Proses', 'Bobot (w)', 'Due Date', 'Mulai', 'Selesai (Flow Time)', 'Tardiness'],
    rows: ganttSource.detailRows,
  };

  const singleGanttTasks = ganttSource.slots.map((slot) => ({
    id: `sm-${slot.jobId}`,
    label: `${slot.jobId}${hasDistinctWeights ? ` (w=${roundTo(slot.weight, 1)})` : ''}`,
    es: roundTo(slot.start, 2),
    ef: roundTo(slot.finish, 2),
    ls: roundTo(slot.start, 2),
    lf: roundTo(Math.max(slot.finish, slot.dueDate), 2),
    slack: roundTo(Math.max(0, slot.dueDate - slot.finish), 2),
    isCritical: slot.lateness > 1e-9,
  }));

  const flowSavingsVsFcfs = roundTo(fcfs.avgCompletion - sptRule.avgCompletion, 2);
  const flowSavingsPct =
    fcfs.avgCompletion > 1e-9 ? (flowSavingsVsFcfs / fcfs.avgCompletion) * 100 : 0;

  const analysisSections = [
    {
      heading: 'Trade-off Efisiensi Lantai (SPT / WSPT) vs Kepastian Tenggat (EDD / CR)',
      body: `SPT (${sptRule.sequence.join(' → ')}) meminimalkan WIP rata-rata menjadi ${formatNum(sptRule.avgJobsInSystem, 2)} job di lantai produksi (${sptRule.tardyCount} terlambat, max tardiness ${formatNum(sptRule.maxLateness, 2)}). Sebaliknya EDD (${eddRule.sequence.join(' → ')}) memagari keterlambatan terparah pada ${formatNum(eddRule.maxLateness, 2)} (${eddRule.tardyCount} terlambat, avg tardiness ${formatNum(eddRule.avgLateness, 2)}).`,
      tone: bestAvgLate.avgLateness <= 1e-6 ? ('positive' as const) : ('neutral' as const),
    },
  ];

  const recommendations = [
    `Gunakan urutan ${hasDistinctWeights ? `WSPT (${wsptRule.sequence.join(' → ')})` : `SPT (${sptRule.sequence.join(' → ')})`} apabila sasaran utama pabrik adalah mempercepat perputaran order dan menekan tumpukan WIP.`,
    `Gunakan urutan EDD (${eddRule.sequence.join(' → ')}) apabila prioritas utama adalah menekan penalti keterlambatan maksimum terhadap tenggat pelanggan (Max Tardiness = ${formatNum(eddRule.maxLateness, 2)}).`,
  ];

  const elapsed = roundTo(performance.now() - start, 2);

  return {
    jobId,
    moduleId: 'scheduling',
    jobTitle,
    status: 'success',
    executionMs: elapsed,
    summaryText: `SPT meminimalkan Avg Flow Time (${formatNum(sptRule.avgCompletion, 2)}), WSPT meminimalkan ∑w·C (${formatNum(wsptRule.weightedFlowTime, 2)}), dan EDD meminimalkan Max Tardiness (${formatNum(eddRule.maxLateness, 2)}).`,
    kpis: [
      { label: 'Min. Avg Flow Time (SPT)', value: formatNum(sptRule.avgCompletion, 2), emphasis: 'primary' },
      {
        label: 'Weighted Flow (WSPT)',
        value: formatNum(wsptRule.weightedFlowTime, 2),
        emphasis: hasDistinctWeights ? 'primary' : undefined,
      },
      {
        label: 'Min. Max Tardiness (EDD)',
        value: formatNum(eddRule.maxLateness, 2),
        emphasis: eddRule.maxLateness <= 1e-6 ? 'success' : 'warning',
      },
      { label: 'Total Makespan', value: formatNum(sptRule.makespan, 2) },
    ],
    tables: [compTable, detailTable],
    charts: [
      {
        kind: 'bar',
        id: 'scheduling-flow-bar',
        title: 'Perbandingan Rata-rata Flow Time & Keterlambatan (6 Aturan)',
        xLabel: 'Aturan Prioritas',
        yLabel: 'Rata-rata Flow Time',
        bars: evals.map((e) => ({
          label: e.shortCode,
          value: roundTo(e.avgCompletion, 2),
          annotation: `Late: ${roundTo(e.avgLateness, 1)}`,
          tone: e.shortCode === 'SPT' ? 'primary' : e.shortCode === 'EDD' ? 'success' : 'default',
        })),
      },
      {
        kind: 'gantt',
        id: 'scheduling-single-gantt',
        title: `Gantt Chart Eksekusi Mesin Tunggal — ${ganttSource.shortCode}`,
        subtitle: 'Merah = Melewati Due Date (Terlambat) · Hijau = Tepat Waktu · Garis Abu = Sisa Margin ke Due Date',
        totalDuration: Math.max(
          1,
          roundTo(
            Math.max(ganttSource.makespan, ...ganttSource.slots.map((s) => s.dueDate)),
            2,
          ),
        ),
        tasks: singleGanttTasks,
      },
    ],
    warnings: [],
    auditSteps: [
      {
        title: '1. Evaluasi 6 Aturan Dispatching (FCFS, SPT, WSPT, LPT, EDD, CR)',
        formula: 'Avg Flow = ∑Cᵢ / n  ·  WIP = ∑Cᵢ / ∑tᵢ  ·  Tardinessᵢ = max(0, Cᵢ - dᵢ)',
        detail: `SPT menghasilkan ∑Cᵢ = ${formatNum(sptRule.sumFlow, 2)} → Avg Flow = ${formatNum(sptRule.avgCompletion, 2)} (WIP ${formatNum(sptRule.avgJobsInSystem, 2)} job); EDD menghasilkan Max Tardiness = ${formatNum(eddRule.maxLateness, 2)}.`,
      },
    ],
    analysis: {
      headline: `SPT Pangkas Flow Time ${formatNum(flowSavingsPct, 1)}% vs FCFS; EDD Kunci Max Tardiness di ${formatNum(eddRule.maxLateness, 2)}`,
      interpretation: `Total Makespan pada mesin tunggal selalu tetap (${formatNum(sptRule.makespan, 2)}), namun pemilihan aturan urutan mengubah drastis antrean WIP (${formatNum(sptRule.avgJobsInSystem, 2)} pada SPT vs ${formatNum(fcfs.avgJobsInSystem, 2)} pada FCFS) dan keterlambatan maksimum (${formatNum(eddRule.maxLateness, 2)} pada EDD vs ${formatNum(fcfs.maxLateness, 2)} pada FCFS).`,
      sections: analysisSections,
      recommendations,
    },
    explanation: {
      keyDecision: `Pilih urutan SPT (${sptRule.sequence.join(' → ')}) untuk meminimalkan waktu alir rata-rata (${formatNum(sptRule.avgCompletion, 2)}), atau EDD (${eddRule.sequence.join(' → ')}) untuk membatasi keterlambatan maksimum (${formatNum(eddRule.maxLateness, 2)}).`,
      plainSummary: `Sistem mensimulasikan 6 cara pengurutan kerja sekaligus pada ${input.jobs.length} order. Walaupun total waktu selesai seluruh order (Makespan = ${formatNum(sptRule.makespan, 2)}) sama di semua aturan, urutan pengerjaan menentukan seberapa lama order lain tertahan di antrean dan order mana yang melewati tenggat.`,
      metricBreakdown: [
        {
          label: 'Avg Flow Time Minimum (SPT)',
          value: formatNum(sptRule.avgCompletion, 2),
          meaning: 'Rata-rata waktu tunggu ditambah waktu proses sejak order masuk hingga selesai.',
          impact:
            flowSavingsVsFcfs > 0
              ? `Turun ${formatNum(flowSavingsVsFcfs, 2)} (${formatNum(flowSavingsPct, 1)}%) dibanding urutan kedatangan FCFS (${formatNum(fcfs.avgCompletion, 2)}).`
              : 'Urutan kedatangan awal kebetulan sudah sama cepatnya dengan SPT.',
        },
        {
          label: 'WIP Minimum (Rata-rata Job di Sistem)',
          value: `${formatNum(sptRule.avgJobsInSystem, 2)} job`,
          meaning: 'Rata-rata jumlah pekerjaan yang menumpuk di lantai produksi pada satu waktu.',
          impact: 'WIP rendah menghemat ruang lantai pabrik dan mempercepat arus kas penyelesaian barang.',
        },
        {
          label: 'Max Tardiness Minimum (EDD)',
          value: formatNum(eddRule.maxLateness, 2),
          meaning: 'Nilai keterlambatan paling parah di antara seluruh pekerjaan pada urutan EDD.',
          impact:
            eddRule.maxLateness <= 1e-6
              ? 'Nol keterlambatan: seluruh pesanan selesai tepat atau sebelum Due Date!'
              : 'Membatasi risiko komplain atau denda SLA ekstrem dari pelanggan.',
        },
        {
          label: 'Weighted Flow Time (WSPT)',
          value: formatNum(wsptRule.weightedFlowTime, 2),
          meaning: 'Akumulasi waktu selesai dikalikan bobot kepentingan (∑ wᵢ · Cᵢ).',
          impact: 'Memastikan pesanan VIP / bernilai tinggi tidak tertahan oleh pesanan berprioritas rendah.',
        },
      ],
      workedSteps: [
        {
          stepNumber: 1,
          title: 'Mengurutkan Durasi Terpendek pada Aturan SPT',
          formula: 'Urutkan t₁ ≤ t₂ ≤ … ≤ tₙ;  Cₖ = ∑(j=1..k) tⱼ',
          substitution: sptRule.slots
            .map((s) => `${s.jobId}(t=${formatNum(s.finish - s.start, 1)} → C=${formatNum(s.finish, 1)})`)
            .join(', '),
          result: `Avg Flow = ${formatNum(sptRule.sumFlow, 1)} / ${input.jobs.length} = ${formatNum(sptRule.avgCompletion, 2)}`,
          explanation: 'Mendahulukan durasi pendek mencegah pekerjaan besar memblokir banyak pekerjaan kecil di belakangnya.',
        },
        {
          stepNumber: 2,
          title: 'Mengurutkan Tenggat Terdekat pada Aturan EDD',
          formula: 'Urutkan d₁ ≤ d₂ ≤ … ≤ dₙ;  Tardinessᵢ = max(0, Cᵢ - dᵢ)',
          substitution: eddRule.slots
            .map((s) => `${s.jobId}(C=${formatNum(s.finish, 1)}, d=${formatNum(s.dueDate, 1)} → Late=${formatNum(s.lateness, 1)})`)
            .join(', '),
          result: `Max Tardiness = ${formatNum(eddRule.maxLateness, 2)} (${eddRule.tardyCount} job terlambat)`,
          explanation: 'Teorema Jackson menjamin pengurutan Due Date terdekat selalu meminimalkan keterlambatan maksimum.',
        },
      ],
      whyOptimal: [
        `Total Makespan bernilai sama (${formatNum(sptRule.makespan, 2)}) di seluruh 6 aturan karena satu mesin bekerja tanpa jeda menyelesaikan total durasi ∑tᵢ yang identik.`,
        `SPT keluar sebagai pemenang waktu alir (${formatNum(sptRule.avgCompletion, 2)}) karena setiap kali pekerjaan singkat diselesaikan lebih dulu, waktu tunggunya tidak lagi membebani seluruh pekerjaan berikutnya.`,
        hasDistinctWeights
          ? `Karena pekerjaan Anda memiliki bobot prioritas berbeda, aturan WSPT (${wsptRule.sequence.join(' → ')}) mengurutkan rasio tᵢ/wᵢ terkecil sehingga menekan biaya tunggu berbobot minimum di angka ${formatNum(wsptRule.weightedFlowTime, 2)}.`
          : `EDD (${eddRule.sequence.join(' → ')}) keluar sebagai pemenang kepatuhan tenggat karena mendahulukan tenggat paling mendesak sehingga Max Tardiness terkunci di ${formatNum(eddRule.maxLateness, 2)} (dibanding ${formatNum(bestMaxLate.maxLateness, 2)} minimum global).`,
      ],
      risksAndNotes: analysisSections.map((s) => ({
        heading: s.heading,
        detail: s.body,
        tone: s.tone,
      })),
      recommendations,
      glossary: GLOSSARY_BY_MODULE.scheduling,
    },
    derivedValues: {
      bestFlowTime: roundTo(bestFlow.avgCompletion, 4),
      wsptWeightedFlow: roundTo(wsptRule.weightedFlowTime, 4),
      minAvgLateness: roundTo(bestAvgLate.avgLateness, 4),
      minMaxLateness: roundTo(bestMaxLate.maxLateness, 4),
      bestMaxLateRule: bestMaxLate.shortCode,
      makespan: roundTo(bestFlow.makespan, 4),
    },
  };
}
