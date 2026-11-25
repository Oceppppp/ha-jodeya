import type { GlossaryTerm } from '../types/explanation.types.ts';
import type { ModuleId } from '../types/module.types.ts';

export const GLOSSARY_BY_MODULE: Record<ModuleId, GlossaryTerm[]> = {
  forecasting: [
    {
      term: 'MAD (Mean Absolute Deviation)',
      definition:
        'Rata-rata selisih mutlak antara permintaan aktual dan hasil ramalan dalam satuan unit asli; semakin kecil nilainya, semakin akurat metode tersebut.',
    },
    {
      term: 'MAPE (Mean Absolute Percentage Error)',
      definition:
        'Rata-rata persentase kesalahan ramalan terhadap permintaan aktual. Nilai < 10% tergolong sangat akurat, 10–20% baik.',
    },
    {
      term: 'RMSE (Root Mean Squared Error)',
      definition:
        'Akar dari rata-rata kuadrat error yang memberi bobot penalti lebih besar pada lonjakan kesalahan ekstrem.',
    },
    {
      term: 'Tracking Signal (TS)',
      definition:
        'Rasio kumulatif error (RSFE) dibagi MAD untuk mendeteksi bias sistematis. Model sehat berada di rentang [-4, +4].',
    },
    {
      term: 'Koefisien Determinasi (R²)',
      definition:
        'Proporsi variasi data historis (0–100%) yang mampu dijelaskan oleh garis tren linear waktu.',
    },
    {
      term: 'Parameter Smoothing (α, β, γ)',
      definition:
        'Bobot responsivitas terhadap data terbaru untuk level (α), kemiringan tren (β), dan faktor musiman (γ) pada rentang 0 hingga 1.',
    },
  ],
  mps: [
    {
      term: 'DTF & PTF (Demand & Planning Time Fence)',
      definition:
        'Batas waktu kebijakan jadwal induk: Zona Frozen (≤ DTF) hanya mengunci pesanan nyata; Zona Slushy (DTF..PTF) butuh persetujuan perubahan; Zona Liquid (> PTF) bebas disesuaikan.',
    },
    {
      term: 'Effective Demand (Permintaan Efektif)',
      definition:
        'Angka permintaan bersih yang wajib dipenuhi MPS pada tiap periode berdasarkan perbandingan Forecast vs Customer Orders sesuai zona Time Fence.',
    },
    {
      term: 'PAB (Projected Available Balance)',
      definition:
        'Proyeksi saldo persediaan produk jadi di akhir tiap periode setelah ditambah penerimaan MPS dan dikurangi Effective Demand.',
    },
    {
      term: 'Discrete & Cumulative ATP (Available-to-Promise)',
      definition:
        'Jumlah unit produk jadi dari stok awal dan batch MPS yang belum terikat pesanan pelanggan sehingga aman dijanjikan tim sales untuk order baru.',
    },
    {
      term: 'RCCP (Rough-Cut Capacity Planning)',
      definition:
        'Uji kelayakan kapasitas kasar yang membandingkan beban jam kerja dari jadwal MPS terhadap kapasitas stasiun kritis per periode.',
    },
    {
      term: 'Over-Promise (ATP Negatif)',
      definition:
        'Kondisi kritis ketika pesanan pelanggan aktual (Customer Orders) melebihi ketersediaan stok + MPS sebelum jadwal produksi berikutnya tiba.',
    },
  ],
  mrp: [
    {
      term: 'BOM (Bill of Materials) & Low-Level Coding',
      definition:
        'Struktur pohon komponen produk di mana komponen bersama (common parts) ditempatkan di level terdalam agar seluruh kebutuhan induk terakumulasi sebelum netting.',
    },
    {
      term: 'Net Requirements (Kebutuhan Bersih)',
      definition:
        'Kekurangan material murni pada periode t setelah Gross Requirements + Safety Stock dikurangi stok On-Hand periode sebelumnya dan Scheduled Receipts.',
    },
    {
      term: 'PORc & PORel (Planned Order Receipt & Release)',
      definition:
        'PORc adalah jumlah lot yang dijadwalkan tiba pada periode kekurangan, sedangkan PORel adalah jadwal pelepasan order yang ditarik mundur sejauh Lead Time.',
    },
    {
      term: 'Past-Due Order',
      definition:
        'Pelepasan order (PORel) yang seharusnya sudah dilakukan sebelum Periode 1 karena waktu tunggu (Lead Time) melebihi jarak periode kebutuhan.',
    },
    {
      term: 'Lot-for-Lot (L4L) & FOQ',
      definition:
        'L4L memesan tepat sebesar kebutuhan bersih (0 biaya simpan ekstra), sedangkan FOQ memesan dalam ukuran batch tetap atau kelipatannya.',
    },
    {
      term: 'Silver-Meal (SM) & POQ',
      definition:
        'Heuristik dinamis yang menggabungkan kebutuhan beberapa periode ke depan selama rata-rata biaya (Setup + Simpan) per periode masih menurun.',
    },
  ],
  scheduling: [
    {
      term: 'Flow Time (Waktu Alir)',
      definition:
        'Total waktu yang dihabiskan suatu pekerjaan di lantai produksi sejak mulai mengantre hingga selesai diproses (Waktu Tunggu + Waktu Proses).',
    },
    {
      term: 'Makespan (C_max)',
      definition:
        'Total rentang waktu penyelesaian dari awal pekerjaan pertama dimulai hingga pekerjaan paling akhir tuntas di seluruh mesin.',
    },
    {
      term: 'Tardiness (Keterlambatan)',
      definition:
        'Selisih positif ketika waktu selesai pekerjaan melewati batas tenggat (Due Date); bernilai 0 jika selesai lebih cepat atau tepat waktu.',
    },
    {
      term: 'SPT & WSPT',
      definition:
        'Shortest Processing Time mendahulukan durasi tersingkat (meminimalkan Flow Time & WIP); WSPT membagi durasi dengan bobot prioritas (tᵢ / wᵢ).',
    },
    {
      term: 'EDD & Critical Ratio (CR)',
      definition:
        'Earliest Due Date mengurutkan tenggat terdekat (meminimalkan Max Tardiness); CR memprioritaskan rasio sisa waktu terhadap waktu proses terkecil.',
    },
    {
      term: 'Algoritma Johnson (2-Machine Flow Shop)',
      definition:
        'Metode eksak pengurutan job melalui Mesin 1 lalu Mesin 2 yang menjamin Makespan minimum global dan menekan waktu menganggur Mesin 2.',
    },
  ],
};
