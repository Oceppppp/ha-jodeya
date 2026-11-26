import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  FolderPlus,
  GitBranch,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { MODULE_MAP, MODULE_REGISTRY } from '../../core/registry/moduleRegistry.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';

export function PpicSpineSidebar() {
  const {
    state,
    selectJob,
    addModuleJob,
    updateJobMeta,
    removeJob,
    loadPpic4StagePreset,
    loadIndependent4Modules,
    clearWorkspace,
    createProject,
    switchProject,
    renameProject,
    deleteProject,
    setSidebarOpen,
  } = useWorkspace();

  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPreset, setNewProjectPreset] = useState<'ppic4' | 'independent4' | 'empty'>(
    'ppic4',
  );
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [queueExpanded, setQueueExpanded] = useState(true);

  const handleCreateProject = () => {
    createProject(newProjectName, newProjectPreset);
    setNewProjectName('');
    setCreatingProject(false);
  };

  const handleCommitRename = () => {
    renameProject(state.activeProjectId, renameDraft);
    setRenamingProject(false);
  };

  return (
    <aside
      className={`sidebar-rail no-print ${state.sidebarOpen ? 'open' : ''}`}
      aria-label="Alur 4 Tahap PPIC dan Antrean Proyek"
    >
      {/* Multi-Project Switcher */}
      <div className="sidebar-section">
        <div className="rail-heading">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <FolderKanban size={12} /> Proyek Lokal ({state.projects.length})
          </span>
          <div style={{ display: 'inline-flex', gap: '2px' }}>
            <button
              type="button"
              id="btn-new-project"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setCreatingProject((v) => !v);
                setRenamingProject(false);
              }}
              title="Buat proyek baru"
              aria-label="Buat proyek baru"
            >
              <FolderPlus size={12} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setRenameDraft(state.activeProjectName);
                setRenamingProject((v) => !v);
                setCreatingProject(false);
              }}
              title="Ubah nama proyek aktif"
              aria-label="Ubah nama proyek aktif"
            >
              <Pencil size={11} />
            </button>
            {state.projects.length > 1 && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => deleteProject(state.activeProjectId)}
                title="Hapus proyek aktif"
                aria-label="Hapus proyek aktif"
              >
                <Trash2 size={11} />
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost mobile-drawer-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup sidebar"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <select
          id="select-active-project"
          className="form-control"
          style={{ height: 30, fontSize: 'var(--text-xs)' }}
          value={state.activeProjectId}
          onChange={(e) => switchProject(e.target.value)}
          aria-label="Pilih proyek aktif"
        >
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.jobCount})
            </option>
          ))}
        </select>

        {renamingProject && (
          <div className="project-inline-form">
            <input
              type="text"
              className="form-control"
              style={{ height: 28, fontSize: 'var(--text-xs)' }}
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitRename();
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCommitRename}>
              Simpan Nama
            </button>
          </div>
        )}

        {creatingProject && (
          <div className="project-inline-form">
            <input
              type="text"
              placeholder="Nama proyek baru…"
              className="form-control"
              style={{ height: 28, fontSize: 'var(--text-xs)' }}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <select
              className="form-control"
              style={{ height: 28, fontSize: 'var(--text-xs)' }}
              value={newProjectPreset}
              onChange={(e) =>
                setNewProjectPreset(e.target.value as 'ppic4' | 'independent4' | 'empty')
              }
            >
              <option value="ppic4">Preset Rantai 4-Tahap Terpadu</option>
              <option value="independent4">4 Metode Tanpa Link</option>
              <option value="empty">Kosong</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateProject}>
              Buat Proyek
            </button>
          </div>
        )}
      </div>

      <hr className="sidebar-divider" />

      {/* THE 4-STAGE PPIC SPINE */}
      <div className="sidebar-section">
        <div className="rail-heading">
          <span>Alur Rantai PPIC (4 Metode)</span>
        </div>

        <div className="spine-stack">
          {MODULE_REGISTRY.map((mod) => {
            const primaryJob = state.jobs.find((j) => j.moduleId === mod.id);
            const res = primaryJob
              ? state.batchSummary?.resultsByJobId[primaryJob.id]
              : undefined;
            const mainKpi = res?.kpis[1] ?? res?.kpis[0];
            const isActive =
              state.activeView === 'module-editor' &&
              Boolean(primaryJob && primaryJob.id === state.activeJobId);

            return (
              <div key={mod.id} className="spine-node-wrap">
                <button
                  type="button"
                  id={`spine-stage-${mod.id}`}
                  className={`spine-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (primaryJob) selectJob(primaryJob.id, true);
                    else addModuleJob(mod.id);
                  }}
                >
                  <span
                    className="spine-stage-badge"
                    style={{ background: mod.stageAccentVar }}
                  >
                    {mod.stageNumber}
                  </span>
                  <span className="spine-card-body">
                    <span className="spine-card-title">
                      {mod.shortLabel}
                      <span className="spine-card-code">{mod.code}</span>
                    </span>
                    <span className="spine-card-sub mono-num">
                      {mainKpi
                        ? `${mainKpi.value}${mainKpi.unit ? ` ${mainKpi.unit}` : ''}`
                        : mod.indonesianName}
                    </span>
                  </span>
                  <span
                    className={`status-dot ${res?.status ?? ''}`}
                    title={res ? `Status: ${res.status}` : 'Belum dijalankan'}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="sidebar-divider" />

      {/* Active Jobs Queue (Supports multiple scenarios/jobs per method) */}
      <div className="sidebar-section">
        <div className="rail-heading">
          <button
            type="button"
            onClick={() => setQueueExpanded((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              color: 'inherit',
            }}
            aria-expanded={queueExpanded}
          >
            {queueExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>Antrean Pekerjaan ({state.jobs.length})</span>
          </button>
          {state.jobs.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ height: 20, padding: '0 4px', fontSize: '0.68rem' }}
              onClick={clearWorkspace}
              title="Kosongkan antrean"
            >
              <RotateCcw size={10} /> Reset
            </button>
          )}
        </div>

        {queueExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {state.jobs.map((job) => {
              const meta = MODULE_MAP[job.moduleId];
              const isSelected =
                state.activeView === 'module-editor' && state.activeJobId === job.id;
              return (
                <div
                  key={job.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.3rem 0.42rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--bg-highlight)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-hairline)'}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={job.enabled}
                    onChange={(e) => updateJobMeta(job.id, { enabled: e.target.checked })}
                    aria-label={`Aktifkan ${job.title}`}
                  />
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 'var(--text-xs)',
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onClick={() => selectJob(job.id, true)}
                  >
                    <span className="mono-num" style={{ color: 'var(--primary)', marginRight: 4 }}>
                      [{meta.code}]
                    </span>
                    {job.title}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    style={{ height: 22, padding: '0 4px' }}
                    onClick={() => removeJob(job.id)}
                    aria-label={`Hapus ${job.title}`}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Compact 1-row 4-column quick-add bar so Preset Cepat fits above the fold */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '4px',
            marginTop: '0.15rem',
          }}
        >
          {MODULE_REGISTRY.map((mod) => (
            <button
              key={`add-${mod.id}`}
              type="button"
              className="btn btn-sm"
              style={{
                padding: '0 0.25rem',
                height: 26,
                fontSize: '0.67rem',
                gap: '2px',
              }}
              title={`Tambah pekerjaan ${mod.indonesianName}`}
              onClick={() => addModuleJob(mod.id)}
            >
              <Plus size={10} /> {mod.code}
            </button>
          ))}
        </div>
      </div>

      <hr className="sidebar-divider" />

      {/* 1-Click Presets */}
      <div className="sidebar-section">
        <div className="rail-heading">
          <span>Preset Cepat</span>
        </div>
        <button
          type="button"
          id="btn-sidebar-preset-ppic4"
          className="btn btn-sm"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onClick={() => loadPpic4StagePreset(true)}
        >
          <GitBranch size={12} /> Rantai PPIC 4-Tahap Terpadu
        </button>
        <button
          type="button"
          className="btn btn-sm"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onClick={() => loadIndependent4Modules(true)}
        >
          <Sparkles size={12} /> Contoh 4 Metode Independen
        </button>
      </div>
    </aside>
  );
}
