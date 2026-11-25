import { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import type { ModuleId } from '../../core/types/module.types.ts';
import type { DetectedSheetCandidate } from '../../core/types/workspace.types.ts';
import { downloadMasterTemplateExcel } from '../../io/exporters/excelExporter.ts';
import {
  autoSuggestColumnMapping,
  getModuleMappingFields,
} from '../../io/parsers/columnMapping.ts';
import { parseCsvFile } from '../../io/parsers/csvParser.ts';
import { parseExcelFile } from '../../io/parsers/excelParser.ts';
import { parseJsonOrJsFile } from '../../io/parsers/jsonParser.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';

export function FileDropzone() {
  const {
    state,
    addManyJobs,
    setPendingCandidates,
    updateCandidate,
    commitPendingCandidates,
    clearCandidates,
    runAll,
  } = useWorkspace();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);
    setInfoMsg(null);

    const newCandidates: DetectedSheetCandidate[] = [];
    let directImportedJobs = 0;

    try {
      for (const file of Array.from(fileList)) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
          const excelCands = await parseExcelFile(file);
          newCandidates.push(...excelCands);
        } else if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
          const csvCands = await parseCsvFile(file);
          newCandidates.push(...csvCands);
        } else {
          // .hajodeya.json, .json, .js, .mjs, .cjs, or text
          const parsed = await parseJsonOrJsFile(file);
          if (parsed.jobs.length > 0) {
            addManyJobs(parsed.jobs, parsed.links, parsed.links.length > 0);
            directImportedJobs += parsed.jobs.length;
          }
          if (parsed.candidates.length > 0) {
            newCandidates.push(...parsed.candidates);
          }
        }
      }

      if (newCandidates.length > 0) {
        setPendingCandidates([...state.pendingCandidates, ...newCandidates]);
      }

      if (directImportedJobs > 0 && newCandidates.length === 0) {
        setInfoMsg(`Berhasil memuat ${directImportedJobs} pekerjaan metode secara langsung.`);
        void runAll(true);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca berkas yang diunggah.');
    }
  };

  return (
    <>
      <header className="view-header">
        <div>
          <div className="view-eyebrow">INGESTI DATA UNIVERSAL · 100% LOKAL · ZERO EVAL()</div>
          <h1 className="view-heading">Upload Excel, CSV, JSON &amp; JavaScript</h1>
          <p className="view-lead">
            Unggah 1 workbook Excel multi-sheet (<code>.xlsx</code>), banyak file <code>.csv</code>, bundel proyek <code>.hajodeya.json</code>, atau skrip data <code>.js/.mjs/.cjs</code> bebas. Sesuaikan pemetaan kolom di pratinjau sebelum diimpor.
          </p>
        </div>

        <div className="view-header-actions no-print">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void downloadMasterTemplateExcel()}
          >
            <FileSpreadsheet size={13} /> Unduh Template Excel 4-Sheet
          </button>
        </div>
      </header>

      {errorMsg && <div className="alert-strip alert-error">{errorMsg}</div>}
      {infoMsg && <div className="alert-strip alert-info">{infoMsg}</div>}

      <section
        className={`dropzone-area ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.tsv,.json,.js,.mjs,.cjs,.txt"
          style={{ display: 'none' }}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <UploadCloud size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Tarik &amp; Lepaskan Berkas di Sini, atau Klik untuk Memilih
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: '0.35rem',
          }}
        >
          Mendukung <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.tsv</code>,{' '}
          <code>.hajodeya.json</code>, <code>.json</code>, <code>.js</code>, <code>.mjs</code>,{' '}
          <code>.cjs</code>
        </div>
        <div style={{ marginTop: '0.65rem' }}>
          <span className="badge badge-success">
            <ShieldCheck size={11} /> Diproses 100% di Browser · Aman Tanpa eval()
          </span>
        </div>
      </section>

      {/* Interactive Column Mapping Wizard */}
      {state.pendingCandidates.length > 0 && (
        <section className="surface-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div className="sheet-section-label" style={{ marginBottom: 2 }}>
                Pratinjau Deteksi &amp; Interactive Column Mapping ({state.pendingCandidates.length} Sheet/Berkas)
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Periksa metode tujuan dan pemetaan kolom di bawah ini sebelum memasukkan ke antrean.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <button type="button" className="btn btn-sm" onClick={clearCandidates}>
                <X size={12} /> Batal
              </button>
              <button
                type="button"
                id="btn-commit-upload-candidates"
                className="btn btn-primary btn-sm"
                onClick={() => commitPendingCandidates(true)}
              >
                <CheckCircle2 size={13} /> Impor &amp; Jalankan ({state.pendingCandidates.filter((c) => c.selected).length})
              </button>
            </div>
          </div>

          {state.pendingCandidates.map((cand) => {
            const fields = getModuleMappingFields(cand.detectedModuleId);
            const headerRow = cand.rawRows[cand.headerRowIndex] ?? [];
            const previewRows = cand.rawRows.slice(cand.headerRowIndex + 1, cand.headerRowIndex + 5);

            return (
              <div
                key={cand.id}
                style={{
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 0.95rem',
                  background: 'var(--bg-app)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.7rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                    <input
                      type="checkbox"
                      checked={cand.selected}
                      onChange={(e) => updateCandidate(cand.id, { selected: e.target.checked })}
                    />
                    {cand.sourceFileName} · <span className="mono-num">{cand.sheetName}</span>
                  </label>
                  <span className="badge badge-primary mono-num">
                    Confidence {Math.round(cand.confidence * 100)}% · {cand.reason}
                  </span>
                </div>

                <div className="param-grid">
                  <div className="field-group">
                    <label className="field-label">Metode PPIC Target</label>
                    <select
                      className="form-control"
                      value={cand.detectedModuleId}
                      onChange={(e) => {
                        const nextMod = e.target.value as ModuleId;
                        updateCandidate(cand.id, {
                          detectedModuleId: nextMod,
                          columnMapping: autoSuggestColumnMapping(nextMod, headerRow),
                        });
                      }}
                    >
                      {MODULE_REGISTRY.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.stageNumber} · {m.indonesianName} ({m.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Baris Header Tabel</label>
                    <select
                      className="form-control mono-num"
                      value={cand.headerRowIndex}
                      onChange={(e) => {
                        const nextHdr = Number(e.target.value) || 0;
                        updateCandidate(cand.id, {
                          headerRowIndex: nextHdr,
                          columnMapping: autoSuggestColumnMapping(
                            cand.detectedModuleId,
                            cand.rawRows[nextHdr] ?? [],
                          ),
                        });
                      }}
                    >
                      {cand.rawRows.slice(0, 16).map((r, rIdx) => (
                        <option key={rIdx} value={rIdx}>
                          Baris #{rIdx + 1}: {r.slice(0, 3).join(' | ').slice(0, 36)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {fields.slice(0, 5).map((f) => (
                    <div key={f.key} className="field-group">
                      <label className="field-label">
                        {f.label} {f.required ? '*' : ''}
                      </label>
                      <select
                        className="form-control"
                        value={cand.columnMapping[f.key] ?? -1}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const nextMap = { ...cand.columnMapping };
                          if (val < 0) delete nextMap[f.key];
                          else nextMap[f.key] = val;
                          updateCandidate(cand.id, { columnMapping: nextMap });
                        }}
                      >
                        <option value={-1}>— Tidak Dipetakan —</option>
                        {headerRow.map((hCell, colIdx) => (
                          <option key={colIdx} value={colIdx}>
                            Kolom {colIdx + 1}: {String(hCell ?? `(Kol ${colIdx + 1})`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {previewRows.length > 0 && (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {headerRow.slice(0, 8).map((h, i) => (
                            <th key={i}>{String(h ?? `Kol ${i + 1}`)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r, rIdx) => (
                          <tr key={rIdx}>
                            {headerRow.slice(0, 8).map((_, cIdx) => (
                              <td key={cIdx} className="mono-num">
                                {String(r[cIdx] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
