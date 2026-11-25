import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type {
  ForecastingInput,
  ModuleId,
  ModuleInputData,
  MpsInput,
  MrpInput,
  SchedulingInput,
} from '../../core/types/module.types.ts';
import type {
  DetectedSheetCandidate,
  ModuleJob,
  PipelineLink,
} from '../../core/types/workspace.types.ts';
import { DEFAULT_MODULE_INPUTS } from '../templates/sampleDatasets.ts';
import { autoSuggestColumnMapping, detectHeaderRowIndex } from './columnMapping.ts';
import { parseCsvText } from './csvParser.ts';
import { detectModuleFromGrid, type RawCell, type RawGrid } from './fileDetector.ts';
import { extractJsModuleValue } from './jsDataParser.ts';

export interface ParsedJsonImport {
  jobs: ModuleJob[];
  links: PipelineLink[];
  candidates: DetectedSheetCandidate[];
}

function normStr(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const EXTRA_ALIASES: Record<string, ModuleId> = {
  fc: 'forecasting',
  forecast: 'forecasting',
  forecasting: 'forecasting',
  peramalan: 'forecasting',
  ramalan: 'forecasting',
  mps: 'mps',
  masterproductionschedule: 'mps',
  jadwalinduk: 'mps',
  atp: 'mps',
  rccp: 'mps',
  mr: 'mrp',
  mrp: 'mrp',
  bom: 'mrp',
  materialrequirementsplanning: 'mrp',
  kebutuhanmaterial: 'mrp',
  sc: 'scheduling',
  scheduling: 'scheduling',
  schedule: 'scheduling',
  penjadwalan: 'scheduling',
  jobshop: 'scheduling',
  johnson: 'scheduling',
};

export function resolveModuleAlias(raw?: string): ModuleId | null {
  if (!raw || typeof raw !== 'string') return null;
  if (raw in MODULE_MAP) return raw as ModuleId;
  const normalized = normStr(raw);
  if (!normalized) return null;
  if (normalized in EXTRA_ALIASES) return EXTRA_ALIASES[normalized];

  for (const mod of MODULE_REGISTRY) {
    if (normStr(mod.id) === normalized) return mod.id;
    if (normStr(mod.code) === normalized) return mod.id;
    if (normStr(mod.name) === normalized) return mod.id;
    if (normStr(mod.indonesianName) === normalized) return mod.id;
  }

  if (normalized.length >= 3) {
    for (const [alias, modId] of Object.entries(EXTRA_ALIASES)) {
      if (alias.length >= 3 && (normalized.includes(alias) || alias.includes(normalized))) {
        return modId;
      }
    }
  }
  return null;
}

function inferModuleFromObjectKeys(obj: Record<string, unknown>): ModuleId | null {
  if (Array.isArray(obj.values) && obj.values.every((v) => typeof v === 'number')) {
    return 'forecasting';
  }
  if (
    (Array.isArray(obj.forecasts) && Array.isArray(obj.customerOrders)) ||
    'demandTimeFence' in obj ||
    'planningTimeFence' in obj
  ) {
    return 'mps';
  }
  if (
    Array.isArray(obj.items) &&
    obj.items.some(
      (it) => it && typeof it === 'object' && ('grossRequirements' in it || 'leadTime' in it),
    )
  ) {
    return 'mrp';
  }
  if (
    Array.isArray(obj.jobs) &&
    obj.jobs.some((j) => j && typeof j === 'object' && 'processingTime' in j)
  ) {
    return 'scheduling';
  }
  return null;
}

function mergeWithDefaults(
  moduleId: ModuleId,
  rawInput: Record<string, unknown>,
): ModuleInputData {
  const base = structuredClone(DEFAULT_MODULE_INPUTS[moduleId]);
  const merged: Record<string, unknown> = {
    ...(base as unknown as Record<string, unknown>),
    ...rawInput,
    moduleId,
  };

  if (moduleId === 'forecasting') {
    const fc = merged as unknown as ForecastingInput;
    if (!Array.isArray(rawInput.weightedWeights) && Array.isArray(rawInput.weights)) {
      fc.weightedWeights = rawInput.weights as number[];
    }
    if (!Array.isArray(rawInput.periodLabels) && Array.isArray(fc.values)) {
      fc.periodLabels = fc.values.map((_, i) => `P${i + 1}`);
    }
  } else if (moduleId === 'mps') {
    const mps = merged as unknown as MpsInput;
    const T = Array.isArray(mps.forecasts) ? mps.forecasts.length : mps.periodLabels.length;
    if (!Array.isArray(rawInput.periodLabels) || mps.periodLabels.length !== T) {
      mps.periodLabels = Array.from({ length: T }, (_, i) => `Mgg ${i + 1}`);
    }
    if (!Array.isArray(mps.customerOrders) || mps.customerOrders.length !== T) {
      mps.customerOrders = Array.from({ length: T }, (_, i) => mps.customerOrders?.[i] ?? 0);
    }
    if (!Array.isArray(mps.firmMps) || mps.firmMps.length !== T) {
      mps.firmMps = Array<number | null>(T).fill(null);
    }
    if (!Array.isArray(mps.availableCapacity) || mps.availableCapacity.length !== T) {
      mps.availableCapacity = Array<number>(T).fill(160);
    }
  } else if (moduleId === 'mrp') {
    const mrp = merged as unknown as MrpInput;
    const len = mrp.periodLabels?.length ?? 6;
    if (Array.isArray(mrp.items)) {
      mrp.items = mrp.items.map((it) => ({
        ...it,
        qtyPerParent: it.qtyPerParent ?? 1,
        leadTime: it.leadTime ?? 1,
        onHand: it.onHand ?? 0,
        safetyStock: it.safetyStock ?? 0,
        lotSizing: it.lotSizing ?? 'L4L',
        grossRequirements: it.grossRequirements ?? Array<number>(len).fill(0),
        scheduledReceipts: it.scheduledReceipts ?? Array<number>(len).fill(0),
      }));
    }
  } else if (moduleId === 'scheduling') {
    const sc = merged as unknown as SchedulingInput;
    if ((sc.mode as string) === 'johnson-two-machine') sc.mode = 'johnson_two_machine';
    if ((sc.mode as string) === 'single-machine') sc.mode = 'single_machine';
  }

  return merged as unknown as ModuleInputData;
}

function createJob(
  moduleId: ModuleId,
  title: string,
  rawInput: Record<string, unknown>,
): ModuleJob {
  const meta = MODULE_MAP[moduleId];
  return {
    id: `job-${moduleId}-${Math.random().toString(36).slice(2, 8)}`,
    moduleId,
    title: title || `${meta.stageNumber} · ${meta.indonesianName}`,
    enabled: true,
    input: mergeWithDefaults(moduleId, rawInput),
  };
}

function toRawCell(v: unknown): RawCell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.join(', ');
  return JSON.stringify(v);
}

function gridToCandidate(
  fileName: string,
  sheetName: string,
  grid: RawGrid,
): DetectedSheetCandidate | null {
  const clean = grid.filter((r) => r.some((c) => c !== null && String(c).trim() !== ''));
  if (clean.length === 0) return null;
  const detection = detectModuleFromGrid(fileName, sheetName, clean);
  const headerRowIndex = detectHeaderRowIndex(clean);
  const columnMapping = autoSuggestColumnMapping(
    detection.moduleId,
    clean[headerRowIndex] ?? [],
  );
  return {
    id: `cand-${fileName}-${sheetName}-${Math.random().toString(36).slice(2, 7)}`,
    sourceFileName: fileName,
    sheetName,
    detectedModuleId: detection.moduleId,
    confidence: detection.confidence,
    reason: `${detection.reason} (JS/JSON Data)`,
    rawRows: clean,
    headerRowIndex,
    columnMapping,
    selected: true,
  };
}

function collectFromValue(
  value: unknown,
  fileName: string,
  labelHint: string,
  out: ParsedJsonImport,
  depth = 0,
): void {
  if (value === null || value === undefined || depth > 5) return;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const inner = JSON.parse(trimmed) as unknown;
        collectFromValue(inner, fileName, labelHint, out, depth + 1);
        return;
      } catch {
        // fall through
      }
    }
    if (trimmed.includes('\n') && /[,;\t]/.test(trimmed)) {
      const cands = parseCsvText(`${fileName}${labelHint ? ` · ${labelHint}` : ''}`, trimmed);
      out.candidates.push(...cands);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return;

    if (value.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      const nums = value as number[];
      if (nums.length >= 3) {
        const grid: RawGrid = [
          ['#module', 'forecasting'],
          ['Periode', 'Permintaan'],
          ...nums.map((n, idx) => [`P${idx + 1}`, n]),
        ];
        const cand = gridToCandidate(fileName, labelHint || 'Serial Angka', grid);
        if (cand) out.candidates.push(cand);
      }
      return;
    }

    if (Array.isArray(value[0])) {
      const grid: RawGrid = value.map((row) =>
        Array.isArray(row) ? row.map(toRawCell) : [toRawCell(row)],
      );
      const cand = gridToCandidate(fileName, labelHint || 'Tabel Array 2D', grid);
      if (cand) out.candidates.push(cand);
      return;
    }

    if (value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      const items = value as Record<string, unknown>[];
      const hasModuleWrapper = items.some(
        (it) =>
          typeof it.moduleId === 'string' ||
          typeof it.module === 'string' ||
          typeof it.modul === 'string' ||
          typeof it.moduleType === 'string',
      );
      if (hasModuleWrapper) {
        for (let i = 0; i < items.length; i += 1) {
          collectFromValue(items[i], fileName, `${labelHint || 'Metode'}_${i + 1}`, out, depth + 1);
        }
        return;
      }

      if ('processingTime' in items[0]) {
        const jobsArr = items.map((it, i) => ({
          jobId: String(it.jobId ?? it.id ?? `WO-${i + 1}`),
          processingTime: Number(it.processingTime ?? 1),
          dueDate: Number(it.dueDate ?? 10),
          weight: it.weight !== undefined ? Number(it.weight) : 1,
          processingTimeMachine2:
            it.processingTimeMachine2 !== undefined ? Number(it.processingTimeMachine2) : undefined,
        }));
        const hasM2 = jobsArr.some((j) => (j.processingTimeMachine2 ?? 0) > 0);
        out.jobs.push(
          createJob('scheduling', labelHint || 'Penjadwalan JS', {
            mode: hasM2 ? 'johnson_two_machine' : 'single_machine',
            jobs: jobsArr,
          }),
        );
        return;
      }

      const headerSet: string[] = [];
      for (const rowObj of items) {
        for (const key of Object.keys(rowObj)) {
          if (!headerSet.includes(key)) headerSet.push(key);
        }
      }
      if (headerSet.length > 0) {
        const grid: RawGrid = [
          headerSet,
          ...items.map((rowObj) => headerSet.map((h) => toRawCell(rowObj[h]))),
        ];
        const cand = gridToCandidate(fileName, labelHint || 'Tabel Objek JS', grid);
        if (cand) out.candidates.push(cand);
      }
      return;
    }
    return;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // 1. Project bundle { jobs, links }
    if (
      Array.isArray(obj.jobs) &&
      obj.jobs.some((j) => j && typeof j === 'object' && 'moduleId' in j)
    ) {
      const jobs = (obj.jobs as ModuleJob[]).filter(
        (j) => j && typeof j.moduleId === 'string' && j.moduleId in MODULE_MAP,
      );
      const validIds = new Set(jobs.map((j) => j.id));
      const links = Array.isArray(obj.links)
        ? (obj.links as PipelineLink[]).filter(
            (l) => validIds.has(l.sourceJobId) && validIds.has(l.targetJobId),
          )
        : [];
      out.jobs.push(
        ...jobs.map((j) => ({
          ...j,
          input: mergeWithDefaults(j.moduleId, j.input as unknown as Record<string, unknown>),
        })),
      );
      out.links.push(...links);
      return;
    }

    // 2. Explicit Tabular wrapper { headers/columns, rows/data }
    const rawHeaders = Array.isArray(obj.headers)
      ? obj.headers
      : Array.isArray(obj.columns)
        ? obj.columns
        : null;
    const rawRows = Array.isArray(obj.rows)
      ? obj.rows
      : Array.isArray(obj.data) && Array.isArray(obj.data[0])
        ? obj.data
        : null;
    if (rawHeaders && rawRows) {
      const grid: RawGrid = [
        rawHeaders.map(toRawCell),
        ...(rawRows as unknown[]).map((r) =>
          Array.isArray(r) ? r.map(toRawCell) : [toRawCell(r)],
        ),
      ];
      const modHint =
        resolveModuleAlias(
          typeof obj.moduleId === 'string'
            ? obj.moduleId
            : typeof obj.module === 'string'
              ? obj.module
              : typeof obj.modul === 'string'
                ? obj.modul
                : undefined,
        ) ?? undefined;
      const cand = gridToCandidate(
        fileName,
        String(obj.title ?? obj.name ?? (labelHint || 'Data Tabel JS')),
        grid,
      );
      if (cand) {
        if (modHint) {
          cand.detectedModuleId = modHint;
          cand.confidence = 0.96;
        }
        out.candidates.push(cand);
      }
      return;
    }

    // 3. Single module descriptor { moduleId | module | modul | type, input | data | params }
    const rawModType =
      typeof obj.moduleId === 'string'
        ? obj.moduleId
        : typeof obj.module === 'string'
          ? obj.module
          : typeof obj.modul === 'string'
            ? obj.modul
            : typeof obj.moduleType === 'string'
              ? obj.moduleType
              : typeof obj.type === 'string'
                ? obj.type
                : undefined;

    const resolvedModId = resolveModuleAlias(rawModType);
    const titleStr = String(
      obj.title ?? obj.name ?? obj.label ?? obj.jobTitle ?? (labelHint || ''),
    );

    if (resolvedModId) {
      const nestedInput = obj.input ?? obj.data ?? obj.params ?? obj.payload ?? obj.config;
      if (nestedInput && typeof nestedInput === 'object' && !Array.isArray(nestedInput)) {
        out.jobs.push(
          createJob(
            resolvedModId,
            titleStr || MODULE_MAP[resolvedModId].indonesianName,
            nestedInput as Record<string, unknown>,
          ),
        );
        return;
      }

      if (Array.isArray(nestedInput)) {
        collectFromValue(nestedInput, fileName, titleStr || resolvedModId, out, depth + 1);
        const lastCand = out.candidates[out.candidates.length - 1];
        if (lastCand) {
          lastCand.detectedModuleId = resolvedModId;
          lastCand.confidence = 0.96;
        }
        return;
      }

      const stripped: Record<string, unknown> = {};
      const metaKeys = new Set([
        'moduleId',
        'module',
        'modul',
        'moduleType',
        'type',
        'title',
        'name',
        'label',
        'jobTitle',
      ]);
      for (const [k, v] of Object.entries(obj)) {
        if (!metaKeys.has(k)) stripped[k] = v;
      }
      out.jobs.push(
        createJob(resolvedModId, titleStr || MODULE_MAP[resolvedModId].indonesianName, stripped),
      );
      return;
    }

    // 4. Unlabeled object matching one of the 4 engines directly
    const inferredMod = inferModuleFromObjectKeys(obj);
    if (inferredMod) {
      out.jobs.push(
        createJob(
          inferredMod,
          titleStr || labelHint || MODULE_MAP[inferredMod].indonesianName,
          obj,
        ),
      );
      return;
    }

    // 5. Dictionary of multiple named exports/datasets
    const beforeJobs = out.jobs.length;
    const beforeCands = out.candidates.length;
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'default' || val === undefined || val === null) continue;
      if (typeof val === 'object' || typeof val === 'string') {
        collectFromValue(val, fileName, key, out, depth + 1);
      }
    }

    // 6. Flat primitive JS object fallback ({ Jan: 120, Feb: 135, Mar: 150 })
    if (out.jobs.length === beforeJobs && out.candidates.length === beforeCands) {
      const entries = Object.entries(obj).filter(
        ([k, v]) =>
          k !== 'default' &&
          (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'),
      );
      if (entries.length >= 3 && entries.every(([, v]) => typeof v === 'number')) {
        const grid: RawGrid = [
          ['Periode', 'Permintaan'],
          ...entries.map(([k, v]) => [k, toRawCell(v)]),
        ];
        const cand = gridToCandidate(fileName, labelHint || 'Deret Objek JS', grid);
        if (cand) out.candidates.push(cand);
      }
    }
  }
}

export function parseJsonOrJsText(fileName: string, text: string): ParsedJsonImport {
  const out: ParsedJsonImport = { jobs: [], links: [], candidates: [] };
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Berkas "${fileName}" kosong.`);
  }

  let parsedRoot: unknown;
  let usedJsParser = false;

  try {
    parsedRoot = JSON.parse(trimmed) as unknown;
  } catch {
    usedJsParser = true;
    const extracted = extractJsModuleValue(trimmed);
    parsedRoot = extracted.rootValue;

    if (parsedRoot !== undefined) {
      collectFromValue(parsedRoot, fileName, '', out, 0);
    }

    const namedKeys = Object.keys(extracted.namedExports);
    if (extracted.defaultExport !== undefined && namedKeys.length > 0) {
      const extraNamed: Record<string, unknown> = {};
      for (const k of namedKeys) {
        if (extracted.namedExports[k] !== extracted.defaultExport) {
          extraNamed[k] = extracted.namedExports[k];
        }
      }
      if (Object.keys(extraNamed).length > 0) {
        collectFromValue(extraNamed, fileName, '', out, 0);
      }
    }

    if (out.jobs.length === 0 && out.candidates.length === 0) {
      if (extracted.defaultExport !== undefined && extracted.defaultExport !== parsedRoot) {
        collectFromValue(extracted.defaultExport, fileName, 'default', out, 0);
      }
      if (namedKeys.length > 0 && extracted.namedExports !== parsedRoot) {
        collectFromValue(extracted.namedExports, fileName, '', out, 0);
      }
      if (
        out.jobs.length === 0 &&
        out.candidates.length === 0 &&
        Object.keys(extracted.scopeBindings).length > 0
      ) {
        collectFromValue(extracted.scopeBindings, fileName, '', out, 0);
      }
    }
  }

  if (!usedJsParser) {
    collectFromValue(parsedRoot, fileName, fileName.replace(/\.[^.]+$/, ''), out, 0);
  }

  if (
    out.jobs.length === 0 &&
    out.candidates.length === 0 &&
    trimmed.includes('\n') &&
    /[,;\t]/.test(trimmed)
  ) {
    const csvCands = parseCsvText(fileName, trimmed);
    out.candidates.push(...csvCands);
  }

  const fileModHint = resolveModuleAlias(fileName.replace(/\.[^.]+$/, ''));
  if (fileModHint) {
    for (const c of out.candidates) {
      if (c.confidence < 0.78) {
        c.detectedModuleId = fileModHint;
        c.confidence = 0.88;
        c.reason = `Disesuaikan dengan nama berkas "${fileName}"`;
      }
    }
  }

  if (out.jobs.length === 0 && out.candidates.length === 0) {
    throw new Error(
      `Format data JS/JSON pada "${fileName}" belum dikenali. Pastikan berkas mengekspor objek 4 metode PPIC, array angka/tabel, atau CSV.`,
    );
  }

  return out;
}

export async function parseJsonOrJsFile(file: File): Promise<ParsedJsonImport> {
  const text = await file.text();
  return parseJsonOrJsText(file.name, text);
}
