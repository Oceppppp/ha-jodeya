import type { ModuleChartSpec } from './chart.types.ts';
import type { CompleteExplanation } from './explanation.types.ts';

export type ModuleId = 'forecasting' | 'mps' | 'mrp' | 'scheduling';

export type ModuleCategory =
  | 'Demand Planning'
  | 'Master Scheduling'
  | 'Material Planning'
  | 'Shop-Floor Execution';

export interface ForecastingInput {
  moduleId: 'forecasting';
  periodLabels: string[];
  values: number[];
  movingAvgWindow: number;
  weightedWeights: number[];
  alpha: number;
  beta: number;
  gamma?: number;
  seasonalPeriod?: number;
  seasonalType?: 'none' | 'additive' | 'multiplicative';
  autoOptimize?: boolean;
  horizon: number;
}

export type MpsLotSizingMethod = 'L4L' | 'FOQ' | 'LOT_MULTIPLE' | 'POQ';
export type MpsFrozenPolicy = 'orders_only' | 'max';
export type MpsLiquidPolicy = 'max' | 'forecast_only';

export interface MpsInput {
  moduleId: 'mps';
  productName: string;
  beginningInventory: number;
  safetyStock: number;
  demandTimeFence: number;
  planningTimeFence: number;
  frozenZonePolicy: MpsFrozenPolicy;
  liquidZonePolicy: MpsLiquidPolicy;
  lotSizing: MpsLotSizingMethod;
  lotSize: number;
  poqPeriods: number;
  setupCost: number;
  holdingCostPerUnit: number;
  stdHoursPerUnit: number;
  periodLabels: string[];
  forecasts: number[];
  customerOrders: number[];
  firmMps: (number | null)[];
  availableCapacity: number[];
}

export type MrpLotSizingMethod = 'L4L' | 'FOQ' | 'POQ' | 'EOQ' | 'SM';

export interface MrpItemInput {
  item: string;
  level: number;
  parent?: string;
  qtyPerParent: number;
  leadTime: number;
  onHand: number;
  safetyStock: number;
  lotSizing: MrpLotSizingMethod;
  fixedOrderQty?: number;
  fixedOrderPeriods?: number;
  setupCost?: number;
  holdingCostPerUnit?: number;
  scheduledReceipts: number[];
  grossRequirements: number[];
}

export interface MrpInput {
  moduleId: 'mrp';
  periodLabels: string[];
  items: MrpItemInput[];
}

export interface SchedulingJobInput {
  jobId: string;
  processingTime: number;
  dueDate: number;
  weight?: number;
  processingTimeMachine2?: number;
}

export interface SchedulingInput {
  moduleId: 'scheduling';
  mode: 'single_machine' | 'johnson_two_machine';
  jobs: SchedulingJobInput[];
}

export type ModuleInputData =
  | ForecastingInput
  | MpsInput
  | MrpInput
  | SchedulingInput;

export interface KpiMetric {
  label: string;
  value: string | number;
  unit?: string;
  emphasis?: 'primary' | 'success' | 'warning' | 'error';
}

export interface ResultTable {
  id: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  highlightRowIndices?: number[];
}

export interface AuditStep {
  title: string;
  formula?: string;
  detail: string;
}

export interface AnalysisSection {
  heading: string;
  body: string;
  tone?: 'neutral' | 'positive' | 'caution' | 'critical';
}

export interface DeepAnalysis {
  headline: string;
  interpretation: string;
  sections: AnalysisSection[];
  recommendations: string[];
}

export interface ModuleExecutionResult {
  jobId: string;
  moduleId: ModuleId;
  jobTitle: string;
  status: 'success' | 'warning' | 'error';
  executionMs: number;
  summaryText: string;
  kpis: KpiMetric[];
  tables: ResultTable[];
  charts: ModuleChartSpec[];
  warnings: string[];
  derivedValues: Record<string, number | string>;
  auditSteps: AuditStep[];
  analysis: DeepAnalysis;
  explanation: CompleteExplanation;
  error?: string;
}
