import { describe, expect, it } from 'vitest';
import {
  buildPipelineExecutionStages,
  ensureDownstreamChainFromJob,
} from '../../src/core/pipeline/pipelineResolver.ts';
import type { SchedulingInput } from '../../src/core/types/module.types.ts';
import {
  createJobForModule,
  createPpic4StagePreset,
} from '../../src/io/templates/sampleDatasets.ts';
import { runAllModulesSimultaneously } from '../../src/workers/workerPool.ts';

describe('4-Stage PPIC Pipeline DAG (Forecasting -> MPS -> MRP -> Scheduling)', () => {
  it('partitions 4 linked methods into 4 sequential Kahn stages and propagates outputs end-to-end', async () => {
    const { jobs, links } = createPpic4StagePreset();
    const plan = buildPipelineExecutionStages(jobs, links);

    expect(plan.hasCycle).toBe(false);
    expect(plan.stages.length).toBe(4);
    expect(plan.stages[0][0].moduleId).toBe('forecasting');
    expect(plan.stages[1][0].moduleId).toBe('mps');
    expect(plan.stages[2][0].moduleId).toBe('mrp');
    expect(plan.stages[3][0].moduleId).toBe('scheduling');

    const summary = await runAllModulesSimultaneously(jobs, links);
    expect(summary.totalJobs).toBe(4);
    expect(summary.errorCount).toBe(0);

    const mpsRes = summary.resultsByJobId['job-mps-stage2'];
    const mrpRes = summary.resultsByJobId['job-mrp-stage3'];
    const scRes = summary.resultsByJobId['job-sc-stage4'];

    expect(mpsRes.warnings.some((w) => w.startsWith('Pipeline: MPS Forecast'))).toBe(true);
    expect(mrpRes.warnings.some((w) => w.startsWith('Pipeline: MRP Level-0 Gross Requirements'))).toBe(true);
    expect(scRes.warnings.some((w) => w.includes('Work Order MRP disinkronkan ke Scheduling'))).toBe(true);

    // Verify structured transfer records and materialized inputs exist for MRP -> Scheduling
    const scTransfers = summary.transfersByJobId?.['job-sc-stage4'] ?? [];
    expect(scTransfers.length).toBe(1);
    expect(scTransfers[0].sourceModuleId).toBe('mrp');
    expect(scTransfers[0].rows.length).toBeGreaterThan(0);

    const materializedScInput = summary.effectiveInputsByJobId?.['job-sc-stage4'] as
      | SchedulingInput
      | undefined;
    expect(materializedScInput).toBeDefined();
    expect(materializedScInput!.jobs.length).toBe(scTransfers[0].rows.length);
    expect(materializedScInput!.jobs[0].jobId).not.toBe('WO-101');
  });

  it('auto-builds and flows FC -> MPS -> MRP -> Scheduling starting from ONLY a single Forecasting dataset', async () => {
    const fcOnly = createJobForModule('forecasting');
    const chain = ensureDownstreamChainFromJob([fcOnly], [], fcOnly.id, createJobForModule);

    expect(chain.jobs.length).toBe(4);
    expect(chain.links.length).toBe(3);
    expect(chain.createdStages).toEqual(['mps', 'mrp', 'scheduling']);
    expect(chain.nextStageJobId).toBeTruthy();

    const summary = await runAllModulesSimultaneously(chain.jobs, chain.links);
    expect(summary.totalJobs).toBe(4);
    expect(summary.errorCount).toBe(0);

    const scJob = chain.jobs.find((j) => j.moduleId === 'scheduling')!;
    const scTransfers = summary.transfersByJobId?.[scJob.id] ?? [];
    expect(scTransfers.length).toBe(1);
    expect(scTransfers[0].rows.length).toBeGreaterThan(0);

    const effectiveSc = summary.effectiveInputsByJobId?.[scJob.id] as SchedulingInput | undefined;
    expect(effectiveSc).toBeDefined();
    expect(effectiveSc!.jobs.length).toBe(scTransfers[0].rows.length);
  });

  it('detects circular dependency cycles gracefully without hanging batch execution', async () => {
    const { jobs, links } = createPpic4StagePreset();
    const cyclicLinks = [
      ...links,
      {
        id: 'cycle-back-link',
        sourceJobId: 'job-sc-stage4',
        sourceOutputKey: 'makespan',
        targetJobId: 'job-mps-stage2',
        targetField: 'safetyStock',
        multiplier: 1,
      },
    ];

    const plan = buildPipelineExecutionStages(jobs, cyclicLinks);
    expect(plan.hasCycle).toBe(true);

    const summary = await runAllModulesSimultaneously(jobs, cyclicLinks);
    expect(summary.totalJobs).toBe(4);
  });
});
