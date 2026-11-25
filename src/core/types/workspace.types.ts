import type {
  ModuleExecutionResult,
  ModuleId,
  ModuleInputData,
} from './module.types.ts';

export type ThemeMode = 'light' | 'dark';
export type ExplanationMode = 'complete' | 'compact';

export interface ModuleJob {
  id: string;
  moduleId: ModuleId;
  title: string;
  enabled: boolean;
  input: ModuleInputData;
}

export interface PipelineLink {
  id: string;
  sourceJobId: string;
  sourceOutputKey: string;
  targetJobId: string;
  targetField: string;
  multiplier: number;
}

export interface BatchRunSummary {
  runId: string;
  startedAt: number;
  finishedAt: number;
  totalDurationMs: number;
  totalJobs: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  resultsByJobId: Record<string, ModuleExecutionResult>;
}

export interface ScenarioSnapshot {
  id: string;
  label: string;
  createdAt: number;
  resultsByJobId: Record<string, ModuleExecutionResult>;
}

export interface SavedProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  jobCount: number;
  linkCount: number;
}

export interface DetectedSheetCandidate {
  id: string;
  sourceFileName: string;
  sheetName: string;
  detectedModuleId: ModuleId;
  confidence: number;
  reason: string;
  rawRows: (string | number | boolean | null)[][];
  headerRowIndex: number;
  columnMapping: Record<string, number>;
  selected: boolean;
}
