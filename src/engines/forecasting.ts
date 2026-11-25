import { buildErrorExplanation } from '../core/explanation/explanationBuilder.ts';
import { GLOSSARY_BY_MODULE } from '../core/explanation/glossaryCatalog.ts';
import { formatNum, roundTo } from '../core/math/matrix.ts';
import type {
  ForecastingInput,
  ModuleExecutionResult,
  ResultTable,
} from '../core/types/module.types.ts';

interface MethodEvaluation {
  name: string;
  fitted: (number | null)[];
  future: number[];
  mad: number;
  mse: number;
  rmse: number;
  mape: number;
  bias: number;
  trackingSignal: number;
  sumErr: number;
  evalCount: number;
}

function evaluateErrors(
  actual: number[],
  fitted: (number | null)[],
  future: number[],
  name: string,
): MethodEvaluation {
  let count = 0;
  let sumErr = 0;
  let sumAbs = 0;
  let sumSq = 0;
  let sumPct = 0;
  let pctCount = 0;

  for (let i = 0; i < actual.length; i += 1) {
    const f = fitted[i];
    if (f === null || !Number.isFinite(f)) continue;
    const err = actual[i] - f;
    count += 1;
    sumErr += err;
    sumAbs += Math.abs(err);
    sumSq += err * err;
    if (Math.abs(actual[i]) > 1e-9) {
      sumPct += (Math.abs(err) / Math.abs(actual[i])) * 100;
      pctCount += 1;
    }
  }

  const mad = count > 0 ? sumAbs / count : Infinity;
  const mse = count > 0 ? sumSq / count : Infinity;
  const rmse = Number.isFinite(mse) ? Math.sqrt(mse) : Infinity;
  const mape = pctCount > 0 ? sumPct / pctCount : Infinity;
  const bias = count > 0 ? sumErr / count : 0;
  const trackingSignal = mad > 1e-9 && Number.isFinite(mad) ? sumErr / mad : 0;

  return {
    name,
    fitted,
    future,
    mad,
    mse,
    rmse,
    mape,
    bias,
    trackingSignal,
    sumErr,
    evalCount: count,
  };
}

export function solveForecasting(
  jobId: string,
  jobTitle: string,
  input: ForecastingInput,
): ModuleExecutionResult {
  const start = performance.now();
  const y = input.values.map((v) => (Number.isFinite(v) ? v : 0));
  const n = y.length;
  const horizon = Math.max(1, Math.min(24, Math.round(input.horizon || 1)));

  if (n < 3) {
    const errPack = buildErrorExplanation(
      'forecasting',
      'Data historis peramalan minimal membutuhkan 3 periode agar evaluasi tren dan galat valid.',
      'Tambahkan minimal 3 baris periode permintaan historis pada tabel editor atau unggah data lengkap.',
    );
    return {
      jobId,
      moduleId: 'forecasting',
      jobTitle,
      status: 'error',
      executionMs: 0,
      summaryText: 'Data historis peramalan minimal membutuhkan 3 periode.',
      kpis: [],
      tables: [],
      charts: [],
      warnings: ['Tambahkan minimal 3 titik data historis.'],
      derivedValues: {},
      auditSteps: [],
      analysis: errPack.analysis,
      explanation: errPack.explanation,
      error: 'Minimal 3 titik data diperlukan untuk peramalan.',
    };
  }

  const methods: MethodEvaluation[] = [];

  // 1. Naive
  const naiveFitted: (number | null)[] = y.map((_, i) => (i === 0 ? null : y[i - 1]));
  const naiveFuture = Array<number>(horizon).fill(y[n - 1]);
  methods.push(evaluateErrors(y, naiveFitted, naiveFuture, 'Naive'));

  // 2. Simple Moving Average (SMA)
  const k = Math.max(2, Math.min(n - 1, Math.round(input.movingAvgWindow || 3)));
  const smaFitted: (number | null)[] = y.map((_, i) => {
    if (i < k) return null;
    let sum = 0;
    for (let j = i - k; j < i; j += 1) sum += y[j];
    return sum / k;
  });
  const lastKAvg = y.slice(n - k).reduce((a, b) => a + b, 0) / k;
  methods.push(
    evaluateErrors(y, smaFitted, Array<number>(horizon).fill(lastKAvg), `Moving Average (k=${k})`),
  );

  // 3. Weighted Moving Average (WMA)
  const rawWeights =
    (input.weightedWeights?.length ?? 0) > 0 ? input.weightedWeights : [0.5, 0.3, 0.2];
  const kw = Math.max(1, Math.min(rawWeights.length, n - 1));
  const slicedWeights = rawWeights.slice(0, kw);
  const wSum = slicedWeights.reduce((a, b) => a + b, 0) || 1;
  const weights = slicedWeights.map((w) => w / wSum);
  const wmaFitted: (number | null)[] = y.map((_, i) => {
    if (i < kw) return null;
    let val = 0;
    for (let offset = 0; offset < kw; offset += 1) {
      val += y[i - 1 - offset] * weights[offset];
    }
    return val;
  });
  let wmaNext = 0;
  for (let offset = 0; offset < kw; offset += 1) {
    wmaNext += y[n - 1 - offset] * weights[offset];
  }
  methods.push(
    evaluateErrors(
      y,
      wmaFitted,
      Array<number>(horizon).fill(wmaNext),
      `Weighted MA (${kw} periode)`,
    ),
  );

  // 4. Single Exponential Smoothing (SES)
  let sesAlpha = Math.max(0.01, Math.min(0.99, input.alpha || 0.3));
  const runSes = (a: number) => {
    const fitted: (number | null)[] = [null];
    let lvl = y[0];
    for (let i = 1; i < n; i += 1) {
      fitted.push(lvl);
      lvl = a * y[i] + (1 - a) * lvl;
    }
    return { fitted, lastLevel: lvl };
  };

  let tunedNote = '';
  if (input.autoOptimize) {
    let bestMad = Infinity;
    let bestA = sesAlpha;
    for (let a = 0.05; a <= 0.951; a += 0.05) {
      const roundedA = roundTo(a, 2);
      const { fitted, lastLevel } = runSes(roundedA);
      const ev = evaluateErrors(y, fitted, [lastLevel], 'temp');
      if (ev.mad < bestMad) {
        bestMad = ev.mad;
        bestA = roundedA;
      }
    }
    sesAlpha = bestA;
    tunedNote = `SES(α*=${bestA})`;
  }

  const sesRes = runSes(sesAlpha);
  methods.push(
    evaluateErrors(
      y,
      sesRes.fitted,
      Array<number>(horizon).fill(sesRes.lastLevel),
      `Exponential Smoothing (α=${sesAlpha}${input.autoOptimize ? ', Auto' : ''})`,
    ),
  );

  // 5. Holt's Trend-Adjusted Exponential Smoothing
  let holtAlpha = Math.max(0.01, Math.min(0.99, input.alpha || 0.3));
  let holtBeta = Math.max(0.01, Math.min(0.99, input.beta || 0.2));
  const runHolt = (a: number, b: number) => {
    const fitted: (number | null)[] = [null];
    let hLevel = y[0];
    let hTrend = y[1] - y[0];
    for (let i = 1; i < n; i += 1) {
      fitted.push(hLevel + hTrend);
      const prevLevel = hLevel;
      hLevel = a * y[i] + (1 - a) * (hLevel + hTrend);
      hTrend = b * (hLevel - prevLevel) + (1 - b) * hTrend;
    }
    const future = Array.from({ length: horizon }, (_, h) => hLevel + (h + 1) * hTrend);
    return { fitted, future, lastLevel: hLevel, lastTrend: hTrend };
  };

  if (input.autoOptimize) {
    let bestMad = Infinity;
    let bestA = holtAlpha;
    let bestB = holtBeta;
    for (let a = 0.1; a <= 0.91; a += 0.1) {
      for (let b = 0.1; b <= 0.91; b += 0.1) {
        const ra = roundTo(a, 2);
        const rb = roundTo(b, 2);
        const { fitted, future } = runHolt(ra, rb);
        const ev = evaluateErrors(y, fitted, future, 'temp');
        if (ev.mad < bestMad) {
          bestMad = ev.mad;
          bestA = ra;
          bestB = rb;
        }
      }
    }
    holtAlpha = bestA;
    holtBeta = bestB;
    tunedNote = `${tunedNote ? `${tunedNote}; ` : ''}Holt(α*=${bestA}, β*=${bestB})`;
  }

  const holtRes = runHolt(holtAlpha, holtBeta);
  methods.push(
    evaluateErrors(
      y,
      holtRes.fitted,
      holtRes.future,
      `Holt Linear Trend (α=${holtAlpha}, β=${holtBeta}${input.autoOptimize ? ', Auto' : ''})`,
    ),
  );

  // 6. Linear Trend Regression (OLS)
  const sumT = (n * (n + 1)) / 2;
  const sumT2 = (n * (n + 1) * (2 * n + 1)) / 6;
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumTY = y.reduce((acc, val, idx) => acc + (idx + 1) * val, 0);
  const denom = n * sumT2 - sumT * sumT;
  const slope = Math.abs(denom) > 1e-9 ? (n * sumTY - sumT * sumY) / denom : 0;
  const intercept = (sumY - slope * sumT) / n;
  const regFitted = y.map((_, idx) => intercept + slope * (idx + 1));
  const regFuture = Array.from({ length: horizon }, (_, h) => intercept + slope * (n + h + 1));
  methods.push(evaluateErrors(y, regFitted, regFuture, 'Linear Trend / Regresi OLS'));

  // 7. Seasonal Decomposition & Holt-Winters
  const tables: ResultTable[] = [];
  const L = input.seasonalPeriod ? Math.round(input.seasonalPeriod) : 0;
  const seasonalMode = input.seasonalType && input.seasonalType !== 'none' ? input.seasonalType : null;
  let seasonalIndices: number[] | null = null;

  if (seasonalMode && L >= 2 && n >= L) {
    const rawBuckets: number[][] = Array.from({ length: L }, () => []);
    for (let i = 0; i < n; i += 1) {
      const tr = regFitted[i];
      if (seasonalMode === 'multiplicative') {
        rawBuckets[i % L].push(Math.abs(tr) > 1e-6 ? y[i] / tr : 1);
      } else {
        rawBuckets[i % L].push(y[i] - tr);
      }
    }

    const rawAvg = rawBuckets.map((b) =>
      b.length > 0 ? b.reduce((s, v) => s + v, 0) / b.length : seasonalMode === 'multiplicative' ? 1 : 0,
    );

    if (seasonalMode === 'multiplicative') {
      const avgFactor = rawAvg.reduce((s, v) => s + v, 0) / L || 1;
      seasonalIndices = rawAvg.map((v) => v / avgFactor);
    } else {
      const meanOffset = rawAvg.reduce((s, v) => s + v, 0) / L;
      seasonalIndices = rawAvg.map((v) => v - meanOffset);
    }

    const decFitted = y.map((_, i) =>
      seasonalMode === 'multiplicative'
        ? regFitted[i] * seasonalIndices![i % L]
        : regFitted[i] + seasonalIndices![i % L],
    );
    const decFuture = Array.from({ length: horizon }, (_, h) => {
      const sIdx = seasonalIndices![(n + h) % L];
      return seasonalMode === 'multiplicative' ? regFuture[h] * sIdx : regFuture[h] + sIdx;
    });
    methods.push(
      evaluateErrors(
        y,
        decFitted,
        decFuture,
        `Dekomposisi Musiman (${seasonalMode === 'multiplicative' ? 'Mult' : 'Add'}, L=${L})`,
      ),
    );

    if (n >= L * 2) {
      const gamma = Math.max(0.01, Math.min(0.99, input.gamma ?? 0.3));
      const seasonFactors = [...seasonalIndices];
      let hwLevel = y.slice(0, L).reduce((a, b) => a + b, 0) / L;
      let hwTrend = (y.slice(L, L * 2).reduce((a, b) => a + b, 0) / L - hwLevel) / L;
      const hwFitted: (number | null)[] = Array<number | null>(L).fill(null);

      for (let i = L; i < n; i += 1) {
        const s = i % L;
        const pred =
          seasonalMode === 'multiplicative'
            ? (hwLevel + hwTrend) * (Math.abs(seasonFactors[s]) > 1e-6 ? seasonFactors[s] : 1)
            : hwLevel + hwTrend + seasonFactors[s];
        hwFitted.push(pred);

        const prevLvl = hwLevel;
        if (seasonalMode === 'multiplicative') {
          const sf = Math.abs(seasonFactors[s]) > 1e-6 ? seasonFactors[s] : 1;
          hwLevel = holtAlpha * (y[i] / sf) + (1 - holtAlpha) * (hwLevel + hwTrend);
          hwTrend = holtBeta * (hwLevel - prevLvl) + (1 - holtBeta) * hwTrend;
          seasonFactors[s] = gamma * (y[i] / Math.max(1e-6, hwLevel)) + (1 - gamma) * sf;
        } else {
          hwLevel = holtAlpha * (y[i] - seasonFactors[s]) + (1 - holtAlpha) * (hwLevel + hwTrend);
          hwTrend = holtBeta * (hwLevel - prevLvl) + (1 - holtBeta) * hwTrend;
          seasonFactors[s] = gamma * (y[i] - hwLevel) + (1 - gamma) * seasonFactors[s];
        }
      }

      const hwFuture = Array.from({ length: horizon }, (_, h) => {
        const sf = seasonFactors[(n + h) % L];
        return seasonalMode === 'multiplicative'
          ? (hwLevel + (h + 1) * hwTrend) * sf
          : hwLevel + (h + 1) * hwTrend + sf;
      });
      methods.push(
        evaluateErrors(
          y,
          hwFitted,
          hwFuture,
          `Holt-Winters (${seasonalMode === 'multiplicative' ? 'Mult' : 'Add'}, L=${L})`,
        ),
      );
    }
  }

  const ranked = [...methods].sort((a, b) => a.mad - b.mad || a.mse - b.mse);
  const best = ranked[0];
  const runnerUp = ranked[1];

  const compTable: ResultTable = {
    id: 'forecast-comparison',
    title: 'Perbandingan Akurasi Seluruh Metode Peramalan',
    headers: ['Metode', 'MAD', 'MSE', 'RMSE', 'MAPE (%)', 'Bias', 'Tracking Signal', 'Proyeksi +1'],
    rows: ranked.map((m, idx) => [
      `${m.name}${idx === 0 ? ' ★' : ''}`,
      roundTo(m.mad, 3),
      roundTo(m.mse, 3),
      roundTo(m.rmse, 3),
      Number.isFinite(m.mape) ? `${roundTo(m.mape, 2)}%` : 'N/A',
      roundTo(m.bias, 3),
      roundTo(m.trackingSignal, 2),
      roundTo(m.future[0], 2),
    ]),
    highlightRowIndices: [0],
  };

  const futureLabels = Array.from({ length: horizon }, (_, i) => `Proyeksi +${i + 1}`);
  const detailTable: ResultTable = {
    id: 'forecast-series',
    title: `Detail Deret Waktu & Proyeksi (${best.name})`,
    headers: ['Periode', 'Aktual (Y)', 'Fitted / Proyeksi', 'Error (Y - F)', 'Regresi OLS'],
    rows: [
      ...y.map((val, i) => {
        const bf = best.fitted[i];
        return [
          input.periodLabels[i] ?? `P${i + 1}`,
          roundTo(val, 2),
          bf !== null ? roundTo(bf, 2) : '-',
          bf !== null ? roundTo(val - bf, 2) : '-',
          roundTo(regFitted[i], 2),
        ];
      }),
      ...futureLabels.map((lbl, h) => [
        lbl,
        '-',
        roundTo(best.future[h], 2),
        '-',
        roundTo(regFuture[h], 2),
      ]),
    ],
  };

  tables.push(compTable, detailTable);

  if (seasonalIndices) {
    tables.push({
      id: 'forecast-seasonal-indices',
      title: `Indeks Musiman (${seasonalMode === 'multiplicative' ? 'Multiplikatif' : 'Aditif'}, Siklus L=${L})`,
      headers: ['Sub-Musim', 'Contoh Periode', 'Faktor / Indeks Musiman'],
      rows: seasonalIndices.map((idxVal, sIdx) => [
        `Musim ${sIdx + 1}`,
        input.periodLabels[sIdx] ?? `P${sIdx + 1}`,
        roundTo(idxVal, 4),
      ]),
    });
  }

  const allLabels = [...input.periodLabels.slice(0, n), ...futureLabels];
  const chartSeries = [
    {
      name: 'Aktual Historis',
      colorToken: 'var(--chart-1)',
      points: y.map((val, i) => ({ x: allLabels[i] ?? `P${i + 1}`, y: roundTo(val, 2) })),
    },
    {
      name: `Terbaik: ${best.name}`,
      colorToken: 'var(--chart-2)',
      points: [
        ...best.fitted
          .map((f, i) => (f !== null ? { x: allLabels[i] ?? `P${i + 1}`, y: roundTo(f, 2) } : null))
          .filter((p): p is NonNullable<typeof p> => p !== null),
        ...best.future.map((f, h) => ({ x: futureLabels[h], y: roundTo(f, 2) })),
      ],
    },
    {
      name: 'Regresi Tren OLS',
      colorToken: 'var(--chart-3)',
      dashed: true,
      points: [
        ...regFitted.map((f, i) => ({ x: allLabels[i] ?? `P${i + 1}`, y: roundTo(f, 2) })),
        ...regFuture.map((f, h) => ({ x: futureLabels[h], y: roundTo(f, 2) })),
      ],
    },
  ];

  const yMean = sumY / n;
  const ssTot = y.reduce((s, val) => s + (val - yMean) ** 2, 0);
  const ssRes = y.reduce((s, val, i) => s + (val - regFitted[i]) ** 2, 0);
  const rSquared = ssTot > 1e-9 ? Math.max(0, 1 - ssRes / ssTot) : 1;

  const mapeText = Number.isFinite(best.mape) ? `${formatNum(best.mape, 2)}%` : 'N/A';
  const mapeGrade = !Number.isFinite(best.mape)
    ? 'valid (terdapat aktual 0 sehingga MAPE dilewati)'
    : best.mape < 10
      ? 'Sangat Akurat (MAPE < 10%)'
      : best.mape < 20
        ? 'Baik (MAPE 10–20%)'
        : best.mape < 50
          ? 'Cukup Wajar (MAPE 20–50%)'
          : 'Fluktuasi Tinggi (MAPE > 50%)';

  const tsWarning = Math.abs(best.trackingSignal) > 4;
  const warnings: string[] = tsWarning
    ? [
        `Tracking Signal metode "${best.name}" bernilai ${roundTo(best.trackingSignal, 2)} (melampaui batas ±4), menandakan potensi bias sistematis.`,
      ]
    : [];

  let seasonalInsight = '';
  if (seasonalIndices && seasonalIndices.length >= 2) {
    const peakIdx = seasonalIndices.indexOf(Math.max(...seasonalIndices));
    const troughIdx = seasonalIndices.indexOf(Math.min(...seasonalIndices));
    seasonalInsight = ` Pola musiman (L=${L}, ${seasonalMode}) memuncak di Musim ${peakIdx + 1} (${roundTo(seasonalIndices[peakIdx], 3)}) dan terendah di Musim ${troughIdx + 1} (${roundTo(seasonalIndices[troughIdx], 3)}).`;
  }

  const horizonStr = best.future.map((v) => formatNum(v, 1)).join(' → ');
  const safetyBuffer = roundTo(1.25 * best.mad, 1);

  const whyOptimalReasons: string[] = [
    `Metode "${best.name}" keluar sebagai pemenang karena menghasilkan rata-rata kesalahan absolut (MAD) paling kecil yaitu ${formatNum(best.mad, 3)} unit di antara seluruh ${methods.length} kandidat metode yang diuji pada ${n} periode historis Anda.`,
    runnerUp
      ? `Dibandingkan peringkat kedua "${runnerUp.name}" (MAD = ${formatNum(runnerUp.mad, 3)}), metode terpilih menekan rata-rata meleset sebesar ${formatNum(runnerUp.mad - best.mad, 3)} unit per periode (${runnerUp.mad > 1e-9 ? formatNum(((runnerUp.mad - best.mad) / runnerUp.mad) * 100, 1) : '0'}% lebih presisi).`
      : 'Seluruh titik evaluasi historis menunjukkan kesesuaian paling rapat pada metode ini.',
    rSquared >= 0.65
      ? `Data historis Anda memiliki tren linear kuat (${slope >= 0 ? '+' : ''}${formatNum(slope, 2)} unit/periode dengan R² = ${formatNum(rSquared * 100, 1)}%), sehingga metode yang peka terhadap kemiringan tren mengungguli rata-rata bergerak statis (Naive/SMA/SES) yang selalu tertinggal di belakang tren.`
      : `Data historis memiliki R² tren sebesar ${formatNum(rSquared * 100, 1)}% (fluktuasi sekitar rata-rata ${formatNum(yMean, 1)} lebih dominan dibanding tren lurus), sehingga pemulusan adaptif meredam noise acak lebih efektif.${seasonalInsight}`,
  ];

  const auditSteps = [
    {
      title: '1. Estimasi Garis Tren Linear (OLS)',
      formula: `Ŷ(t) = a + b·t = ${formatNum(intercept, 2)} + (${formatNum(slope, 2)})·t · R² = ${roundTo(rSquared, 4)}`,
      detail: `Dari ∑Y = ${formatNum(sumY, 1)} dan ∑(t·Y) = ${formatNum(sumTY, 1)} atas n = ${n} periode, diperoleh kemiringan b = ${formatNum(slope, 3)} unit/periode.`,
    },
    {
      title: '2. Evaluasi Galat Historis & Pemilihan Pemenang',
      formula: 'MAD = ∑|Yₜ - Fₜ| / k · RMSE = √(∑(Yₜ - Fₜ)² / k) · TS = ∑(Yₜ - Fₜ) / MAD',
      detail: `"${best.name}" mencatat MAD = ${formatNum(best.mad, 3)}, RMSE = ${formatNum(best.rmse, 3)}, MAPE = ${mapeText}, dan Tracking Signal = ${formatNum(best.trackingSignal, 2)}.`,
    },
    ...(tunedNote
      ? [
          {
            title: '3. Kalibrasi Otomatis Parameter Smoothing (Grid Search)',
            formula: tunedNote,
            detail:
              'Grid search mengevaluasi kombinasi α dan β secara menyeluruh untuk mencari titik minimum MAD historis.',
          },
        ]
      : []),
  ];

  const analysisSections = [
    {
      heading: 'Pola Tren & Kekuatan Determinasi (R²)',
      body: `Persamaan regresi menunjukkan arah ${
        Math.abs(slope) < 0.01 * Math.max(1, Math.abs(yMean))
          ? 'stasioner / mendatar'
          : slope > 0
            ? `tren naik +${formatNum(slope, 2)} unit/periode`
            : `tren turun ${formatNum(slope, 2)} unit/periode`
      } dengan R² = ${formatNum(rSquared * 100, 1)}%.${seasonalInsight}`,
      tone: 'neutral' as const,
    },
    {
      heading: 'Stabilitas Bias & Tracking Signal',
      body: `Mean Bias = ${formatNum(best.bias, 2)} (${
        Math.abs(best.bias) < best.mad * 0.15
          ? 'seimbang tanpa kecenderungan meleset searah'
          : best.bias > 0
            ? 'cenderung under-forecast: aktual > ramalan'
            : 'cenderung over-forecast: ramalan > aktual'
      }) dengan Tracking Signal = ${formatNum(best.trackingSignal, 2)} (${
        tsWarning ? 'DI LUAR batas aman ±4 — perlu kalibrasi parameter!' : 'aman di dalam koridor kendali ±4'
      }).`,
      tone: tsWarning ? ('caution' as const) : ('positive' as const),
    },
  ];

  const recommendations = [
    `Teruskan deret proyeksi "${best.name}" (${horizonStr}) langsung ke kolom Forecast pada modul MPS (Tahap 02), dan siapkan Safety Stock sekitar ±${formatNum(safetyBuffer, 1)} unit (1σ ≈ 1,25 × MAD) untuk meredam ketidakpastian permintaan.`,
    tsWarning
      ? 'Aktifkan opsi Auto-Optimize (α, β) atau aktifkan mode Musiman (Seasonal) karena Tracking Signal berada di luar batas ±4.'
      : 'Perbarui data aktual setiap penutupan periode dan pantau agar Tracking Signal tetap berada di dalam rentang [-4, +4].',
  ];

  const elapsed = roundTo(performance.now() - start, 2);

  return {
    jobId,
    moduleId: 'forecasting',
    jobTitle,
    status: warnings.length > 0 ? 'warning' : 'success',
    executionMs: elapsed,
    summaryText: `Metode terbaik: ${best.name} (MAD=${formatNum(best.mad, 2)}, MAPE=${mapeText}). Proyeksi +1: ${formatNum(best.future[0], 2)} unit.${tunedNote ? ` [${tunedNote}]` : ''}`,
    kpis: [
      { label: 'Metode Terbaik (MAD Min)', value: best.name, emphasis: 'primary' },
      { label: 'Proyeksi Periode +1', value: formatNum(best.future[0], 2), unit: 'unit', emphasis: 'success' },
      { label: 'MAD / MAPE Terbaik', value: `${formatNum(best.mad, 2)} · ${mapeText}` },
      {
        label: 'Tracking Signal',
        value: `${formatNum(best.trackingSignal, 2)} (${tsWarning ? 'Bias!' : 'Aman'})`,
        emphasis: tsWarning ? 'warning' : 'success',
      },
    ],
    tables,
    charts: [
      {
        kind: 'line',
        id: 'forecast-chart',
        title: 'Grafik Aktual Historis vs Proyeksi Peramalan',
        subtitle: `Persamaan OLS: Ŷ = ${formatNum(intercept, 2)} + ${formatNum(slope, 2)}·t (R² = ${formatNum(rSquared * 100, 1)}%)`,
        xLabel: 'Periode',
        yLabel: 'Permintaan (Unit)',
        series: chartSeries,
      },
    ],
    warnings,
    auditSteps,
    analysis: {
      headline: `"${best.name}" Terpilih dengan Kategori ${mapeGrade}`,
      interpretation: `Dari ${methods.length} metode yang dievaluasi pada ${n} periode historis, "${best.name}" memberikan kesalahan rata-rata terendah (MAD = ${formatNum(best.mad, 2)}, RMSE = ${formatNum(best.rmse, 2)}, MAPE = ${mapeText}) dan memproyeksikan ${horizon} periode ke depan sebesar: ${horizonStr} unit.`,
      sections: analysisSections,
      recommendations,
    },
    explanation: {
      keyDecision: `Gunakan metode "${best.name}" dengan proyeksi periode depan sebesar ${formatNum(best.future[0], 2)} unit (proyeksi ${horizon} periode: ${horizonStr}).`,
      plainSummary: `Sistem menguji ${methods.length} metode peramalan sekaligus terhadap ${n} data masa lalu Anda. Hasilnya, "${best.name}" paling mendekati angka aktual karena rata-rata melesetnya paling kecil (MAD = ${formatNum(best.mad, 2)} unit atau MAPE = ${mapeText}), sehingga proyeksinya paling layak dijadikan dasar jadwal produksi MPS.`,
      metricBreakdown: [
        {
          label: 'Proyeksi Periode +1',
          value: `${formatNum(best.future[0], 2)} unit`,
          meaning: `Perkiraan jumlah permintaan pada periode tepat berikutnya menurut metode terbaik (${best.name}).`,
          impact: 'Menjadi angka Forecast acuan utama untuk menyusun jadwal produksi induk (MPS) di Tahap 02.',
        },
        {
          label: 'MAD (Mean Absolute Deviation)',
          value: `${formatNum(best.mad, 2)} unit`,
          meaning: `Rata-rata penyimpangan absolut ramalan terhadap data aktual adalah ±${formatNum(best.mad, 2)} unit per periode.`,
          impact: `Digunakan untuk menentukan cadangan Safety Stock produk jadi (1σ ≈ 1,25 × ${formatNum(best.mad, 2)} = ${formatNum(safetyBuffer, 1)} unit).`,
        },
        {
          label: 'MAPE (Persentase Galat)',
          value: mapeText,
          meaning: `Rata-rata persentase selisih ramalan terhadap aktual berada pada kategori ${mapeGrade}.`,
          impact: 'Memudahkan manajemen membandingkan tingkat presisi peramalan lintas produk yang berbeda skala.',
        },
        {
          label: 'Tracking Signal (TS)',
          value: formatNum(best.trackingSignal, 2),
          meaning: 'Indikator apakah ramalan terus-menerus kekecilan (positif besar) atau kebesaran (negatif besar).',
          impact: tsWarning
            ? 'Nilai di luar [-4, +4] memberi sinyal peringatan bahwa parameter model perlu dikalibrasi ulang.'
            : 'Nilai di dalam [-4, +4] membuktikan error bersifat acak wajar tanpa bias sistematis.',
        },
      ],
      workedSteps: [
        {
          stepNumber: 1,
          title: 'Menghitung Kemiringan Tren Linear (OLS)',
          formula: 'b = (n·∑tY - ∑t·∑Y) / (n·∑t² - (∑t)²),   a = (∑Y - b·∑t) / n',
          substitution: `b = (${n}×${formatNum(sumTY, 1)} - ${sumT}×${formatNum(sumY, 1)}) / (${n}×${sumT2} - ${sumT}²) = ${formatNum(slope, 3)};  a = ${formatNum(intercept, 3)}`,
          result: `Ŷ(t) = ${formatNum(intercept, 2)} + (${formatNum(slope, 2)})·t  (R² = ${formatNum(rSquared * 100, 1)}%)`,
          explanation: 'Mengukur seberapa kuat kenaikan atau penurunan permintaan rata-rata di setiap penambahan periode.',
        },
        {
          stepNumber: 2,
          title: `Menghitung Akurasi Metode Pemenang (${best.name})`,
          formula: 'MAD = ∑|Yₜ - Fₜ| / k,   TS = ∑(Yₜ - Fₜ) / MAD',
          substitution: `MAD atas ${best.evalCount} titik uji = ${formatNum(best.mad, 3)};  TS = ${formatNum(best.sumErr, 2)} / ${formatNum(best.mad, 3)}`,
          result: `MAD = ${formatNum(best.mad, 3)} · MAPE = ${mapeText} · TS = ${formatNum(best.trackingSignal, 2)}`,
          explanation: 'Seluruh metode diurutkan berdasarkan MAD terkecil untuk memilih model yang paling presisi pada pola historis Anda.',
        },
        {
          stepNumber: 3,
          title: `Memproyeksikan ${horizon} Periode ke Depan`,
          formula: best.name.includes('Holt Linear')
            ? 'Fₙ₊ₘ = Lₙ + m · Tₙ'
            : best.name.includes('Regresi')
              ? 'Fₙ₊ₘ = a + b · (n + m)'
              : 'Proyeksi berlanjut dari level/komponen musim terakhir metode terpilih',
          substitution: best.name.includes('Holt Linear')
            ? `Lₙ = ${formatNum(holtRes.lastLevel, 2)}, Tₙ = ${formatNum(holtRes.lastTrend, 2)} → m = 1..${horizon}`
            : `Dihitung untuk t = ${n + 1} s.d. ${n + horizon}`,
          result: `${horizonStr} unit`,
          explanation: 'Deret proyeksi inilah yang siap disalurkan otomatis ke modul MPS melalui Pipeline 4-Tahap.',
        },
      ],
      whyOptimal: whyOptimalReasons,
      risksAndNotes: analysisSections.map((s) => ({
        heading: s.heading,
        detail: s.body,
        tone: s.tone,
      })),
      recommendations,
      glossary: GLOSSARY_BY_MODULE.forecasting,
    },
    derivedValues: {
      nextPeriodForecast: roundTo(best.future[0], 4),
      annualizedForecast12: roundTo(best.future[0] * 12, 4),
      horizonForecasts: best.future.map((v) => roundTo(v, 2)).join(', '),
      bestMethod: best.name,
      trendSlope: roundTo(slope, 4),
      rSquared: roundTo(rSquared, 4),
      bestMad: roundTo(best.mad, 4),
      recommendedSafetyStock: safetyBuffer,
      tunedAlpha: sesAlpha,
      tunedBeta: holtBeta,
    },
  };
}
