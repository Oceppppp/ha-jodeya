import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Command,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  LayoutGrid,
  Menu,
  Moon,
  Play,
  Printer,
  Redo2,
  SlidersHorizontal,
  Sun,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import {
  downloadMasterTemplateExcel,
  exportBatchResultsExcel,
} from '../../io/exporters/excelExporter.ts';
import { exportWorkspaceBundleJson } from '../../io/exporters/jsonExporter.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';

export function TopBar() {
  const {
    state,
    canUndo,
    canRedo,
    undo,
    redo,
    setView,
    runAll,
    toggleArchModal,
    setShowCommandPalette,
    setSidebarOpen,
    toggleTheme,
    triggerFullPdfReport,
  } = useWorkspace();

  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen]);

  const enabledCount = state.jobs.filter((j) => j.enabled).length;
  const resultCount = state.batchSummary?.totalJobs ?? 0;

  return (
    <header className="topbar no-print">
      <div className="brand-group">
        <button
          type="button"
          id="btn-mobile-drawer"
          className="btn btn-tool mobile-menu-btn"
          onClick={() => setSidebarOpen(!state.sidebarOpen)}
          aria-label="Buka atau tutup sidebar 4 tahap PPIC"
          aria-expanded={state.sidebarOpen}
        >
          <Menu size={16} />
        </button>

        <div className="brand-mark" aria-hidden="true">
          <img src="/icon.svg" alt="" width={32} height={32} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
        <div className="brand-text-col">
          <div className="brand-title-row">
            <span className="brand-title">Ha Jodeya</span>
            <span className="brand-version-tag">4-Tahap PPIC</span>
          </div>
          <div className="brand-subtitle">Forecasting · MPS · MRP · Scheduling</div>
        </div>
      </div>

      <nav className="topbar-nav" aria-label="Navigasi Utama">
        <button
          type="button"
          id="nav-batch-results"
          className={`nav-tab ${state.activeView === 'batch-results' ? 'active' : ''}`}
          onClick={() => setView('batch-results')}
        >
          <LayoutGrid size={13} />
          <span className="nav-tab-label">Ringkasan</span>
          <span className="nav-count">{resultCount}</span>
        </button>
        <button
          type="button"
          id="nav-module-editor"
          className={`nav-tab ${state.activeView === 'module-editor' ? 'active' : ''}`}
          onClick={() => setView('module-editor')}
        >
          <SlidersHorizontal size={13} />
          <span className="nav-tab-label">Editor</span>
        </button>
        <button
          type="button"
          id="nav-pipeline"
          className={`nav-tab ${state.activeView === 'pipeline' ? 'active' : ''}`}
          onClick={() => setView('pipeline')}
        >
          <GitBranch size={13} />
          <span className="nav-tab-label">Pipeline</span>
          <span className="nav-count">{state.links.length}</span>
        </button>
        <button
          type="button"
          id="nav-file-upload"
          className={`nav-tab ${state.activeView === 'file-upload' ? 'active' : ''}`}
          onClick={() => setView('file-upload')}
        >
          <UploadCloud size={13} />
          <span className="nav-tab-label">Upload</span>
        </button>
      </nav>

      <div className="topbar-actions">
        <div
          className="toolbar-cluster toolbar-cluster-desktop"
          role="group"
          aria-label="Riwayat dan Perintah Cepat"
        >
          <button
            type="button"
            id="btn-undo"
            className="btn btn-tool"
            disabled={!canUndo}
            onClick={undo}
            title="Batalkan perubahan terakhir (Ctrl+Z)"
            aria-label="Undo perubahan"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            id="btn-redo"
            className="btn btn-tool"
            disabled={!canRedo}
            onClick={redo}
            title="Ulangi perubahan (Ctrl+Y)"
            aria-label="Redo perubahan"
          >
            <Redo2 size={13} />
          </button>
          <button
            type="button"
            id="btn-command-palette"
            className="btn btn-tool"
            onClick={() => setShowCommandPalette(true)}
            title="Pencarian cepat metode & perintah (Ctrl+K)"
            aria-label="Buka Command Palette"
          >
            <Command size={12} /> <span className="mono-num">K</span>
          </button>
        </div>

        {/* Consolidated Export & Report Dropdown (Clean on Desktop + Accessible on Mobile) */}
        <div className="dropdown-wrap" ref={exportMenuRef}>
          <button
            type="button"
            id="btn-export-menu"
            className="btn btn-sm"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((v) => !v)}
            title="Ekspor Excel, JSON, Template, atau Cetak Laporan PDF"
          >
            <Download size={13} />
            <span className="btn-export-label">Ekspor</span>
            <ChevronDown size={12} />
          </button>

          {exportOpen && (
            <div className="dropdown-menu" role="menu" aria-label="Menu Ekspor dan Cetak">
              <div className="dropdown-section-label">Ekspor &amp; Template Data</div>
              <button
                type="button"
                id="btn-download-master-template"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  void downloadMasterTemplateExcel();
                }}
              >
                <FileSpreadsheet size={14} />
                <span>Template Excel 4-Sheet</span>
                <span className="dropdown-item-sub">.xlsx</span>
              </button>

              <button
                type="button"
                id="btn-export-all-excel"
                className="dropdown-item"
                role="menuitem"
                disabled={!state.batchSummary}
                onClick={() => {
                  setExportOpen(false);
                  if (state.batchSummary) {
                    void exportBatchResultsExcel(state.jobs, state.batchSummary);
                  }
                }}
              >
                <Download size={14} />
                <span>Hasil + Penjelasan 6-Pilar</span>
                <span className="dropdown-item-sub">.xlsx</span>
              </button>

              <button
                type="button"
                id="btn-export-project-json"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  exportWorkspaceBundleJson(state.jobs, state.links, state.activeProjectName);
                }}
              >
                <FileJson size={14} />
                <span>Simpan Bundel Proyek</span>
                <span className="dropdown-item-sub">.json</span>
              </button>

              <hr className="dropdown-divider" />
              <div className="dropdown-section-label">Laporan &amp; Cetak</div>

              <button
                type="button"
                id="btn-print-full-pdf"
                className="dropdown-item"
                role="menuitem"
                disabled={!state.batchSummary}
                onClick={() => {
                  setExportOpen(false);
                  triggerFullPdfReport();
                }}
              >
                <FileText size={14} />
                <span>Laporan PDF Lengkap</span>
                <span className="dropdown-item-sub">A4</span>
              </button>

              <button
                type="button"
                id="btn-print-report"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  window.print();
                }}
              >
                <Printer size={14} />
                <span>Cetak Layar Saat Ini</span>
                <span className="dropdown-item-sub">Print</span>
              </button>

              <hr className="dropdown-divider" />

              <button
                type="button"
                id="btn-open-architecture"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  toggleArchModal(true);
                }}
              >
                <Layers size={14} />
                <span>Arsitektur 5-Lapisan</span>
                <span className="dropdown-item-sub">Info</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          id="btn-toggle-theme"
          className="btn btn-sm"
          style={{ padding: '0 0.5rem' }}
          onClick={toggleTheme}
          title={
            state.theme === 'dark'
              ? 'Beralih ke Mode Terang'
              : 'Beralih ke Mode Gelap (Dark Workbench)'
          }
          aria-label="Ganti tema terang atau gelap"
        >
          {state.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          type="button"
          id="btn-run-all-modules"
          className="btn btn-primary btn-sm tab-num"
          disabled={state.isRunning || enabledCount === 0}
          onClick={() => void runAll(true)}
          title="Jalankan seluruh metode aktif secara paralel (Ctrl+Enter)"
        >
          <Play size={13} />
          <span className="btn-run-label-full">
            {state.isRunning && state.progress
              ? `Memproses ${state.progress.completed}/${state.progress.total}…`
              : `Jalankan (${enabledCount})`}
          </span>
          <span className="btn-run-label-short">
            {state.isRunning && state.progress
              ? `${state.progress.completed}/${state.progress.total}`
              : `(${enabledCount})`}
          </span>
        </button>
      </div>
    </header>
  );
}

