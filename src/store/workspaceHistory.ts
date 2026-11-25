import type { ModuleExecutionResult } from '../core/types/module.types.ts';
import type {
  ModuleJob,
  PipelineLink,
  ScenarioSnapshot,
} from '../core/types/workspace.types.ts';

export const MAX_HISTORY_STEPS = 30;
export const MAX_SCENARIO_SNAPSHOTS = 5;

export interface WorkspaceHistoryEntry {
  jobs: ModuleJob[];
  links: PipelineLink[];
  activeJobId: string | null;
}

export function pushHistoryEntry(
  past: WorkspaceHistoryEntry[],
  entry: WorkspaceHistoryEntry,
): WorkspaceHistoryEntry[] {
  const cloned: WorkspaceHistoryEntry = {
    jobs: structuredClone(entry.jobs),
    links: structuredClone(entry.links),
    activeJobId: entry.activeJobId,
  };
  const next = [...past, cloned];
  return next.length > MAX_HISTORY_STEPS ? next.slice(next.length - MAX_HISTORY_STEPS) : next;
}

export function appendScenarioSnapshot(
  existing: ScenarioSnapshot[],
  label: string,
  resultsByJobId: Record<string, ModuleExecutionResult>,
): ScenarioSnapshot[] {
  const cleanLabel = label.trim() || `Skenario #${existing.length + 1}`;
  const snap: ScenarioSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: cleanLabel,
    createdAt: Date.now(),
    resultsByJobId: structuredClone(resultsByJobId),
  };
  const next = [...existing, snap];
  return next.length > MAX_SCENARIO_SNAPSHOTS
    ? next.slice(next.length - MAX_SCENARIO_SNAPSHOTS)
    : next;
}
