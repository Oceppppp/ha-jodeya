# Arsitektur Sistem Ha Jodeya (5-Lapisan Modular)

**Ha Jodeya** mengimplementasikan arsitektur berlapis 100% sisi klien (*client-side*, PWA offline-ready) untuk mengeksekusi rantai **4 metode inti PPIC (`Forecasting → MPS → MRP → Scheduling`)** secara paralel di Web Worker beserta **Penjelasan & Interpretasi Jawaban 6-Pilar**.

## 1. Diagram Lapisan Arsitektur

```text
+-----------------------------------------------------------------------+
| 1. Presentation Layer (src/ui/ & src/styles/)                         |
|    - TopBar, PpicSpineSidebar (01 FC -> 02 MPS -> 03 MR -> 04 SC)     |
|    - BatchDashboard (4-Stage Health Strip + What-If + Inline Drawer)  |
|    - ExplanationPanel (6-Pilar + Mode Lengkap/Ringkas + Copy/Unduh)   |
|    - 4 Spreadsheet Editors (Ctrl+V Excel) & 5 Grafik SVG Interaktif   |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
+-----------------------------------+-----------------------------------+
| 2. State & Worker Pool Layer (src/store/ & src/workers/)              |
|    - WorkspaceProvider (Multi-Proyek localStorage, Undo/Redo 30x)     |
|    - WorkerPool (2..8 Reusable Web Workers, 15s Timeout, Auto-Recover)|
+-----------------------------------+-----------------------------------+
                                    |
               +--------------------+--------------------+
               v                                         v
+--------------+--------------------+     +--------------+--------------+
| 3. Domain, Pipeline & Explanation |     | 4. Universal Safe IO Layer  |
|    (src/core/)                    |     |    (src/io/)                |
|    - module.types.ts              |     |    - excelParser (.xlsx)    |
|    - explanation.types.ts (6P)    |     |    - csvParser (.csv/.tsv)  |
|    - moduleRegistry.ts (4 Metode) |     |    - jsDataParser (0-eval!) |
|    - pipelineResolver.ts (Kahn)   |     |    - columnMapping.ts       |
|    - glossaryCatalog.ts           |     |    - excel/csv/md/json Exp  |
+--------------+--------------------+     +-----------------------------+
               |
               v
+--------------+--------------------------------------------------------+
| 5. Pure Quantitative Engines Layer (src/engines/) — Bebas React/DOM   |
|    - forecasting.ts : 7 Metode + Auto-Tune (α,β) + OLS R² + TS        |
|    - mps.ts         : DTF/PTF + PAB + 4 Lot + Discrete/Cum ATP + RCCP |
|    - mrp.ts         : Low-Level Coding Multi-Parent BOM + 5 Lot-Sizing|
|    - scheduling.ts  : 6 Aturan Single-Machine + Algoritma Johnson 2M  |
+-----------------------------------------------------------------------+
```

## 2. Alur Rantai Pipeline 4-Tahap (Kahn Topological DAG)

1. **Stage 1 — Forecasting (`FC`)**: Menghitung `horizonForecasts` dari metode ber-MAD terkecil → disuntikkan otomatis ke `MPS.forecasts`.
2. **Stage 2 — MPS (`MPS`)**: Menghitung `Effective Demand`, `PAB`, `Discrete & Cumulative ATP`, `RCCP`, dan `mpsSchedule` → disuntikkan ke `MRP.items[level=0].grossRequirements`.
3. **Stage 3 — MRP (`MR`)**: Mengeksplosi BOM multi-level (*Low-Level Coding*) dan menerbitkan `workOrderList` → disuntikkan ke `Scheduling.jobs`.
4. **Stage 4 — Scheduling (`SC`)**: Mengevaluasi 6 aturan dispatching mesin tunggal atau Algoritma Johnson 2-Mesin beserta Gantt Chart dan penjelasan 6-Pilar.
