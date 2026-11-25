import type { ModuleCategory, ModuleId } from '../types/module.types.ts';

export interface PipelineOutputPort {
  key: string;
  label: string;
  kind: 'scalar' | 'series' | 'work_orders';
}

export interface PipelineInputTarget {
  field: string;
  label: string;
  kind: 'scalar' | 'series' | 'work_orders';
}

export interface MethodConceptGuide {
  purpose: string;
  coreFormulas: string[];
  whenToUse: string;
}

export interface ModuleMetadata {
  id: ModuleId;
  stageNumber: '01' | '02' | '03' | '04';
  code: 'FC' | 'MPS' | 'MR' | 'SC';
  name: string;
  indonesianName: string;
  shortLabel: string;
  category: ModuleCategory;
  stageAccentVar: string;
  description: string;
  conceptGuide: MethodConceptGuide;
  exportableOutputs: PipelineOutputPort[];
  injectableTargets: PipelineInputTarget[];
}

export const MODULE_REGISTRY: ModuleMetadata[] = [
  {
    id: 'forecasting',
    stageNumber: '01',
    code: 'FC',
    name: 'Forecasting',
    indonesianName: 'Peramalan Permintaan',
    shortLabel: 'Forecasting',
    category: 'Demand Planning',
    stageAccentVar: 'var(--stage-fc)',
    description:
      'Evaluasi serentak 7 metode peramalan deret waktu (Naive, SMA, WMA, SES, Holt, Regresi OLS, Holt-Winters Add/Mult) lengkap dengan Auto-Optimize (α, β), R², dan Tracking Signal.',
    conceptGuide: {
      purpose:
        'Memprediksi permintaan beberapa periode ke depan dari data historis sambil mengukur tingkat kesalahan (MAD, RMSE, MAPE) dan mendeteksi bias sistematis (Tracking Signal).',
      coreFormulas: [
        'MAD = ∑|Yₜ - Fₜ| / n  ·  MAPE = (100% / n) × ∑(|Yₜ - Fₜ| / Yₜ)',
        'Holt: Lₜ = αYₜ + (1-α)(Lₜ₋₁ + Tₜ₋₁),  Tₜ = β(Lₜ - Lₜ₋₁) + (1-β)Tₜ₋₁,  Fₜ₊ₘ = Lₜ + m·Tₜ',
        'Tracking Signal (TS) = ∑(Yₜ - Fₜ) / MAD  (batas aman: -4 ≤ TS ≤ +4)',
      ],
      whenToUse:
        'Tahap 01 paling hulu sebelum menyusun jadwal induk MPS. Gunakan proyeksi metode ber-MAD terkecil sebagai input Forecast pada MPS.',
    },
    exportableOutputs: [
      { key: 'horizonForecasts', label: 'Deret Proyeksi Horizon (h Periode)', kind: 'series' },
      { key: 'nextPeriodForecast', label: 'Proyeksi Periode Depan (+1)', kind: 'scalar' },
      { key: 'annualizedForecast12', label: 'Estimasi Permintaan 12 Periode', kind: 'scalar' },
      { key: 'bestMad', label: 'Galat Absolut Terbaik (MAD)', kind: 'scalar' },
    ],
    injectableTargets: [],
  },
  {
    id: 'mps',
    stageNumber: '02',
    code: 'MPS',
    name: 'Master Production Schedule',
    indonesianName: 'Jadwal Induk Produksi (MPS)',
    shortLabel: 'MPS (ATP & RCCP)',
    category: 'Master Scheduling',
    stageAccentVar: 'var(--stage-mps)',
    description:
      'Penyusunan jadwal induk produk jadi berbasis Time Fence (DTF/PTF), Forecast vs Customer Orders, Projected Available Balance (PAB), Discrete & Cumulative ATP, serta uji kelayakan kapasitas kasar (RCCP).',
    conceptGuide: {
      purpose:
        'Menerjemahkan ramalan permintaan & pesanan pelanggan menjadi jadwal produksi produk jadi yang layak kapasitas (RCCP) sekaligus menghitung sisa stok bebas untuk dijanjikan ke pesanan baru (ATP).',
      coreFormulas: [
        'Effective Demand Dₜ: Frozen (t ≤ DTF) = COₜ (atau max); Slushy/Liquid = max(Fₜ, COₜ)',
        'PABₜ = PABₜ₋₁ + MPSₜ - Dₜ  (picu MPSₜ bila PABₜ₋₁ - Dₜ < Safety Stock)',
        'Discrete ATP₁ = I₀ + MPS₁ - ∑CO (sebelum MPS berikutnya);  RCCP Utilₜ = (MPSₜ × StdHours) / Capₜ × 100%',
      ],
      whenToUse:
        'Tahap 02 setelah Forecasting. Jadwal MPS Receipts yang dihasilkan langsung menjadi Gross Requirements Level-0 pada modul MRP.',
    },
    exportableOutputs: [
      { key: 'mpsSchedule', label: 'Deret Jadwal Produksi Induk (MPS Receipts)', kind: 'series' },
      { key: 'totalMpsUnits', label: 'Total Unit Produksi MPS', kind: 'scalar' },
      { key: 'totalAtp', label: 'Total Discrete ATP', kind: 'scalar' },
    ],
    injectableTargets: [
      { field: 'forecasts', label: 'Deret Forecast Permintaan per Periode', kind: 'series' },
      { field: 'safetyStock', label: 'Safety Stock Produk Jadi', kind: 'scalar' },
    ],
  },
  {
    id: 'mrp',
    stageNumber: '03',
    code: 'MR',
    name: 'Material Requirements Planning',
    indonesianName: 'Perencanaan Kebutuhan Material (MRP)',
    shortLabel: 'MRP & BOM',
    category: 'Material Planning',
    stageAccentVar: 'var(--stage-mrp)',
    description:
      'Ledakan struktur pohon BOM multi-level & multi-parent (Low-Level Coding), perhitungan POH/Net Req/PORc/PORel, deteksi Past-Due, serta perbandingan biaya 5 metode Lot-Sizing (L4L, FOQ, POQ, EOQ, Silver-Meal).',
    conceptGuide: {
      purpose:
        'Menentukan kapan dan berapa banyak setiap komponen/bahan baku harus dipesan atau diproduksi agar jadwal induk MPS terpenuhi tepat waktu dengan total biaya pesan + simpan terendah.',
      coreFormulas: [
        'Gross(Anak, t) = ∑ [ PORel(Indukᵢ, t) × QtyPerParentᵢ ]  (Low-Level Coding)',
        'NetReqₜ = max(0, Grossₜ + SafetyStock - POHₜ₋₁ - SchedRecₜ)',
        'PORelₜ₋ₗₜ = PORcₜ  (jika t - LT < 1 maka tercatat sebagai order Past-Due)',
      ],
      whenToUse:
        'Tahap 03 setelah MPS. Rilis order manufaktur dari MRP diteruskan sebagai daftar Work Order ke modul Scheduling.',
    },
    exportableOutputs: [
      { key: 'workOrderList', label: 'Daftar Rilis Work Order ke Scheduling', kind: 'work_orders' },
      { key: 'level0PlannedReleases', label: 'Deret Planned Order Release Level-0', kind: 'series' },
      { key: 'totalPlannedReleases', label: 'Total Unit Rilis Order MRP', kind: 'scalar' },
    ],
    injectableTargets: [
      { field: 'grossRequirements', label: 'Gross Requirements Item Level-0 (dari MPS)', kind: 'series' },
    ],
  },
  {
    id: 'scheduling',
    stageNumber: '04',
    code: 'SC',
    name: 'Shop-Floor Scheduling',
    indonesianName: 'Penjadwalan Mesin & Lantai Produksi',
    shortLabel: 'Scheduling',
    category: 'Shop-Floor Execution',
    stageAccentVar: 'var(--stage-sc)',
    description:
      'Komparasi 6 aturan prioritas mesin tunggal (FCFS, SPT, WSPT berbobot, LPT, EDD, CR) dan optimasi 2-Mesin Flow Shop (Algoritma Johnson) lengkap dengan Gantt Chart.',
    conceptGuide: {
      purpose:
        'Mengurutkan eksekusi work order di lantai produksi untuk meminimalkan waktu alir rata-rata (Flow Time / WIP), keterlambatan terhadap due date (Tardiness), atau total waktu selesai 2 mesin (Makespan).',
      coreFormulas: [
        'Avg Flow Time = ∑Cᵢ / n  ·  WIP = ∑Cᵢ / ∑tᵢ  ·  Tardinessᵢ = max(0, Cᵢ - dᵢ)',
        'SPT: urutkan tᵢ terkecil  ·  WSPT: urutkan tᵢ / wᵢ terkecil  ·  EDD: urutkan dᵢ terdekat',
        'Johnson 2-Mesin: pilih min(t₁ᵢ, t₂ᵢ); bila di Mesin 1 taruh dari depan, bila di Mesin 2 taruh dari belakang',
      ],
      whenToUse:
        'Tahap 04 paling hilir untuk menerjemahkan rilis order MRP menjadi urutan pengerjaan aktual di stasiun kerja/mesin.',
    },
    exportableOutputs: [
      { key: 'bestFlowTime', label: 'Rata-rata Flow Time Terbaik (SPT)', kind: 'scalar' },
      { key: 'makespan', label: 'Total Makespan Penyelesaian', kind: 'scalar' },
    ],
    injectableTargets: [
      { field: 'workOrdersFromMrp', label: 'Daftar Work Order dari Rilis MRP (jam/unit)', kind: 'work_orders' },
      { field: 'processingTimeScale', label: 'Skala Waktu Proses Seluruh Job', kind: 'scalar' },
    ],
  },
];

export const MODULE_MAP: Record<ModuleId, ModuleMetadata> = {
  forecasting: MODULE_REGISTRY[0],
  mps: MODULE_REGISTRY[1],
  mrp: MODULE_REGISTRY[2],
  scheduling: MODULE_REGISTRY[3],
};
