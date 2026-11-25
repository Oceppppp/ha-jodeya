# Ha Jodeya — 4-Stage Production Planning & Scheduling Workbench

[![CI](https://github.com/Oceppppp/ha-jodeya/actions/workflows/ci.yml/badge.svg)](https://github.com/Oceppppp/ha-jodeya/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Ha Jodeya** adalah aplikasi web analitik modern berbasis **React 19 + TypeScript + Vite + Web Workers** yang memfokuskan seluruh kemampuan setara **OmniQM Studio v1.2** pada **4 metode inti PPIC yang saling terhubung**:

1. **Tahap 01 · Forecasting (`FC`)** — Evaluasi serentak 7 metode (*Naive, SMA, WMA, SES, Holt Linear Trend, Regresi OLS, Seasonal/Holt-Winters Add & Mult*), *Auto-Optimize* $(\alpha, \beta)$, $R^2$, dan *Tracking Signal*.
2. **Tahap 02 · Master Production Schedule (`MPS`)** — *Time Fence* (`DTF` *Frozen*, `PTF` *Slushy*, *Liquid*), *Effective Demand*, *Projected Available Balance (PAB)*, perbandingan 4 aturan Lot-Sizing (`L4L`, `FOQ`, `Lot-Multiple`, `POQ`), **Discrete & Cumulative ATP** (*Over-Promise Check*), serta **Rough-Cut Capacity Planning (RCCP)**.
3. **Tahap 03 · Material Requirements Planning (`MRP`)** — Eksplosi struktur pohon BOM multi-level & multi-parent (*Low-Level Coding*), *Netting & Offsetting*, deteksi rambatan *Past-Due*, diagram `SvgBomTree`, dan perbandingan biaya 5 metode Lot-Sizing (`L4L`, `FOQ`, `POQ`, `EOQ`, `Silver-Meal`).
4. **Tahap 04 · Shop-Floor Scheduling (`SC`)** — Komparasi serentak 6 aturan mesin tunggal (`FCFS`, `SPT`, `WSPT` berbobot, `LPT`, `EDD`, `CR`) serta **Algoritma Johnson 2-Mesin Flow Shop** lengkap dengan *Gantt Chart*.

## Keunggulan Utama

- **Penjelasan & Interpretasi Jawaban 6-Pilar di Setiap Metode:** Setiap jawaban menjelaskan **apa artinya** dan **mengapa jawaban tersebut yang keluar** berbasis angka input aktual pengguna (*Pilar 1 Kesimpulan Inti · Pilar 2 Arti & Dampak Angka · Pilar 3 Rumus & Substitusi Aktual · Pilar 4 Alasan Mengapa Jawaban Keluar/Optimal · Pilar 5 Risiko & Rekomendasi · Pilar 6 Kamus Istilah*), lengkap dengan saklar **Mode Lengkap / Ringkas** dan ekspor `.md`, `.xlsx`, `.csv`, serta **Laporan PDF Lengkap**.
- **Pipeline Rantai PPIC 4-Tahap (`FC → MPS → MRP → SC`):** Penjadwalan topologis Kahn DAG + *Reusable Web Worker Pool*.
- **Ingesti Data Universal Zero-`eval()`:** Mendukung `.xlsx`/`.xls` multi-sheet, multi-`.csv`, `.hajodeya.json`, serta semua pola file `.js`/`.mjs`/`.cjs` dengan *Interactive Column Mapping* dan tempel langsung `Ctrl+V` dari Excel.
- **Produktivitas Workbench Penuh:** Komparasi hingga **5 Skenario What-If**, **Multi-Proyek Lokal**, **Undo/Redo (`Ctrl+Z`/`Ctrl+Y`, 30 langkah)**, **Command Palette (`Ctrl+K`)**, ekspor grafik `.svg`/`.png` 2x, **Dark Workbench Mode**, dan **PWA Offline** berstempel SHA-256.

## Dataset Contoh Siap Upload (`samples/`)

- `Master_Contoh_4_Metode_Ha_Jodeya.xlsx` — Workbook Excel 4 sheet (`01 FC`, `02 MPS`, `03 MR`, `04 SC`)
- `01_forecasting_pompa.csv`, `02_mps_pompa.csv`, `03_mrp_bom_pompa.csv`, `04_scheduling_lantai.csv`
- `contoh_rantai_4_tahap_ppic.hajodeya.json` — Bundel proyek JSON lengkap dengan 3 tautan pipeline 4-tahap
- `contoh_upload_bebas.js` — Contoh file JavaScript multi-ekspor (diproses 100% tanpa `eval()`)

## Menjalankan & Memverifikasi Proyek

```bash
npm ci
npm run dev         # Menjalankan server development
npm run lint        # Oxlint static analysis (0 warnings, 0 errors)
npx tsc --noEmit    # Strict TypeScript typecheck
npm test            # Vitest suite (18 tes: matematika, audit 6-pilar, DAG, IO & PWA)
npm run build       # Bundle produksi Vite + stempel SHA-256 dist/sw.js
```

## Dokumentasi & Skills Pengembangan

- [Product Requirements Document (PRD)](docs/PRD.md)
- [Project Planning & Roadmap](docs/PROJECT_PLANNING.md)
- [Design System & Visual Hierarchy](docs/DESIGN_SYSTEM.md)
- [Arsitektur 5-Lapisan](docs/ARCHITECTURE.md)
- Project Skill: [`.agents/skills/ha-jodeya/SKILL.md`](.agents/skills/ha-jodeya/SKILL.md)

