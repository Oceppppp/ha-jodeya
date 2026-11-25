import { describe, expect, it } from 'vitest';
import { buildPipelineExecutionStages } from '../../src/core/pipeline/pipelineResolver.ts';
import { createPpic4StagePreset } from '../../src/io/templates/sampleDatasets.ts';
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
