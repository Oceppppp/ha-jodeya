import { MODULE_MAP } from '../../core/registry/moduleRegistry.ts';
import type { ModuleExecutionResult } from '../../core/types/module.types.ts';

export function formatExplanationMarkdown(result: ModuleExecutionResult): string {
  const meta = MODULE_MAP[result.moduleId];
  const exp = result.explanation;
  const lines: string[] = [];

  lines.push(
    `# ${result.jobTitle} — Penjelasan & Interpretasi Jawaban (${meta.stageNumber} · ${meta.code}: ${meta.indonesianName})`,
  );
  lines.push('');
  lines.push(`> **Keputusan Utama:** ${exp.keyDecision}`);
  lines.push('');
  lines.push('## 1. Kesimpulan Inti (Bahasa Sehari-hari)');
  lines.push(exp.plainSummary);
  lines.push('');

  if (exp.metricBreakdown.length > 0) {
    lines.push('## 2. Arti & Dampak Setiap Angka Hasil');
    for (const m of exp.metricBreakdown) {
      lines.push(`- **${m.label} = \`${m.value}\`**`);
      lines.push(`  - *Artinya:* ${m.meaning}`);
      lines.push(`  - *Dampak Operasional:* ${m.impact}`);
    }
    lines.push('');
  }

  if (exp.workedSteps.length > 0) {
    lines.push('## 3. Langkah Perhitungan & Substitusi Angka Aktual');
    for (const s of exp.workedSteps) {
      lines.push(`### Langkah ${s.stepNumber}: ${s.title}`);
      lines.push(`- **Rumus Umum:** \`${s.formula}\``);
      lines.push(`- **Substitusi Angka Anda:** \`${s.substitution}\``);
      lines.push(`- **Hasil:** **${s.result}**`);
      lines.push(`- **Penjelasan:** ${s.explanation}`);
      lines.push('');
    }
  }

  if (exp.whyOptimal.length > 0) {
    lines.push('## 4. Mengapa Jawaban Ini yang Keluar / Optimal?');
    for (const w of exp.whyOptimal) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }

  if (exp.risksAndNotes.length > 0 || exp.recommendations.length > 0) {
    lines.push('## 5. Diagnosa Risiko & Rekomendasi Tindak Lanjut');
    for (const n of exp.risksAndNotes) {
      lines.push(`- **${n.heading}:** ${n.detail}`);
    }
    if (exp.recommendations.length > 0) {
      lines.push('');
      lines.push('**Rekomendasi Aksi:**');
      exp.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`);
      });
    }
    lines.push('');
  }

  if (exp.glossary.length > 0) {
    lines.push('## 6. Kamus Istilah Modul');
    for (const g of exp.glossary) {
      lines.push(`- **${g.term}:** ${g.definition}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '*Dihasilkan oleh Ha Jodeya — 4-Stage PPIC Workbench (Forecasting · MPS · MRP · Scheduling).*',
  );

  return lines.join('\n');
}

export function downloadExplanationMarkdown(result: ModuleExecutionResult): void {
  const md = formatExplanationMarkdown(result);
  const safeName =
    result.jobTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 42) || result.moduleId;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ha_Jodeya_Penjelasan_${safeName}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
