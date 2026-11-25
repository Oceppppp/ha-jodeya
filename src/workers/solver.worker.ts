import type { ModuleJob } from '../core/types/workspace.types.ts';
import { solveModuleJob } from '../engines/index.ts';

self.onmessage = (event: MessageEvent<{ requestId: string; job: ModuleJob }>) => {
  const { requestId, job } = event.data;
  const result = solveModuleJob(job);
  self.postMessage({ requestId, result });
};
