---
name: ha-jodeya
description: Reference guide for Ha Jodeya (/home/antigravity/ha-jodeya) 4-Stage PPIC Workbench (Forecasting, MPS, MRP, Scheduling) with 6-Pillar Causal Answer Explanations, DAG Pipeline, and verification gates.
---
# Ha Jodeya Project Guide

- **Project Root**: `/home/antigravity/ha-jodeya`
- **4 Core PPIC Methods**: `forecasting` (`01 FC`) → `mps` (`02 MPS`) → `mrp` (`03 MR`) → `scheduling` (`04 SC`)
- **Architecture Layers**:
  - `src/core/`: Domain types, 4-method registry, 6-Pillar explanation builder & glossary, Kahn DAG pipeline resolver.
  - `src/engines/`: 4 pure TypeScript solvers (`forecasting.ts`, `mps.ts`, `mrp.ts`, `scheduling.ts`) + `index.ts`.
  - `src/workers/`: Reusable Web Worker Pool (`workerPool.ts`, `solver.worker.ts`).
  - `src/io/`: Zero-`eval()` JS/JSON/CSV/Excel parsers, column mapping, and `.xlsx`/`.csv`/`.md`/`.json` exporters.
  - `src/store/` & `src/ui/` & `src/styles/`: Multi-project store, Undo/Redo, 5 What-If snapshots, 4-Stage Spine UI, `ExplanationPanel`, 4 spreadsheet editors, and 5 SVG charts.
- **Verification Gates**:
  - `npm run lint && npx tsc --noEmit && npm test && npm run build`
