import type {
  ForecastingInput,
  ModuleExecutionResult,
  MpsInput,
  MrpInput,
  SchedulingInput,
} from '../core/types/module.types.ts';
import type { ModuleJob } from '../core/types/workspace.types.ts';
import { solveForecasting } from './forecasting.ts';
import { solveMps } from './mps.ts';
import { solveMrp } from './mrp.ts';
import { solveScheduling } from './scheduling.ts';

export function solveModuleJob(job: ModuleJob): ModuleExecutionResult {
  switch (job.moduleId) {
    case 'forecasting':
      return solveForecasting(job.id, job.title, job.input as ForecastingInput);
    case 'mps':
      return solveMps(job.id, job.title, job.input as MpsInput);
    case 'mrp':
      return solveMrp(job.id, job.title, job.input as MrpInput);
    case 'scheduling':
      return solveScheduling(job.id, job.title, job.input as SchedulingInput);
  }
}
