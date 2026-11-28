import type {
  ModuleExecutionResult,
  ModuleId,
  SchedulingJobInput,
} from '../types/module.types.ts';
import type {
  ModuleJob,
  PipelineLink,
  PipelineTransferRecord,
} from '../types/workspace.types.ts';

export interface ExecutionStagePlan {
  stages: ModuleJob[][];
  hasCycle: boolean;
}

export function buildPipelineExecutionStages(
  jobs: ModuleJob[],
  links: PipelineLink[],
): ExecutionStagePlan {
  const activeJobs = jobs.filter((j) => j.enabled);
  const activeIds = new Set(activeJobs.map((j) => j.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const job of activeJobs) {
    inDegree.set(job.id, 0);
    adjacency.set(job.id, []);
  }

  for (const link of links) {
    if (!activeIds.has(link.sourceJobId) || !activeIds.has(link.targetJobId)) {
      continue;
    }
    if (link.sourceJobId === link.targetJobId) continue;
    adjacency.get(link.sourceJobId)!.push(link.targetJobId);
    inDegree.set(link.targetJobId, (inDegree.get(link.targetJobId) ?? 0) + 1);
  }

  const jobMap = new Map(activeJobs.map((j) => [j.id, j]));
  const stages: ModuleJob[][] = [];
  let queue = activeJobs.filter((j) => (inDegree.get(j.id) ?? 0) === 0);
  let processed = 0;

  while (queue.length > 0) {
    stages.push(queue);
    const nextQueue: ModuleJob[] = [];
    for (const current of queue) {
      processed += 1;
      for (const neighborId of adjacency.get(current.id) ?? []) {
        const deg = (inDegree.get(neighborId) ?? 0) - 1;
        inDegree.set(neighborId, deg);
        if (deg === 0) {
          const neighbor = jobMap.get(neighborId);
          if (neighbor) nextQueue.push(neighbor);
        }
      }
    }
    queue = nextQueue;
  }

  const hasCycle = processed < activeJobs.length;
  if (hasCycle) {
    const visited = new Set(stages.flat().map((j) => j.id));
    const remaining = activeJobs.filter((j) => !visited.has(j.id));
    if (remaining.length > 0) stages.push(remaining);
  }

  return { stages, hasCycle };
}

function parseNumberSeries(raw: number | string): number[] {
  if (typeof raw === 'number' && Number.isFinite(raw)) return [raw];
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[,;|]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

interface ParsedWorkOrderDetail {
  job: SchedulingJobInput;
  qty: number;
}

function parseWorkOrderTokensDetailed(raw: string, multiplier: number): ParsedWorkOrderDetail[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const entries = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const details: ParsedWorkOrderDetail[] = [];
  for (const entry of entries) {
    const [jobIdRaw, qtyStr, dueStr, weightStr] = entry.split(':').map((s) => s.trim());
    const qty = Number(qtyStr);
    const due = Number(dueStr);
    const weight = Number(weightStr);
    if (!jobIdRaw || !Number.isFinite(qty) || qty <= 0) continue;
    const procTime = Math.max(0.5, Number((qty * multiplier).toFixed(2)));
    details.push({
      qty,
      job: {
        jobId: jobIdRaw,
        processingTime: procTime,
        dueDate: Number.isFinite(due) && due > 0 ? due : Math.round(procTime * 2),
        weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
        processingTimeMachine2: Math.max(0.5, Number((procTime * 0.8).toFixed(2))),
      },
    });
  }
  return details;
}

export function applyPipelineLinksToJob(
  job: ModuleJob,
  links: PipelineLink[],
  upstreamResults: Record<string, ModuleExecutionResult>,
): {
  updatedJob: ModuleJob;
  appliedNotes: string[];
  transfers: PipelineTransferRecord[];
} {
  const incoming = links.filter((l) => l.targetJobId === job.id);
  if (incoming.length === 0) {
    return { updatedJob: job, appliedNotes: [], transfers: [] };
  }

  const clonedInput = structuredClone(job.input) as unknown as Record<string, unknown>;
  const appliedNotes: string[] = [];
  const transfers: PipelineTransferRecord[] = [];

  for (const link of incoming) {
    const sourceResult = upstreamResults[link.sourceJobId];
    if (!sourceResult) continue;
    const rawVal = sourceResult.derivedValues[link.sourceOutputKey];
    if (rawVal === undefined) continue;

    const mult = Number.isFinite(link.multiplier) && link.multiplier > 0 ? link.multiplier : 1;

    // 1. Work Orders from MRP -> Scheduling.jobs
    if (link.targetField === 'workOrdersFromMrp' && typeof rawVal === 'string') {
      const detailed = parseWorkOrderTokensDetailed(rawVal, mult);
      if (detailed.length > 0) {
        const converted = detailed.map((d) => d.job);
        clonedInput.jobs = converted;
        appliedNotes.push(
          `Pipeline: ${converted.length} Work Order MRP disinkronkan ke Scheduling (pengali waktu ×${mult} jam/unit).`,
        );
        transfers.push({
          linkId: link.id,
          sourceJobId: link.sourceJobId,
          sourceJobTitle: sourceResult.jobTitle,
          sourceModuleId: sourceResult.moduleId,
          targetJobId: job.id,
          targetModuleId: job.moduleId,
          sourceOutputKey: link.sourceOutputKey,
          targetField: link.targetField,
          multiplier: mult,
          headline: `${converted.length} Work Order hasil Planned Order Releases MRP → Tabel Pekerjaan Scheduling`,
          headers: [
            'ID Work Order',
            'Qty Rilis MRP',
            'Pengali',
            'Waktu Mesin 1 (t₁)',
            'Waktu Mesin 2 (t₂)',
            'Due Date',
            'Bobot (w)',
          ],
          rows: detailed.map((d) => [
            d.job.jobId,
            `${d.qty} unit`,
            `×${mult}`,
            `${d.job.processingTime} jam`,
            `${d.job.processingTimeMachine2 ?? d.job.processingTime} jam`,
            `Hari ${d.job.dueDate}`,
            d.job.weight ?? 1,
          ]),
        });
      }
      continue;
    }

    const rawSeries = parseNumberSeries(rawVal);
    const series = rawSeries.map((v) => v * mult);
    const numVal = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal * mult : series[0];

    // 2. Forecasting -> MPS.forecasts (also adapts horizon length cleanly when Forecasting horizon changes)
    if (
      link.targetField === 'forecasts' &&
      Array.isArray(clonedInput.forecasts) &&
      series.length > 0
    ) {
      const targetLen = series.length >= 2 ? series.length : (clonedInput.forecasts as number[]).length;
      const prevLabels = Array.isArray(clonedInput.periodLabels)
        ? (clonedInput.periodLabels as string[])
        : [];
      const prevCo = Array.isArray(clonedInput.customerOrders)
        ? (clonedInput.customerOrders as number[])
        : [];
      const prevFirm = Array.isArray(clonedInput.firmMps)
        ? (clonedInput.firmMps as (number | null)[])
        : [];
      const prevCap = Array.isArray(clonedInput.availableCapacity)
        ? (clonedInput.availableCapacity as number[])
        : [];
      const fallbackCap = prevCap[prevCap.length - 1] ?? 160;

      const nextLabels: string[] = [];
      const nextForecasts: number[] = [];
      const nextCo: number[] = [];
      const nextFirm: (number | null)[] = [];
      const nextCap: number[] = [];

      for (let t = 0; t < targetLen; t += 1) {
        const mapped = series[Math.min(t, series.length - 1)];
        const rounded = Math.max(0, Math.round(mapped));
        nextLabels.push(prevLabels[t] || `Mgg ${t + 1}`);
        nextForecasts.push(rounded);
        nextCo.push(prevCo[t] !== undefined ? prevCo[t] : 0);
        nextFirm.push(prevFirm[t] !== undefined ? prevFirm[t] : null);
        nextCap.push(prevCap[t] !== undefined ? prevCap[t] : fallbackCap);
      }

      clonedInput.periodLabels = nextLabels;
      clonedInput.forecasts = nextForecasts;
      clonedInput.customerOrders = nextCo;
      clonedInput.firmMps = nextFirm;
      clonedInput.availableCapacity = nextCap;

      appliedNotes.push(
        `Pipeline: MPS Forecast = [${nextForecasts.join(', ')}] (dari ${sourceResult.jobTitle}).`,
      );
      transfers.push({
        linkId: link.id,
        sourceJobId: link.sourceJobId,
        sourceJobTitle: sourceResult.jobTitle,
        sourceModuleId: sourceResult.moduleId,
        targetJobId: job.id,
        targetModuleId: job.moduleId,
        sourceOutputKey: link.sourceOutputKey,
        targetField: link.targetField,
        multiplier: mult,
        headline: `${nextForecasts.length} Periode Proyeksi Permintaan Forecasting → Kolom Forecast MPS`,
        headers: ['Periode', 'Proyeksi 01 FC', 'Pengali', 'Forecast Masuk ke MPS'],
        rows: nextForecasts.map((val, idx) => [
          nextLabels[idx],
          Number((rawSeries[Math.min(idx, rawSeries.length - 1)] ?? 0).toFixed(2)),
          `×${mult}`,
          `${val} unit`,
        ]),
      });
      continue;
    }

    // 3. MPS -> MRP Level-0 grossRequirements (aligns horizon length to MPS schedule)
    if (
      link.targetField === 'grossRequirements' &&
      Array.isArray(clonedInput.items) &&
      series.length > 0
    ) {
      const targetLen = series.length;
      const prevLabels = Array.isArray(clonedInput.periodLabels)
        ? (clonedInput.periodLabels as string[])
        : [];
      const nextLabels = Array.from(
        { length: targetLen },
        (_, t) => prevLabels[t] || `Mgg ${t + 1}`,
      );
      clonedInput.periodLabels = nextLabels;

      const items = clonedInput.items as {
        item: string;
        level: number;
        grossRequirements: number[];
        scheduledReceipts: number[];
      }[];

      for (const it of items) {
        it.grossRequirements = Array.from(
          { length: targetLen },
          (_, t) => it.grossRequirements[t] ?? 0,
        );
        it.scheduledReceipts = Array.from(
          { length: targetLen },
          (_, t) => it.scheduledReceipts[t] ?? 0,
        );
      }

      const level0 = items.filter((it) => it.level === 0);
      const targets = level0.length > 0 ? level0 : items.slice(0, 1);
      const injectedSeries = series.map((v) => Math.max(0, Math.round(v)));
      for (const it of targets) {
        for (let t = 0; t < targetLen; t += 1) {
          it.grossRequirements[t] = injectedSeries[t] ?? 0;
        }
      }

      const targetNames = targets.map((t) => t.item).join(', ');
      appliedNotes.push(
        `Pipeline: MRP Level-0 Gross Requirements = [${injectedSeries.join(', ')}] (dari ${sourceResult.jobTitle}).`,
      );
      transfers.push({
        linkId: link.id,
        sourceJobId: link.sourceJobId,
        sourceJobTitle: sourceResult.jobTitle,
        sourceModuleId: sourceResult.moduleId,
        targetJobId: job.id,
        targetModuleId: job.moduleId,
        sourceOutputKey: link.sourceOutputKey,
        targetField: link.targetField,
        multiplier: mult,
        headline: `${targetLen} Periode Jadwal MPS Receipts → Gross Requirements Level-0 (${targetNames})`,
        headers: ['Periode', 'Jadwal MPS Receipts', 'Pengali', 'Gross Req Level-0 MRP'],
        rows: injectedSeries.map((val, idx) => [
          nextLabels[idx],
          `${Math.round(rawSeries[idx] ?? 0)} unit`,
          `×${mult}`,
          `${val} unit`,
        ]),
      });
      continue;
    }

    if (numVal === undefined || !Number.isFinite(numVal)) continue;

    // 4. Scalar fields (e.g. safetyStock or processingTimeScale)
    if (link.targetField in clonedInput && typeof clonedInput[link.targetField] === 'number') {
      const nextVal = Math.max(0, Math.round(numVal));
      clonedInput[link.targetField] = nextVal;
      appliedNotes.push(
        `Pipeline: ${link.targetField} = ${nextVal} (dari ${sourceResult.jobTitle}).`,
      );
      transfers.push({
        linkId: link.id,
        sourceJobId: link.sourceJobId,
        sourceJobTitle: sourceResult.jobTitle,
        sourceModuleId: sourceResult.moduleId,
        targetJobId: job.id,
        targetModuleId: job.moduleId,
        sourceOutputKey: link.sourceOutputKey,
        targetField: link.targetField,
        multiplier: mult,
        headline: `Parameter ${link.targetField} diperbarui otomatis menjadi ${nextVal}`,
        headers: ['Parameter Target', 'Nilai Hulu', 'Pengali', 'Nilai Masuk'],
        rows: [[link.targetField, Number(rawVal), `×${mult}`, nextVal]],
      });
    } else if (
      link.targetField === 'processingTimeScale' &&
      Array.isArray(clonedInput.jobs) &&
      clonedInput.jobs.length > 0
    ) {
      const factor = Math.max(0.1, numVal);
      const jobsArr = clonedInput.jobs as SchedulingJobInput[];
      clonedInput.jobs = jobsArr.map((j) => ({
        ...j,
        processingTime: Number(Math.max(0.5, j.processingTime * factor).toFixed(2)),
      }));
      appliedNotes.push(
        `Pipeline: Skala waktu proses job ×${factor.toFixed(2)} (dari ${sourceResult.jobTitle}).`,
      );
    }
  }

  return {
    updatedJob: { ...job, input: clonedInput as unknown as ModuleJob['input'] },
    appliedNotes,
    transfers,
  };
}

const CHAIN_ORDER: ModuleId[] = ['forecasting', 'mps', 'mrp', 'scheduling'];

const DEFAULT_EDGE_SPEC: Record<
  'forecasting' | 'mps' | 'mrp',
  { targetModule: ModuleId; sourceOutputKey: string; targetField: string; multiplier: number }
> = {
  forecasting: {
    targetModule: 'mps',
    sourceOutputKey: 'horizonForecasts',
    targetField: 'forecasts',
    multiplier: 1,
  },
  mps: {
    targetModule: 'mrp',
    sourceOutputKey: 'mpsSchedule',
    targetField: 'grossRequirements',
    multiplier: 1,
  },
  mrp: {
    targetModule: 'scheduling',
    sourceOutputKey: 'workOrderList',
    targetField: 'workOrdersFromMrp',
    multiplier: 0.02,
  },
};

export interface DownstreamChainSetupResult {
  jobs: ModuleJob[];
  links: PipelineLink[];
  nextStageJobId: string | null;
  createdStages: ModuleId[];
  createdLinksCount: number;
}

/**
 * Ensures every downstream PPIC stage and pipeline link exists starting from `sourceJobId`.
 * Allows a user with ONLY Forecasting data (1 dataset) to flow cleanly through
 * 01 FC -> 02 MPS -> 03 MR -> 04 SC in 1 click.
 */
export function ensureDownstreamChainFromJob(
  currentJobs: ModuleJob[],
  currentLinks: PipelineLink[],
  sourceJobId: string,
  createJob: (moduleId: ModuleId) => ModuleJob,
): DownstreamChainSetupResult {
  const sourceJob = currentJobs.find((j) => j.id === sourceJobId);
  if (!sourceJob) {
    return {
      jobs: currentJobs,
      links: currentLinks,
      nextStageJobId: null,
      createdStages: [],
      createdLinksCount: 0,
    };
  }

  const startIdx = CHAIN_ORDER.indexOf(sourceJob.moduleId);
  if (startIdx < 0 || startIdx >= CHAIN_ORDER.length - 1) {
    return {
      jobs: currentJobs,
      links: currentLinks,
      nextStageJobId: null,
      createdStages: [],
      createdLinksCount: 0,
    };
  }

  const nextJobs = currentJobs.map((j) =>
    j.id === sourceJobId ? { ...j, enabled: true } : j,
  );
  const nextLinks = [...currentLinks];
  const createdStages: ModuleId[] = [];
  let createdLinksCount = 0;

  let upstreamJob = nextJobs.find((j) => j.id === sourceJobId)!;
  let nextStageJobId: string | null = null;

  for (let idx = startIdx; idx < CHAIN_ORDER.length - 1; idx += 1) {
    const srcMod = CHAIN_ORDER[idx] as 'forecasting' | 'mps' | 'mrp';
    const spec = DEFAULT_EDGE_SPEC[srcMod];

    // Prefer an existing linked downstream job first, otherwise any existing job of that module
    const existingLink = nextLinks.find(
      (l) =>
        l.sourceJobId === upstreamJob.id &&
        l.targetField === spec.targetField &&
        nextJobs.some((j) => j.id === l.targetJobId),
    );

    let targetJob = existingLink
      ? nextJobs.find((j) => j.id === existingLink.targetJobId)
      : nextJobs.find((j) => j.moduleId === spec.targetModule);

    if (!targetJob) {
      targetJob = createJob(spec.targetModule);
      nextJobs.push(targetJob);
      createdStages.push(spec.targetModule);
    } else if (!targetJob.enabled) {
      targetJob = { ...targetJob, enabled: true };
      const tIdx = nextJobs.findIndex((j) => j.id === targetJob!.id);
      if (tIdx >= 0) nextJobs[tIdx] = targetJob;
    }

    if (!existingLink) {
      // Remove any stale link writing to the same targetJob + targetField to prevent conflicts
      for (let i = nextLinks.length - 1; i >= 0; i -= 1) {
        if (
          nextLinks[i].targetJobId === targetJob.id &&
          nextLinks[i].targetField === spec.targetField
        ) {
          nextLinks.splice(i, 1);
        }
      }
      nextLinks.push({
        id: `link-auto-${srcMod}-${spec.targetModule}-${Date.now()}-${idx}`,
        sourceJobId: upstreamJob.id,
        sourceOutputKey: spec.sourceOutputKey,
        targetJobId: targetJob.id,
        targetField: spec.targetField,
        multiplier: spec.multiplier,
      });
      createdLinksCount += 1;
    }

    if (idx === startIdx) {
      nextStageJobId = targetJob.id;
    }
    upstreamJob = targetJob;
  }

  return {
    jobs: nextJobs,
    links: nextLinks,
    nextStageJobId,
    createdStages,
    createdLinksCount,
  };
}

