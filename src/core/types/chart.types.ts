export interface LineSeriesPoint {
  x: number | string;
  y: number;
}

export interface LineChartSeries {
  name: string;
  colorToken: string;
  dashed?: boolean;
  points: LineSeriesPoint[];
}

export interface ChartReferenceLine {
  label: string;
  value: number;
  colorToken: string;
}

export interface LineChartSpec {
  kind: 'line';
  id: string;
  title: string;
  subtitle?: string;
  xLabel: string;
  yLabel: string;
  series: LineChartSeries[];
  referenceLines?: ChartReferenceLine[];
}

export interface BarChartItem {
  label: string;
  value: number;
  secondaryValue?: number;
  annotation?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

export interface BarChartSpec {
  kind: 'bar';
  id: string;
  title: string;
  subtitle?: string;
  xLabel: string;
  yLabel: string;
  bars: BarChartItem[];
  referenceLines?: ChartReferenceLine[];
}

export interface GanttTaskItem {
  id: string;
  label: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  isCritical: boolean;
  lane?: string;
}

export interface GanttChartSpec {
  kind: 'gantt';
  id: string;
  title: string;
  subtitle?: string;
  totalDuration: number;
  tasks: GanttTaskItem[];
}

export interface BomTreeNodeItem {
  id: string;
  name: string;
  level: number;
  parents: { parentName: string; qtyPerParent: number }[];
  leadTime: number;
  lotMethod: string;
  totalRelease: number;
  pastDue: number;
}

export interface BomTreeChartSpec {
  kind: 'bom-tree';
  id: string;
  title: string;
  subtitle?: string;
  nodes: BomTreeNodeItem[];
}

export type ModuleChartSpec =
  | LineChartSpec
  | BarChartSpec
  | GanttChartSpec
  | BomTreeChartSpec;
