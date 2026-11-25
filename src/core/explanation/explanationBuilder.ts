import type { CompleteExplanation } from '../types/explanation.types.ts';
import type { DeepAnalysis, ModuleId } from '../types/module.types.ts';
import { GLOSSARY_BY_MODULE } from './glossaryCatalog.ts';

export function buildErrorExplanation(
  moduleId: ModuleId,
  reason: string,
  fixSuggestion: string,
): { analysis: DeepAnalysis; explanation: CompleteExplanation } {
  return {
    analysis: {
      headline: 'Input Membutuhkan Perbaikan Sebelum Perhitungan',
      interpretation: reason,
      sections: [
        {
          heading: 'Diagnosa Validasi Input',
          body: reason,
          tone: 'critical',
        },
      ],
      recommendations: [fixSuggestion],
    },
    explanation: {
      keyDecision: `Perhitungan belum dapat dijalankan: ${reason}`,
      plainSummary: `${reason} ${fixSuggestion}`,
      metricBreakdown: [],
      workedSteps: [],
      whyOptimal: [
        'Mesin validasi menghentikan perhitungan lebih awal untuk mencegah keluarnya angka semu atau pembagian nol.',
      ],
      risksAndNotes: [
        {
          heading: 'Validasi Input Tidak Terpenuhi',
          detail: reason,
          tone: 'critical',
        },
      ],
      recommendations: [fixSuggestion],
      glossary: GLOSSARY_BY_MODULE[moduleId],
    },
  };
}
