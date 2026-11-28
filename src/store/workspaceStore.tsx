import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { ensureDownstreamChainFromJob } from '../core/pipeline/pipelineResolver.ts';
import { MODULE_MAP } from '../core/registry/moduleRegistry.ts';
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
import { mapGridToModuleInput } from '../io/parsers/moduleMapper.ts';
import {
  createIndependent4ModulesPack,
  createJobForModule,
  createPpic4StagePreset,
} from '../io/templates/sampleDatasets.ts';
import { runAllModulesSimultaneously } from '../workers/workerPool.ts';
import {
  WorkspaceContext,
  type ActiveViewMode,
  type PrintReportMode,
  type WorkspaceContextValue,
  type WorkspaceState,
} from './workspaceContext.ts';
import {
  appendScenarioSnapshot,
  pushHistoryEntry,
  type WorkspaceHistoryEntry,
} from './workspaceHistory.ts';

const PROJECTS_STORAGE_KEY = 'ha_jodeya_projects_v1';
const THEME_STORAGE_KEY = 'ha_jodeya_theme_v1';
const EXP_MODE_STORAGE_KEY = 'ha_jodeya_exp_mode_v1';

interface StoredProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  jobs: ModuleJob[];
  links: PipelineLink[];
}

interface StoredProjectsBundle {
  activeProjectId: string;
  projects: StoredProjectRecord[];
}

function readTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage error
  }
  return 'light';
}

function readExplanationMode(): ExplanationMode {
  try {
    const saved = localStorage.getItem(EXP_MODE_STORAGE_KEY);
    if (saved === 'compact' || saved === 'complete') return saved;
  } catch {
    // Ignore storage error
  }
  return 'complete';
}

function toProjectMeta(rec: StoredProjectRecord): SavedProjectMeta {
  return {
    id: rec.id,
    name: rec.name,
    updatedAt: rec.updatedAt,
    jobCount: rec.jobs.length,
    linkCount: rec.links.length,
  };
}

function readProjectsBundle(): StoredProjectsBundle | null {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProjectsBundle>;
    if (!Array.isArray(parsed.projects) || parsed.projects.length === 0) return null;
    const valid = parsed.projects.filter(
      (p): p is StoredProjectRecord =>
        Boolean(
          p &&
            typeof p.id === 'string' &&
            typeof p.name === 'string' &&
            Array.isArray(p.jobs),
        ),
    );
    if (valid.length === 0) return null;
    const activeId =
      typeof parsed.activeProjectId === 'string' &&
      valid.some((p) => p.id === parsed.activeProjectId)
        ? parsed.activeProjectId
        : valid[0].id;
    return { activeProjectId: activeId, projects: valid };
  } catch {
    return null;
  }
}

function writeProjectsBundle(bundle: StoredProjectsBundle): string | null {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(bundle));
    return null;
  } catch {
    return 'Penyimpanan lokal browser (localStorage) penuh atau dibatasi. Simpan pekerjaan Anda via tombol ".json" agar aman.';
  }
}

type Action =
  | { type: 'SET_VIEW'; view: ActiveViewMode }
  | { type: 'SET_EXP_MODE'; mode: ExplanationMode }
  | { type: 'SELECT_JOB'; jobId: string; openEditor?: boolean }
  | { type: 'ADD_JOB'; job: ModuleJob }
  | { type: 'ADD_MANY_JOBS'; jobs: ModuleJob[]; links?: PipelineLink[]; replace?: boolean }
  | { type: 'UPDATE_JOB_INPUT'; jobId: string; input: ModuleInputData }
  | {
      type: 'UPDATE_JOB_META';
      jobId: string;
      patch: Partial<Pick<ModuleJob, 'title' | 'enabled'>>;
    }
  | { type: 'REMOVE_JOB'; jobId: string }
  | { type: 'ADD_LINK'; link: PipelineLink }
  | { type: 'REMOVE_LINK'; linkId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_SNAPSHOT'; snapshot: ScenarioSnapshot }
  | { type: 'REMOVE_SNAPSHOT'; snapshotId: string }
  | { type: 'CLEAR_SNAPSHOT' }
  | {
      type: 'LOAD_PROJECT';
      projectId: string;
      projectName: string;
      projects: SavedProjectMeta[];
      jobs: ModuleJob[];
      links: PipelineLink[];
    }
  | { type: 'SYNC_PROJECTS_META'; projects: SavedProjectMeta[]; activeProjectName?: string }
  | { type: 'SET_PENDING_CANDIDATES'; candidates: DetectedSheetCandidate[] }
  | { type: 'UPDATE_CANDIDATE'; id: string; patch: Partial<DetectedSheetCandidate> }
  | { type: 'CLEAR_CANDIDATES' }
  | { type: 'RUN_START'; total: number }
  | { type: 'RUN_PROGRESS'; completed: number; total: number }
  | { type: 'RUN_COMPLETE'; summary: BatchRunSummary; switchToDashboard?: boolean }
  | {
      type: 'APPLY_CASCADE';
      jobs: ModuleJob[];
      links: PipelineLink[];
      summary: BatchRunSummary;
      nextJobId: string | null;
      openEditor: boolean;
    }
  | { type: 'TOGGLE_ARCH_MODAL'; open: boolean }
  | { type: 'SET_COMMAND_PALETTE'; open: boolean }
  | { type: 'SET_SIDEBAR_OPEN'; open: boolean }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_PRINT_MODE'; mode: PrintReportMode }
  | { type: 'SET_STORAGE_WARNING'; warning: string | null };

function loadInitialState(): WorkspaceState {
  const theme = readTheme();
  const explanationMode = readExplanationMode();
  const bundle = readProjectsBundle();

  if (bundle) {
    const active =
      bundle.projects.find((p) => p.id === bundle.activeProjectId) ?? bundle.projects[0];
    return {
      activeProjectId: active.id,
      activeProjectName: active.name,
      projects: bundle.projects.map(toProjectMeta),
      jobs: active.jobs,
      links: Array.isArray(active.links) ? active.links : [],
      activeJobId: active.jobs[0]?.id ?? null,
      activeView: 'batch-results',
      explanationMode,
      isRunning: false,
      progress: null,
      batchSummary: null,
      scenarioSnapshots: [],
      pendingCandidates: [],
      showArchitectureModal: false,
      showCommandPalette: false,
      sidebarOpen: false,
      theme,
      printMode: 'current',
      storageWarning: null,
      past: [],
      future: [],
    };
  }

  const preset = createPpic4StagePreset();
  const initialRec: StoredProjectRecord = {
    id: 'proj-default-ppic',
    name: 'Rantai Produksi Pompa HX-200 (4-Tahap)',
    updatedAt: Date.now(),
    jobs: preset.jobs,
    links: preset.links,
  };
  writeProjectsBundle({ activeProjectId: initialRec.id, projects: [initialRec] });

  return {
    activeProjectId: initialRec.id,
    activeProjectName: initialRec.name,
    projects: [toProjectMeta(initialRec)],
    jobs: preset.jobs,
    links: preset.links,
    activeJobId: preset.jobs[0]?.id ?? null,
    activeView: 'batch-results',
    explanationMode,
    isRunning: false,
    progress: null,
    batchSummary: null,
    scenarioSnapshots: [],
    pendingCandidates: [],
    showArchitectureModal: false,
    showCommandPalette: false,
    sidebarOpen: false,
    theme,
    printMode: 'current',
    storageWarning: null,
    past: [],
    future: [],
  };
}

function withHistory(state: WorkspaceState): Pick<WorkspaceState, 'past' | 'future'> {
  return {
    past: pushHistoryEntry(state.past, {
      jobs: state.jobs,
      links: state.links,
      activeJobId: state.activeJobId,
    }),
    future: [],
  };
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, activeView: action.view, sidebarOpen: false };

    case 'SET_EXP_MODE':
      return { ...state, explanationMode: action.mode };

    case 'SELECT_JOB':
      return {
        ...state,
        activeJobId: action.jobId,
        activeView: action.openEditor ? 'module-editor' : state.activeView,
        sidebarOpen: false,
      };

    case 'ADD_JOB':
      return {
        ...state,
        ...withHistory(state),
        jobs: [...state.jobs, action.job],
        activeJobId: action.job.id,
        activeView: 'module-editor',
        sidebarOpen: false,
      };

    case 'ADD_MANY_JOBS': {
      const nextJobs = action.replace ? action.jobs : [...state.jobs, ...action.jobs];
      const nextLinks = action.replace
        ? (action.links ?? [])
        : [...state.links, ...(action.links ?? [])];
      return {
        ...state,
        ...withHistory(state),
        jobs: nextJobs,
        links: nextLinks,
        activeJobId: action.jobs[0]?.id ?? nextJobs[0]?.id ?? null,
        pendingCandidates: [],
      };
    }

    case 'UPDATE_JOB_INPUT':
      return {
        ...state,
        ...withHistory(state),
        jobs: state.jobs.map((j) =>
          j.id === action.jobId ? { ...j, input: action.input } : j,
        ),
      };

    case 'UPDATE_JOB_META':
      return {
        ...state,
        ...withHistory(state),
        jobs: state.jobs.map((j) =>
          j.id === action.jobId ? { ...j, ...action.patch } : j,
        ),
      };

    case 'REMOVE_JOB': {
      const nextJobs = state.jobs.filter((j) => j.id !== action.jobId);
      const nextLinks = state.links.filter(
        (l) => l.sourceJobId !== action.jobId && l.targetJobId !== action.jobId,
      );
      const nextActive =
        state.activeJobId === action.jobId ? (nextJobs[0]?.id ?? null) : state.activeJobId;
      return {
        ...state,
        ...withHistory(state),
        jobs: nextJobs,
        links: nextLinks,
        activeJobId: nextActive,
      };
    }

    case 'ADD_LINK':
      return {
        ...state,
        ...withHistory(state),
        links: [...state.links, action.link],
      };

    case 'REMOVE_LINK':
      return {
        ...state,
        ...withHistory(state),
        links: state.links.filter((l) => l.id !== action.linkId),
      };

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const currentSnapshot: WorkspaceHistoryEntry = {
        jobs: structuredClone(state.jobs),
        links: structuredClone(state.links),
        activeJobId: state.activeJobId,
      };
      return {
        ...state,
        jobs: previous.jobs,
        links: previous.links,
        activeJobId: previous.activeJobId,
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future].slice(0, 30),
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const currentSnapshot: WorkspaceHistoryEntry = {
        jobs: structuredClone(state.jobs),
        links: structuredClone(state.links),
        activeJobId: state.activeJobId,
      };
      return {
        ...state,
        jobs: next.jobs,
        links: next.links,
        activeJobId: next.activeJobId,
        past: [...state.past, currentSnapshot].slice(-30),
        future: state.future.slice(1),
      };
    }

    case 'SAVE_SNAPSHOT':
      return {
        ...state,
        scenarioSnapshots: [
          ...state.scenarioSnapshots.slice(-4),
          action.snapshot,
        ],
      };

    case 'REMOVE_SNAPSHOT':
      return {
        ...state,
        scenarioSnapshots: state.scenarioSnapshots.filter((s) => s.id !== action.snapshotId),
      };

    case 'CLEAR_SNAPSHOT':
      return { ...state, scenarioSnapshots: [] };

    case 'LOAD_PROJECT':
      return {
        ...state,
        activeProjectId: action.projectId,
        activeProjectName: action.projectName,
        projects: action.projects,
        jobs: action.jobs,
        links: action.links,
        activeJobId: action.jobs[0]?.id ?? null,
        batchSummary: null,
        scenarioSnapshots: [],
        past: [],
        future: [],
      };

    case 'SYNC_PROJECTS_META':
      return {
        ...state,
        projects: action.projects,
        activeProjectName: action.activeProjectName ?? state.activeProjectName,
      };

    case 'SET_PENDING_CANDIDATES':
      return { ...state, pendingCandidates: action.candidates };

    case 'UPDATE_CANDIDATE':
      return {
        ...state,
        pendingCandidates: state.pendingCandidates.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };

    case 'CLEAR_CANDIDATES':
      return { ...state, pendingCandidates: [] };

    case 'RUN_START':
      return {
        ...state,
        isRunning: true,
        progress: { completed: 0, total: action.total },
      };

    case 'RUN_PROGRESS':
      return {
        ...state,
        progress: { completed: action.completed, total: action.total },
      };

    case 'RUN_COMPLETE': {
      const effectiveMap = action.summary.effectiveInputsByJobId;
      let nextJobs = state.jobs;
      if (effectiveMap && Object.keys(effectiveMap).length > 0) {
        let changed = false;
        const mapped = state.jobs.map((j) => {
          const eff = effectiveMap[j.id];
          if (!eff) return j;
          if (JSON.stringify(j.input) === JSON.stringify(eff)) return j;
          changed = true;
          return { ...j, input: eff };
        });
        if (changed) nextJobs = mapped;
      }
      return {
        ...state,
        jobs: nextJobs,
        isRunning: false,
        progress: null,
        batchSummary: action.summary,
        activeView: action.switchToDashboard ? 'batch-results' : state.activeView,
      };
    }

    case 'APPLY_CASCADE':
      return {
        ...state,
        ...withHistory(state),
        jobs: action.jobs,
        links: action.links,
        isRunning: false,
        progress: null,
        batchSummary: action.summary,
        activeJobId: action.nextJobId ?? state.activeJobId,
        activeView: action.openEditor ? 'module-editor' : state.activeView,
        sidebarOpen: false,
      };

    case 'TOGGLE_ARCH_MODAL':
      return { ...state, showArchitectureModal: action.open };

    case 'SET_COMMAND_PALETTE':
      return { ...state, showCommandPalette: action.open };

    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.open };

    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'SET_PRINT_MODE':
      return { ...state, printMode: action.mode };

    case 'SET_STORAGE_WARNING':
      return { ...state, storageWarning: action.warning };
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const didInitialAutoRun = useRef(false);
  const skipNextAutoRunRef = useRef(false);

  // Sync theme attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      // Ignore storage error
    }
  }, [state.theme]);

  // Persist active project jobs & links to localStorage
  useEffect(() => {
    const bundle = readProjectsBundle();
    const existingProjects = bundle ? bundle.projects : [];
    const idx = existingProjects.findIndex((p) => p.id === state.activeProjectId);
    const updatedRec: StoredProjectRecord = {
      id: state.activeProjectId,
      name: state.activeProjectName,
      updatedAt: Date.now(),
      jobs: state.jobs,
      links: state.links,
    };

    const nextProjects =
      idx >= 0
        ? existingProjects.map((p, i) => (i === idx ? updatedRec : p))
        : [...existingProjects, updatedRec];

    const warn = writeProjectsBundle({
      activeProjectId: state.activeProjectId,
      projects: nextProjects,
    });
    if (warn) {
      dispatch({ type: 'SET_STORAGE_WARNING', warning: warn });
    }
    dispatch({
      type: 'SYNC_PROJECTS_META',
      projects: nextProjects.map(toProjectMeta),
    });
  }, [state.activeProjectId, state.activeProjectName, state.jobs, state.links]);

  const executeBatch = useCallback(
    async (jobs: ModuleJob[], links: PipelineLink[], switchToDashboard = false) => {
      const enabled = jobs.filter((j) => j.enabled);
      if (enabled.length === 0) return;
      dispatch({ type: 'RUN_START', total: enabled.length });
      const summary = await runAllModulesSimultaneously(jobs, links, (prog) => {
        dispatch({
          type: 'RUN_PROGRESS',
          completed: prog.completed,
          total: prog.total,
        });
      });

      const effectiveMap = summary.effectiveInputsByJobId;
      if (
        effectiveMap &&
        jobs.some(
          (j) =>
            effectiveMap[j.id] &&
            JSON.stringify(j.input) !== JSON.stringify(effectiveMap[j.id]),
        )
      ) {
        skipNextAutoRunRef.current = true;
      }

      dispatch({ type: 'RUN_COMPLETE', summary, switchToDashboard });
    },
    [],
  );

  // Auto-run active modules once on initial load so KPIs & 6-Pillar explanations are immediately live
  useEffect(() => {
    if (didInitialAutoRun.current) return;
    didInitialAutoRun.current = true;
    if (state.jobs.some((j) => j.enabled)) {
      void executeBatch(state.jobs, state.links, false);
    }
  }, [executeBatch, state.jobs, state.links]);

  // Debounced live re-calculation when editing inputs/links so upstream -> downstream stays fresh
  useEffect(() => {
    if (!didInitialAutoRun.current) return;
    if (skipNextAutoRunRef.current) {
      skipNextAutoRunRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (state.jobs.some((j) => j.enabled)) {
        void executeBatch(state.jobs, state.links, false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [executeBatch, state.jobs, state.links]);

  const runAll = useCallback(
    async (switchToDashboard = false) => {
      await executeBatch(state.jobs, state.links, switchToDashboard);
    },
    [executeBatch, state.jobs, state.links],
  );

  const cascadeFromJob = useCallback(
    async (sourceJobId: string, openNextStage = true) => {
      const chain = ensureDownstreamChainFromJob(
        state.jobs,
        state.links,
        sourceJobId,
        createJobForModule,
      );
      const enabled = chain.jobs.filter((j) => j.enabled);
      if (enabled.length === 0) return;

      dispatch({ type: 'RUN_START', total: enabled.length });
      const summary = await runAllModulesSimultaneously(chain.jobs, chain.links, (prog) => {
        dispatch({
          type: 'RUN_PROGRESS',
          completed: prog.completed,
          total: prog.total,
        });
      });

      const effectiveMap = summary.effectiveInputsByJobId ?? {};
      const materializedJobs = chain.jobs.map((j) =>
        effectiveMap[j.id] ? { ...j, input: effectiveMap[j.id] } : j,
      );

      skipNextAutoRunRef.current = true;
      dispatch({
        type: 'APPLY_CASCADE',
        jobs: materializedJobs,
        links: chain.links,
        summary,
        nextJobId: chain.nextStageJobId,
        openEditor: openNextStage,
      });
    },
    [state.jobs, state.links],
  );

  const setView = useCallback((view: ActiveViewMode) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  const setExplanationMode = useCallback((mode: ExplanationMode) => {
    dispatch({ type: 'SET_EXP_MODE', mode });
    try {
      localStorage.setItem(EXP_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage error
    }
  }, []);

  const selectJob = useCallback((jobId: string, openEditor = true) => {
    dispatch({ type: 'SELECT_JOB', jobId, openEditor });
  }, []);

  const addModuleJob = useCallback((moduleId: ModuleId) => {
    const job = createJobForModule(moduleId);
    dispatch({ type: 'ADD_JOB', job });
  }, []);

  const duplicateJob = useCallback(
    (jobId: string) => {
      const target = state.jobs.find((j) => j.id === jobId);
      if (!target) return;
      const copy: ModuleJob = {
        id: `job-${target.moduleId}-${Math.random().toString(36).slice(2, 7)}`,
        moduleId: target.moduleId,
        title: `${target.title} (Salinan)`,
        enabled: true,
        input: structuredClone(target.input),
      };
      dispatch({ type: 'ADD_JOB', job: copy });
    },
    [state.jobs],
  );

  const addManyJobs = useCallback(
    (jobs: ModuleJob[], links?: PipelineLink[], replace = false) => {
      dispatch({ type: 'ADD_MANY_JOBS', jobs, links, replace });
    },
    [],
  );

  const updateJobInput = useCallback((jobId: string, input: ModuleInputData) => {
    dispatch({ type: 'UPDATE_JOB_INPUT', jobId, input });
  }, []);

  const updateJobMeta = useCallback(
    (jobId: string, patch: Partial<Pick<ModuleJob, 'title' | 'enabled'>>) => {
      dispatch({ type: 'UPDATE_JOB_META', jobId, patch });
    },
    [],
  );

  const removeJob = useCallback((jobId: string) => {
    dispatch({ type: 'REMOVE_JOB', jobId });
  }, []);

  const addLink = useCallback((link: Omit<PipelineLink, 'id'>) => {
    dispatch({
      type: 'ADD_LINK',
      link: {
        ...link,
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    });
  }, []);

  const removeLink = useCallback((linkId: string) => {
    dispatch({ type: 'REMOVE_LINK', linkId });
  }, []);

  const loadPpic4StagePreset = useCallback(
    (autoRun = true) => {
      const preset = createPpic4StagePreset();
      dispatch({
        type: 'ADD_MANY_JOBS',
        jobs: preset.jobs,
        links: preset.links,
        replace: true,
      });
      if (autoRun) {
        void executeBatch(preset.jobs, preset.links, true);
      }
    },
    [executeBatch],
  );

  const loadIndependent4Modules = useCallback(
    (autoRun = true) => {
      const pack = createIndependent4ModulesPack();
      dispatch({
        type: 'ADD_MANY_JOBS',
        jobs: pack.jobs,
        links: pack.links,
        replace: true,
      });
      if (autoRun) {
        void executeBatch(pack.jobs, pack.links, true);
      }
    },
    [executeBatch],
  );

  const clearWorkspace = useCallback(() => {
    dispatch({ type: 'ADD_MANY_JOBS', jobs: [], links: [], replace: true });
  }, []);

  const createProject = useCallback(
    (name: string, preset: 'ppic4' | 'independent4' | 'empty') => {
      const pack =
        preset === 'ppic4'
          ? createPpic4StagePreset()
          : preset === 'independent4'
            ? createIndependent4ModulesPack()
            : { jobs: [], links: [] };
      const newRec: StoredProjectRecord = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || `Proyek PPIC #${state.projects.length + 1}`,
        updatedAt: Date.now(),
        jobs: pack.jobs,
        links: pack.links,
      };
      const bundle = readProjectsBundle();
      const nextProjects = [...(bundle?.projects ?? []), newRec];
      writeProjectsBundle({ activeProjectId: newRec.id, projects: nextProjects });
      dispatch({
        type: 'LOAD_PROJECT',
        projectId: newRec.id,
        projectName: newRec.name,
        projects: nextProjects.map(toProjectMeta),
        jobs: newRec.jobs,
        links: newRec.links,
      });
      if (newRec.jobs.length > 0) {
        void executeBatch(newRec.jobs, newRec.links, true);
      }
    },
    [executeBatch, state.projects.length],
  );

  const switchProject = useCallback(
    (projectId: string) => {
      const bundle = readProjectsBundle();
      if (!bundle) return;
      const target = bundle.projects.find((p) => p.id === projectId);
      if (!target) return;
      writeProjectsBundle({ activeProjectId: target.id, projects: bundle.projects });
      dispatch({
        type: 'LOAD_PROJECT',
        projectId: target.id,
        projectName: target.name,
        projects: bundle.projects.map(toProjectMeta),
        jobs: target.jobs,
        links: target.links,
      });
      if (target.jobs.length > 0) {
        void executeBatch(target.jobs, target.links, false);
      }
    },
    [executeBatch],
  );

  const renameProject = useCallback((projectId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    const bundle = readProjectsBundle();
    if (!bundle) return;
    const nextProjects = bundle.projects.map((p) =>
      p.id === projectId ? { ...p, name: clean, updatedAt: Date.now() } : p,
    );
    writeProjectsBundle({ activeProjectId: bundle.activeProjectId, projects: nextProjects });
    dispatch({
      type: 'SYNC_PROJECTS_META',
      projects: nextProjects.map(toProjectMeta),
      activeProjectName: projectId === bundle.activeProjectId ? clean : undefined,
    });
  }, []);

  const deleteProject = useCallback(
    (projectId: string) => {
      const bundle = readProjectsBundle();
      if (!bundle || bundle.projects.length <= 1) return;
      const remaining = bundle.projects.filter((p) => p.id !== projectId);
      const nextActive = remaining[0];
      writeProjectsBundle({ activeProjectId: nextActive.id, projects: remaining });
      dispatch({
        type: 'LOAD_PROJECT',
        projectId: nextActive.id,
        projectName: nextActive.name,
        projects: remaining.map(toProjectMeta),
        jobs: nextActive.jobs,
        links: nextActive.links,
      });
      if (nextActive.jobs.length > 0) {
        void executeBatch(nextActive.jobs, nextActive.links, false);
      }
    },
    [executeBatch],
  );

  const setPendingCandidates = useCallback((candidates: DetectedSheetCandidate[]) => {
    dispatch({ type: 'SET_PENDING_CANDIDATES', candidates });
  }, []);

  const updateCandidate = useCallback(
    (id: string, patch: Partial<DetectedSheetCandidate>) => {
      dispatch({ type: 'UPDATE_CANDIDATE', id, patch });
    },
    [],
  );

  const commitPendingCandidates = useCallback(
    (autoRun = true) => {
      const selected = state.pendingCandidates.filter((c) => c.selected);
      if (selected.length === 0) return;

      const createdJobs: ModuleJob[] = selected.map((cand) => {
        const meta = MODULE_MAP[cand.detectedModuleId];
        const mapped = mapGridToModuleInput(
          cand.detectedModuleId,
          cand.rawRows,
          cand.headerRowIndex,
          cand.columnMapping,
        );
        return {
          id: `job-${cand.detectedModuleId}-${Math.random().toString(36).slice(2, 7)}`,
          moduleId: cand.detectedModuleId,
          title: `${meta.stageNumber} · ${cand.sheetName}`,
          enabled: true,
          input: mapped,
        };
      });

      const mergedJobs = [...state.jobs, ...createdJobs];
      dispatch({ type: 'ADD_MANY_JOBS', jobs: createdJobs, replace: false });
      if (autoRun) {
        void executeBatch(mergedJobs, state.links, true);
      }
    },
    [executeBatch, state.jobs, state.links, state.pendingCandidates],
  );

  const clearCandidates = useCallback(() => {
    dispatch({ type: 'CLEAR_CANDIDATES' });
  }, []);

  const saveScenarioSnapshot = useCallback(
    (label = '') => {
      if (!state.batchSummary) return;
      const updated = appendScenarioSnapshot(
        state.scenarioSnapshots,
        label,
        state.batchSummary.resultsByJobId,
      );
      dispatch({
        type: 'SAVE_SNAPSHOT',
        snapshot: updated[updated.length - 1],
      });
    },
    [state.batchSummary, state.scenarioSnapshots],
  );

  const removeScenarioSnapshot = useCallback((snapshotId: string) => {
    dispatch({ type: 'REMOVE_SNAPSHOT', snapshotId });
  }, []);

  const clearScenarioSnapshot = useCallback(() => {
    dispatch({ type: 'CLEAR_SNAPSHOT' });
  }, []);

  const triggerFullPdfReport = useCallback(() => {
    dispatch({ type: 'SET_PRINT_MODE', mode: 'full' });
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        dispatch({ type: 'SET_PRINT_MODE', mode: 'current' });
      }, 450);
    }, 120);
  }, []);

  const value: WorkspaceContextValue = {
    state,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo: () => dispatch({ type: 'UNDO' }),
    redo: () => dispatch({ type: 'REDO' }),
    setView,
    setExplanationMode,
    selectJob,
    addModuleJob,
    duplicateJob,
    addManyJobs,
    updateJobInput,
    updateJobMeta,
    removeJob,
    addLink,
    removeLink,
    loadPpic4StagePreset,
    loadIndependent4Modules,
    clearWorkspace,
    createProject,
    switchProject,
    renameProject,
    deleteProject,
    setPendingCandidates,
    updateCandidate,
    commitPendingCandidates,
    clearCandidates,
    runAll,
    cascadeFromJob,
    saveScenarioSnapshot,
    removeScenarioSnapshot,
    clearScenarioSnapshot,
    toggleArchModal: (open) => dispatch({ type: 'TOGGLE_ARCH_MODAL', open }),
    setShowCommandPalette: (open) => dispatch({ type: 'SET_COMMAND_PALETTE', open }),
    setSidebarOpen: (open) => dispatch({ type: 'SET_SIDEBAR_OPEN', open }),
    toggleTheme: () =>
      dispatch({
        type: 'SET_THEME',
        theme: state.theme === 'dark' ? 'light' : 'dark',
      }),
    triggerFullPdfReport,
    dismissStorageWarning: () => dispatch({ type: 'SET_STORAGE_WARNING', warning: null }),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
