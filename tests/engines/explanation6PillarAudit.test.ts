import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULE_REGISTRY } from '../../src/core/registry/moduleRegistry.ts';
import type { SchedulingInput } from '../../src/core/types/module.types.ts';
import { solveModuleJob } from '../../src/engines/index.ts';
import { formatModuleResultCsv } from '../../src/io/exporters/csvExporter.ts';
import { buildBatchReportWorkbookRows } from '../../src/io/exporters/excelExporter.ts';
import { formatExplanationMarkdown } from '../../src/io/exporters/explanationExporter.ts';
import { createJobForModule, createPpic4StagePreset } from '../../src/io/templates/sampleDatasets.ts';
import { runAllModulesSimultaneously } from '../../src/workers/workerPool.ts';

describe('100% 6-Pillar Causal Explanation Audit & Clean Layer Boundaries', () => {
  it('verifies every module and mode generates complete 6-Pillar explanations with zero NaN or undefined', () => {
    const jobs = MODULE_REGISTRY.map((m) => createJobForModule(m.id));

    // Also include Johnson 2-Machine mode
    const johnsonJob = createJobForModule('scheduling', '04 · Johnson 2-Mesin');
    (johnsonJob.input as SchedulingInput).mode = 'johnson_two_machine';
    jobs.push(johnsonJob);

    for (const job of jobs) {
      const res = solveModuleJob(job);
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('NaN');
      expect(serialized).not.toContain('undefined');

      // Verify all 6 Pillars
      const exp = res.explanation;
      expect(exp.keyDecision.trim().length).toBeGreaterThan(15);
      expect(exp.plainSummary.trim().length).toBeGreaterThan(30);
      expect(exp.metricBreakdown.length).toBeGreaterThanOrEqual(3);
      expect(exp.workedSteps.length).toBeGreaterThanOrEqual(2);
      expect(exp.whyOptimal.length).toBeGreaterThanOrEqual(2);
      expect(exp.risksAndNotes.length).toBeGreaterThanOrEqual(1);
      expect(exp.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(exp.glossary.length).toBeGreaterThanOrEqual(4);

      // Verify Markdown & CSV export contain causal reasoning and zero NaN
      const md = formatExplanationMarkdown(res);
      expect(md).toContain('## 4. Mengapa Jawaban Ini yang Keluar / Optimal?');
      expect(md).not.toContain('NaN');

      const csv = formatModuleResultCsv(job, res);
      expect(csv).toContain('Alasan Jawaban #1');
      expect(csv).not.toContain('NaN');
    }
  });

  it('builds multi-sheet Excel report rows containing 6-Pillar explanations for the 4-Stage batch', async () => {
    const preset = createPpic4StagePreset();
    const summary = await runAllModulesSimultaneously(preset.jobs, preset.links);
    const sheets = buildBatchReportWorkbookRows(preset.jobs, summary);

    expect(sheets.length).toBe(5); // 1 Executive Summary + 4 Stage sheets
    const serialized = JSON.stringify(sheets);
    expect(serialized).toContain('Pilar 4 · Mengapa Jawaban Ini Keluar / Optimal?');
    expect(serialized).not.toContain('NaN');
  });

  it('enforces pure TypeScript boundaries (zero React or DOM imports in src/core/ and src/engines/)', () => {
    const pureDirs = [
      path.resolve(__dirname, '../../src/core'),
      path.resolve(__dirname, '../../src/engines'),
    ];

    const collectTsFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) files.push(...collectTsFiles(full));
        else if (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx')) files.push(full);
      }
      return files;
    };

    const allPureFiles = pureDirs.flatMap(collectTsFiles);
    expect(allPureFiles.length).toBeGreaterThanOrEqual(10);

    for (const file of allPureFiles) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(/from\s+['"]react['"]/);
      expect(src).not.toMatch(/document\./);
      expect(src).not.toMatch(/window\./);
    }
  });
});
