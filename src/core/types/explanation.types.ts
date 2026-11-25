export interface MetricExplanationItem {
  label: string;
  value: string;
  meaning: string;
  impact: string;
}

export interface WorkedStep {
  stepNumber: number;
  title: string;
  formula: string;
  substitution: string;
  result: string;
  explanation: string;
}

export interface RiskOrNoteItem {
  heading: string;
  detail: string;
  tone: 'neutral' | 'positive' | 'caution' | 'critical';
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface CompleteExplanation {
  /** Pilar 1a: Kalimat keputusan utama yang langsung menjawab soal */
  keyDecision: string;
  /** Pilar 1b: Ringkasan bahasa sehari-hari 2-3 kalimat */
  plainSummary: string;
  /** Pilar 2: Bedah arti dan dampak setiap angka & variabel hasil */
  metricBreakdown: MetricExplanationItem[];
  /** Pilar 3: Langkah pengerjaan lengkap dengan rumus & substitusi angka aktual */
  workedSteps: WorkedStep[];
  /** Pilar 4: Alasan kausal & pembuktian mengapa jawaban ini keluar / optimal */
  whyOptimal: string[];
  /** Pilar 5a: Catatan risiko, sensitivitas, kendala kapasitas, atau peringatan */
  risksAndNotes: RiskOrNoteItem[];
  /** Pilar 5b: Daftar rekomendasi tindakan konkret bernomor */
  recommendations: string[];
  /** Pilar 6: Kamus istilah kunci pada modul ini */
  glossary: GlossaryTerm[];
}
