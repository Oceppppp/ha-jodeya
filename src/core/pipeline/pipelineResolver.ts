import type { ModuleExecutionResult, SchedulingJobInput } from '../types/module.types.ts';
import type { ModuleJob, PipelineLink } from '../types/workspace.types.ts';

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

function parseWorkOrderTokens(raw: string, multiplier: number): SchedulingJobInput[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const entries = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const jobs: SchedulingJobInput[] = [];
  for (const entry of entries) {
    const [jobIdRaw, qtyStr, dueStr, weightStr] = entry.split(':').map((s) => s.trim());
    const qty = Number(qtyStr);
    const due = Number(dueStr);
    const weight = Number(weightStr);
    if (!jobIdRaw || !Number.isFinite(qty) || qty <= 0) continue;
    const procTime = Math.max(0.5, Number((qty * multiplier).toFixed(2)));
    jobs.push({
      jobId: jobIdRaw,
      processingTime: procTime,
      dueDate: Number.isFinite(due) && due > 0 ? due : Math.round(procTime * 2),
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      processingTimeMachine2: Math.max(0.5, Number((procTime * 0.8).toFixed(2))),
    });
  }
  return jobs;
}

export function applyPipelineLinksToJob(
  job: ModuleJob,
  links: PipelineLink[],
  upstreamResults: Record<string, ModuleExecutionResult>,
): { updatedJob: ModuleJob; appliedNotes: string[] } {
  const incoming = links.filter((l) => l.targetJobId === job.id);
  if (incoming.length === 0) {
    return { updatedJob: job, appliedNotes: [] };
  }

  const clonedInput = structuredClone(job.input) as unknown as Record<string, unknown>;
  const appliedNotes: string[] = [];

  for (const link of incoming) {
    const sourceResult = upstreamResults[link.sourceJobId];
    if (!sourceResult) continue;
    const rawVal = sourceResult.derivedValues[link.sourceOutputKey];
    if (rawVal === undefined) continue;

    const mult = Number.isFinite(link.multiplier) && link.multiplier > 0 ? link.multiplier : 1;

    // 1. Work Orders from MRP -> Scheduling.jobs
    if (link.targetField === 'workOrdersFromMrp' && typeof rawVal === 'string') {
      const converted = parseWorkOrderTokens(rawVal, mult);
      if (converted.length > 0) {
        clonedInput.jobs = converted;
        appliedNotes.push(
          `Pipeline: ${converted.length} Work Order MRP disinkronkan ke Scheduling (pengali waktu ×${mult} per unit).`,
        );
      }
      continue;
    }

    const series = parseNumberSeries(rawVal).map((v) => v * mult);
    const numVal = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal * mult : series[0];

    // 2. Forecasting -> MPS.forecasts
    if (
      link.targetField === 'forecasts' &&
      Array.isArray(clonedInput.forecasts) &&
      clonedInput.forecasts.length > 0 &&
      series.length > 0
    ) {
      const currentForecasts = clonedInput.forecasts as number[];
      const nextForecasts = currentForecasts.map((_, t) => {
        const mapped = series[Math.min(t, series.length - 1)];
        return Math.max(0, Math.round(mapped));
      });
      clonedInput.forecasts = nextForecasts;
      appliedNotes.push(
        `Pipeline: MPS Forecast = [${nextForecasts.join(', ')}] (dari ${sourceResult.jobTitle}).`,
      );
      continue;
    }

    // 3. MPS -> MRP Level-0 grossRequirements
    if (
      link.targetField === 'grossRequirements' &&
      Array.isArray(clonedInput.items) &&
      series.length > 0
    ) {
      const items = clonedInput.items as {
        item: string;
        level: number;
        grossRequirements: number[];
      }[];
      const level0 = items.filter((it) => it.level === 0);
      const targets = level0.length > 0 ? level0 : items.slice(0, 1);
      for (const it of targets) {
        const len = it.grossRequirements.length;
        for (let t = 0; t < len; t += 1) {
          const val = series[t] ?? 0;
          it.grossRequirements[t] = Math.max(0, Math.round(val));
        }
      }
      appliedNotes.push(
        `Pipeline: MRP Level-0 Gross Requirements = [${series.map((v) => Math.round(v)).join(', ')}] (dari ${sourceResult.jobTitle}).`,
      );
      continue;
    }

    if (numVal === undefined || !Number.isFinite(numVal)) continue;

    // 4. Scalar fields (e.g. safetyStock or processingTimeScale)
    if (link.targetField in clonedInput && typeof clonedInput[link.targetField] === 'number') {
      clonedInput[link.targetField] = Math.max(0, Math.round(numVal));
      appliedNotes.push(
        `Pipeline: ${link.targetField} = ${clonedInput[link.targetField]} (dari ${sourceResult.jobTitle}).`,
      );
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
  };
}
