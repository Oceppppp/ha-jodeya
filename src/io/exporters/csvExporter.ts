import type { ModuleExecutionResult } from '../../core/types/module.types.ts';
import type { ModuleJob } from '../../core/types/workspace.types.ts';

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatModuleResultCsv(job: ModuleJob, result: ModuleExecutionResult): string {
  const lines: string[] = [];
  const row = (cells: (string | number)[]) => lines.push(cells.map(escapeCsvCell).join(','));

  row(['Ha Jodeya — Laporan Hasil Metode', job.title]);
  row(['Modul', result.moduleId]);
  row(['Status', result.status]);
  row(['Ringkasan', result.summaryText]);
  lines.push('');

  row(['KPI Utama', 'Nilai']);
  for (const k of result.kpis) {
    row([k.label, `${k.value}${k.unit ? ` ${k.unit}` : ''}`]);
  }
  lines.push('');

  const exp = result.explanation;
  row(['Penjelasan 6-Pilar', 'Isi']);
  row(['Keputusan Inti', exp.keyDecision]);
  row(['Ringkasan', exp.plainSummary]);
  exp.whyOptimal.forEach((reason, i) => row([`Alasan Jawaban #${i + 1}`, reason]));
  exp.recommendations.forEach((rec, i) => row([`Rekomendasi #${i + 1}`, rec]));

  for (const tbl of result.tables) {
    lines.push('');
    row([tbl.title]);
    row(tbl.headers);
    for (const r of tbl.rows) {
      row(r);
    }
  }

  return lines.join('\n');
}

export function exportModuleResultCsv(job: ModuleJob, result: ModuleExecutionResult): void {
  const csv = formatModuleResultCsv(job, result);
  const safeName = job.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || result.moduleId;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ha_Jodeya_${safeName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
