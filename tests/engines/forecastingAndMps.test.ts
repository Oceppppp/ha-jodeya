import { describe, expect, it } from 'vitest';
import { solveForecasting } from '../../src/engines/forecasting.ts';
import { solveMps } from '../../src/engines/mps.ts';

describe('Forecasting & MPS Pure Quantitative Engines', () => {
  it('solves exact linear trend series with R² = 1 and accurate horizon projections', () => {
    const res = solveForecasting('fc-1', 'Tren Linear Murni', {
      moduleId: 'forecasting',
      periodLabels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      values: [100, 120, 140, 160, 180, 200],
      movingAvgWindow: 3,
      weightedWeights: [0.5, 0.3, 0.2],
      alpha: 0.4,
      beta: 0.3,
      seasonalType: 'none',
      autoOptimize: true,
      horizon: 3,
    });

    expect(res.status).toBe('success');
    expect(res.derivedValues.rSquared).toBeCloseTo(1, 5);
    expect(res.derivedValues.trendSlope).toBeCloseTo(20, 4);
    expect(res.derivedValues.nextPeriodForecast).toBeCloseTo(220, 2);
    expect(res.derivedValues.horizonForecasts).toBe('220, 240, 260');
  });

  it('evaluates multiplicative seasonal decomposition & Holt-Winters cleanly', () => {
    const res = solveForecasting('fc-2', 'Musiman Kuartalan', {
      moduleId: 'forecasting',
      periodLabels: ['Q1-1', 'Q2-1', 'Q3-1', 'Q4-1', 'Q1-2', 'Q2-2', 'Q3-2', 'Q4-2'],
      values: [80, 100, 90, 130, 88, 110, 99, 143],
      movingAvgWindow: 4,
      weightedWeights: [0.5, 0.3, 0.2],
      alpha: 0.35,
      beta: 0.2,
      gamma: 0.3,
      seasonalPeriod: 4,
      seasonalType: 'multiplicative',
      autoOptimize: true,
      horizon: 4,
    });

    expect(res.status === 'success' || res.status === 'warning').toBe(true);
    expect(res.tables.some((t) => t.id === 'forecast-seasonal-indices')).toBe(true);
    expect(Number(res.derivedValues.nextPeriodForecast)).toBeGreaterThan(70);
  });

  it('returns structured 6-pillar diagnostic explanation when historical points < 3', () => {
    const res = solveForecasting('fc-err', 'Data Kurang', {
      moduleId: 'forecasting',
      periodLabels: ['P1', 'P2'],
      values: [50, 60],
      movingAvgWindow: 2,
      weightedWeights: [0.6, 0.4],
      alpha: 0.3,
      beta: 0.2,
      horizon: 2,
    });

    expect(res.status).toBe('error');
    expect(res.explanation.keyDecision).toContain('Perhitungan belum dapat dijalankan');
    expect(res.explanation.glossary.length).toBeGreaterThan(3);
  });

  it('computes textbook MPS Effective Demand (DTF/PTF), PAB, FOQ receipts, Discrete ATP, and RCCP overload', () => {
    const res = solveMps('mps-1', 'Uji Buku Teks MPS', {
      moduleId: 'mps',
      productName: 'Kompresor X1',
      beginningInventory: 100,
      safetyStock: 20,
      demandTimeFence: 1,
      planningTimeFence: 3,
      frozenZonePolicy: 'orders_only',
      liquidZonePolicy: 'max',
      lotSizing: 'FOQ',
      lotSize: 150,
      poqPeriods: 2,
      setupCost: 500000,
      holdingCostPerUnit: 2000,
      stdHoursPerUnit: 1.0,
      periodLabels: ['W1', 'W2', 'W3', 'W4'],
      // W1 Frozen (orders_only -> 90, forecast 110 ignored!)
      // W2 Slushy (max(80, 70) -> 80)
      // W3 Slushy (max(95, 40) -> 95)
      // W4 Liquid (max(100, 10) -> 100)
      forecasts: [110, 80, 95, 100],
      customerOrders: [90, 70, 40, 10],
      firmMps: [null, null, null, null],
      // Capacity 140h -> FOQ 150 * 1.0h = 150h > 140h (107.14% Overload!)
      availableCapacity: [160, 140, 160, 160],
    });

    // Effective Demand = [90, 80, 95, 100] -> sum = 365
    expect(res.derivedValues.totalEffectiveDemand).toBe(365);

    // Check PAB & MPS:
    // W1: prevPab=100, req=90 -> 100-90=10 < SS(20) -> trigger FOQ 150 -> PAB1 = 100+150-90 = 160
    // W2: prevPab=160, req=80 -> 160-80=80 >= SS(20) -> MPS2 = 0 -> PAB2 = 80
    // W3: prevPab=80, req=95 -> 80-95=-15 < SS(20) -> trigger FOQ 150 -> PAB3 = 80+150-95 = 135
    // W4: prevPab=135, req=100 -> 135-100=35 >= SS(20) -> MPS4 = 0 -> PAB4 = 35
    expect(res.derivedValues.mpsSchedule).toBe('150, 0, 150, 0');
    expect(res.derivedValues.totalMpsUnits).toBe(300);

    // Discrete ATP:
    // W1 (next MPS at W3): I0(100) + MPS1(150) - (CO1(90) + CO2(70)) = 250 - 160 = 90
    // W3 (no more MPS): MPS3(150) - (CO3(40) + CO4(10)) = 150 - 50 = 100
    // Total Discrete ATP = 190
    expect(res.derivedValues.totalAtp).toBe(190);
  });

  it('detects Over-Promise (Discrete ATP < 0) and RCCP Overload (> 100%) with explicit causal warnings', () => {
    const res = solveMps('mps-warn', 'Uji Over-Promise & Overload', {
      moduleId: 'mps',
      productName: 'Motor Z',
      beginningInventory: 20,
      safetyStock: 10,
      demandTimeFence: 2,
      planningTimeFence: 3,
      frozenZonePolicy: 'orders_only',
      liquidZonePolicy: 'max',
      lotSizing: 'FOQ',
      lotSize: 100,
      poqPeriods: 2,
      setupCost: 200000,
      holdingCostPerUnit: 1000,
      stdHoursPerUnit: 1.5,
      periodLabels: ['W1', 'W2'],
      forecasts: [60, 60],
      customerOrders: [70, 65],
      // Lock Firm MPS at W1=100, W2=0 so W1+W2 CO = 135 > I0(20)+MPS1(100)=120 -> ATP1 = -15!
      firmMps: [100, 0],
      availableCapacity: [120, 120], // W1 load = 100 * 1.5 = 150h > 120h (125% Overload!)
    });

    expect(res.status).toBe('warning');
    expect(res.warnings.some((w) => w.includes('Over-Promise ATP'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('Overload Kapasitas RCCP'))).toBe(true);
    expect(res.derivedValues.overloadCount).toBe(1);
    expect(res.derivedValues.peakCapacityUtilPct).toBeCloseTo(125, 1);
  });
});
