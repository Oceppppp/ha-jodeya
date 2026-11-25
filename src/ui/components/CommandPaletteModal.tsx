import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GitBranch,
  LayoutGrid,
  Moon,
  Play,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Sun,
  UploadCloud,
  X,
} from 'lucide-react';
import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';

interface PaletteItem {
  id: string;
  group: 'Pekerjaan Aktif' | 'Aksi Cepat' | 'Tambah Metode PPIC';
  code: string;
  label: string;
  sublabel: string;
  run: () => void;
}

export function CommandPaletteModal() {
  const { state } = useWorkspace();
  if (!state.showCommandPalette) return null;
  return <CommandPaletteDialog />;
}

function CommandPaletteDialog() {
  const {
    state,
    selectJob,
    addModuleJob,
    setView,
    runAll,
    loadPpic4StagePreset,
    toggleTheme,
    triggerFullPdfReport,
    setShowCommandPalette,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const allItems = useMemo<PaletteItem[]>(() => {
    const close = () => setShowCommandPalette(false);

    const jobItems: PaletteItem[] = state.jobs.map((job) => {
      const meta = MODULE_MAP[job.moduleId];
      return {
        id: `job-${job.id}`,
        group: 'Pekerjaan Aktif',
        code: meta.code,
        label: job.title,
        sublabel: `Buka editor & penjelasan 6-pilar · ${meta.indonesianName}`,
        run: () => {
          selectJob(job.id, true);
          close();
        },
      };
    });

    const quickActions: PaletteItem[] = [
      {
        id: 'act-run-all',
        group: 'Aksi Cepat',
        code: 'RUN',
        label: `Jalankan Semua Metode (${state.jobs.filter((j) => j.enabled).length})`,
        sublabel: 'Eksekusi paralel di Web Worker Pool · Ctrl+Enter',
        run: () => {
          close();
          void runAll(true);
        },
      },
      {
        id: 'act-view-batch',
        group: 'Aksi Cepat',
        code: 'VIEW',
        label: 'Buka Ringkasan 4-Tahap PPIC',
        sublabel: 'Health strip, matriks batch, dan perbandingan What-If',
        run: () => {
          setView('batch-results');
          close();
        },
      },
      {
        id: 'act-view-pipeline',
        group: 'Aksi Cepat',
        code: 'DAG',
        label: 'Buka Pipeline Integrasi 4-Tahap',
        sublabel: 'Forecasting → MPS → MRP → Scheduling',
        run: () => {
          setView('pipeline');
          close();
        },
      },
      {
        id: 'act-view-upload',
        group: 'Aksi Cepat',
        code: 'IO',
        label: 'Upload Berkas Excel / CSV / JSON / JS',
        sublabel: 'Impor multi-sheet & interactive column mapping',
        run: () => {
          setView('file-upload');
          close();
        },
      },
      {
        id: 'act-load-ppic4',
        group: 'Aksi Cepat',
        code: 'PPIC',
        label: 'Muat Preset Rantai PPIC 4-Tahap Terpadu',
        sublabel: 'Reset & jalankan alur penuh FC → MPS → MRP → SC',
        run: () => {
          close();
          loadPpic4StagePreset(true);
        },
      },
      {
        id: 'act-pdf-full',
        group: 'Aksi Cepat',
        code: 'PDF',
        label: 'Cetak / Simpan Laporan PDF Lengkap',
        sublabel: 'Halaman sampul + seluruh 6 Pilar Penjelasan',
        run: () => {
          close();
          triggerFullPdfReport();
        },
      },
      {
        id: 'act-theme',
        group: 'Aksi Cepat',
        code: 'UI',
        label:
          state.theme === 'dark'
            ? 'Beralih ke Mode Terang (Light)'
            : 'Beralih ke Mode Gelap (Dark Workbench)',
        sublabel: 'Ubah palet permukaan aplikasi',
        run: () => {
          toggleTheme();
          close();
        },
      },
    ];

    const addItems: PaletteItem[] = MODULE_REGISTRY.map((mod) => ({
      id: `add-${mod.id}`,
      group: 'Tambah Metode PPIC',
      code: mod.code,
      label: `Tambah ${mod.stageNumber} · ${mod.indonesianName}`,
      sublabel: mod.name,
      run: () => {
        addModuleJob(mod.id);
        close();
      },
    }));

    return [...jobItems, ...quickActions, ...addItems];
  }, [
    addModuleJob,
    loadPpic4StagePreset,
    runAll,
    selectJob,
    setShowCommandPalette,
    setView,
    state.jobs,
    state.theme,
    toggleTheme,
    triggerFullPdfReport,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.sublabel.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  const safeIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

  return (
    <div
      className="modal-backdrop no-print"
      onClick={() => setShowCommandPalette(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette Ha Jodeya"
    >
      <div className="command-palette-card" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-header">
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            id="input-command-palette"
            className="command-palette-input"
            placeholder="Cari pekerjaan, tambah metode (FC, MPS, MR, SC), atau perintah…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((prev) => Math.min(filtered.length - 1, prev + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((prev) => Math.max(0, prev - 1));
              } else if (e.key === 'Enter' && filtered[safeIdx]) {
                e.preventDefault();
                filtered[safeIdx].run();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setShowCommandPalette(false)}
            aria-label="Tutup Command Palette"
          >
            <X size={14} />
          </button>
        </div>

        <div className="command-palette-list">
          {filtered.map((item, idx) => {
            const showGroupHeader = idx === 0 || filtered[idx - 1].group !== item.group;
            return (
              <div key={item.id}>
                {showGroupHeader && <div className="command-palette-group">{item.group}</div>}
                <button
                  type="button"
                  className={`command-palette-item ${idx === safeIdx ? 'active' : ''}`}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={item.run}
                >
                  <span className="job-code">{item.code}</span>
                  <span className="command-palette-item-main">
                    <span className="command-palette-item-title">{item.label}</span>
                    <span className="command-palette-item-sub">{item.sublabel}</span>
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {item.group === 'Tambah Metode PPIC' ? (
                      <Plus size={12} />
                    ) : item.id === 'act-run-all' ? (
                      <Play size={12} />
                    ) : item.id === 'act-view-batch' ? (
                      <LayoutGrid size={12} />
                    ) : item.id === 'act-view-upload' ? (
                      <UploadCloud size={12} />
                    ) : item.id === 'act-view-pipeline' || item.id === 'act-load-ppic4' ? (
                      <GitBranch size={12} />
                    ) : item.id === 'act-pdf-full' ? (
                      <Printer size={12} />
                    ) : item.id === 'act-theme' ? (
                      state.theme === 'dark' ? (
                        <Sun size={12} />
                      ) : (
                        <Moon size={12} />
                      )
                    ) : (
                      <SlidersHorizontal size={12} />
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="command-palette-footer mono-num">
          <span>↑↓ Navigasi</span>
          <span>Enter Pilih</span>
          <span>Esc Tutup</span>
          <span>Ctrl+Enter Jalankan Semua</span>
        </div>
      </div>
    </div>
  );
}
