import { createContext, useContext } from 'react';
import type { ModuleId, ModuleInputData } from '../core/types/module.types.ts';
import type {
  BatchRunSummary,
  DetectedSheetCandidate,
  ExplanationMode,
  ModuleJob,
  PipelineLink,
  SavedProjectMeta,
  ScenarioSnapshot,
  ThemeMode,
} from '../core/types/workspace.types.ts';
import type { WorkspaceHistoryEntry } from './workspaceHistory.ts';

export type ActiveViewMode = 'batch-results' | 'module-editor' | 'pipeline' | 'file-upload';
export type PrintReportMode = 'current' | 'full';

export interface WorkspaceState {
  activeProjectId: string;
  activeProjectName: string;
  projects: SavedProjectMeta[];
  jobs: ModuleJob[];
  links: PipelineLink[];
  activeJobId: string | null;
  activeView: ActiveViewMode;
  explanationMode: ExplanationMode;
  isRunning: boolean;
  progress: { completed: number; total: number } | null;
  batchSummary: BatchRunSummary | null;
  scenarioSnapshots: ScenarioSnapshot[];
  pendingCandidates: DetectedSheetCandidate[];
  showArchitectureModal: boolean;
  showCommandPalette: boolean;
  sidebarOpen: boolean;
  theme: ThemeMode;
  printMode: PrintReportMode;
  storageWarning: string | null;
  past: WorkspaceHistoryEntry[];
  future: WorkspaceHistoryEntry[];
}

export interface WorkspaceContextValue {
  state: WorkspaceState;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  setView: (view: ActiveViewMode) => void;
  setExplanationMode: (mode: ExplanationMode) => void;
  selectJob: (jobId: string, openEditor?: boolean) => void;
  addModuleJob: (moduleId: ModuleId) => void;
  duplicateJob: (jobId: string) => void;
  addManyJobs: (jobs: ModuleJob[], links?: PipelineLink[], replace?: boolean) => void;
  updateJobInput: (jobId: string, input: ModuleInputData) => void;
  updateJobMeta: (
    jobId: string,
    patch: Partial<Pick<ModuleJob, 'title' | 'enabled'>>,
  ) => void;
  removeJob: (jobId: string) => void;
  addLink: (link: Omit<PipelineLink, 'id'>) => void;
  removeLink: (linkId: string) => void;
  loadPpic4StagePreset: (autoRun?: boolean) => void;
  loadIndependent4Modules: (autoRun?: boolean) => void;
  clearWorkspace: () => void;
  createProject: (name: string, preset: 'ppic4' | 'independent4' | 'empty') => void;
  switchProject: (projectId: string) => void;
  renameProject: (projectId: string, newName: string) => void;
  deleteProject: (projectId: string) => void;
  setPendingCandidates: (candidates: DetectedSheetCandidate[]) => void;
  updateCandidate: (id: string, patch: Partial<DetectedSheetCandidate>) => void;
  commitPendingCandidates: (autoRun?: boolean) => void;
  clearCandidates: () => void;
  runAll: (switchToDashboard?: boolean) => Promise<void>;
  saveScenarioSnapshot: (label?: string) => void;
  removeScenarioSnapshot: (snapshotId: string) => void;
  clearScenarioSnapshot: () => void;
  toggleArchModal: (open: boolean) => void;
  setShowCommandPalette: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  triggerFullPdfReport: () => void;
  dismissStorageWarning: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace harus dipanggil di dalam WorkspaceProvider.');
  }
  return ctx;
}
