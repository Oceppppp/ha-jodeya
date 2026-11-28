import { useState } from 'react';
import { ArrowRight, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { buildPipelineExecutionStages } from '../../core/pipeline/pipelineResolver.ts';
import { MODULE_MAP } from '../../core/registry/moduleRegistry.ts';
import { useWorkspace } from '../../store/workspaceContext.ts';
import { SvgPipelineDag } from './charts/SvgPipelineDag.tsx';

export function PipelineLinker() {
  const {
    state,
    addLink,
    removeLink,
    runAll,
    selectJob,
    loadPpic4StagePreset,
  } = useWorkspace();

  const sourceCandidates = state.jobs.filter(
    (j) => MODULE_MAP[j.moduleId].exportableOutputs.length > 0,
  );
  const targetCandidates = state.jobs.filter(
    (j) => MODULE_MAP[j.moduleId].injectableTargets.length > 0,
  );

  const [sourceJobId, setSourceJobId] = useState(sourceCandidates[0]?.id ?? '');
  const [sourceOutputKey, setSourceOutputKey] = useState('');
  const [targetJobId, setTargetJobId] = useState(targetCandidates[0]?.id ?? '');
  const [targetField, setTargetField] = useState('');
  const [multiplier, setMultiplier] = useState(1);

  const effectiveSourceJobId = sourceCandidates.some((j) => j.id === sourceJobId)
    ? sourceJobId
    : (sourceCandidates[0]?.id ?? '');
  const selectedSource = state.jobs.find((j) => j.id === effectiveSourceJobId);
  const exportableKeys = selectedSource
    ? MODULE_MAP[selectedSource.moduleId].exportableOutputs
    : [];
  const effectiveSourceKey = exportableKeys.some((k) => k.key === sourceOutputKey)
    ? sourceOutputKey
    : (exportableKeys[0]?.key ?? '');

  const effectiveTargetJobId = targetCandidates.some((j) => j.id === targetJobId)
    ? targetJobId
    : (targetCandidates[0]?.id ?? '');
  const selectedTarget = state.jobs.find((j) => j.id === effectiveTargetJobId);
  const injectableFields = selectedTarget
    ? MODULE_MAP[selectedTarget.moduleId].injectableTargets
    : [];
  const effectiveTargetField = injectableFields.some((f) => f.field === targetField)
    ? targetField
    : (injectableFields[0]?.field ?? '');

  const plan = buildPipelineExecutionStages(state.jobs, state.links);

  const handleAdd = () => {
    if (
      !effectiveSourceJobId ||
      !effectiveTargetJobId ||
      effectiveSourceJobId === effectiveTargetJobId ||
      !effectiveSourceKey ||
      !effectiveTargetField
    ) {
      return;
    }
    addLink({
      sourceJobId: effectiveSourceJobId,
      sourceOutputKey: effectiveSourceKey,
      targetJobId: effectiveTargetJobId,
      targetField: effectiveTargetField,
      multiplier,
    });
  };

  return (
    <>
      <header className="view-header">
        <div>
          <div className="view-eyebrow">SINKRONISASI RANTAI PPIC · KAHN TOPOLOGICAL DAG</div>
          <h1 className="view-heading">Pipeline Integrasi 4-Tahap PPIC</h1>
          <p className="view-lead">
            Tautkan output hulu ke input hilir secara otomatis: <strong>Forecasting → MPS → MRP → Scheduling</strong>. Setiap perubahan permintaan langsung merambat ke seluruh tahapan produksi.
          </p>
        </div>

        <div className="view-header-actions no-print">
          <button
            type="button"
            id="btn-load-ppic-preset"
            className="btn btn-sm"
            onClick={() => loadPpic4StagePreset(true)}
          >
            <Sparkles size={13} /> Muat Preset Rantai PPIC 4-Tahap
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={state.jobs.filter((j) => j.enabled).length === 0}
            onClick={() => void runAll(true)}
          >
            <Play size={13} /> Jalankan Pipeline
          </button>
        </div>
      </header>

      {plan.hasCycle && (
        <div className="alert-strip alert-warning">
          Terdeteksi siklus sambungan antar-metode. Hapus salah satu sambungan melingkar agar alur mengikuti arah hulu ke hilir.
        </div>
      )}

      {/* Visual DAG */}
      <SvgPipelineDag
        stages={plan.stages}
        links={state.links}
        resultsByJobId={state.batchSummary?.resultsByJobId}
        onSelectJob={(id) => selectJob(id, true)}
      />

      {/* Link Builder */}
      <section className="surface-panel no-print" aria-label="Tambah Sambungan Parameter">
        <div className="sheet-section-label">01 · Tambah Sambungan Parameter Antar-Metode</div>

        <div className="pipeline-builder-grid">
          <div className="field-group">
            <label className="field-label">Metode Sumber (Hulu)</label>
            <select
              className="form-control"
              value={effectiveSourceJobId}
              onChange={(e) => setSourceJobId(e.target.value)}
            >
              {sourceCandidates.map((j) => (
                <option key={j.id} value={j.id}>
                  [{MODULE_MAP[j.moduleId].code}] {j.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">Output yang Dikirim</label>
            <select
              className="form-control"
              value={effectiveSourceKey}
              onChange={(e) => setSourceOutputKey(e.target.value)}
            >
              {exportableKeys.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">Metode Tujuan (Hilir)</label>
            <select
              className="form-control"
              value={effectiveTargetJobId}
              onChange={(e) => setTargetJobId(e.target.value)}
            >
              {targetCandidates.map((j) => (
                <option key={j.id} value={j.id}>
                  [{MODULE_MAP[j.moduleId].code}] {j.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">Parameter Target</label>
            <select
              className="form-control"
              value={effectiveTargetField}
              onChange={(e) => setTargetField(e.target.value)}
            >
              {injectableFields.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">Faktor Pengali</label>
            <input
              type="number"
              step={0.01}
              min={0.001}
              className="form-control mono-num"
              value={multiplier}
              onChange={(e) => setMultiplier(Math.max(0.001, Number(e.target.value) || 1))}
            />
          </div>

          <button type="button" className="btn btn-primary" onClick={handleAdd}>
            <Plus size={13} /> Sambungkan
          </button>
        </div>
      </section>

      {/* Active Links Table */}
      <section className="surface-panel" aria-label="Daftar Sambungan Pipeline Aktif">
        <div className="sheet-section-label">
          02 · Sambungan Aktif ({state.links.length} Tautan)
        </div>

        {state.links.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
            Belum ada sambungan aktif. Tekan <strong>Muat Preset Rantai PPIC 4-Tahap</strong> untuk menghubungkan keempat metode sekaligus.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tahap Sumber</th>
                  <th>Output</th>
                  <th />
                  <th>Tahap Tujuan</th>
                  <th>Parameter Tujuan</th>
                  <th>Pengali</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {state.links.map((lk) => {
                  const src = state.jobs.find((j) => j.id === lk.sourceJobId);
                  const tgt = state.jobs.find((j) => j.id === lk.targetJobId);
                  const srcLabel = src
                    ? MODULE_MAP[src.moduleId].exportableOutputs.find(
                        (o) => o.key === lk.sourceOutputKey,
                      )?.label
                    : undefined;
                  const tgtLabel = tgt
                    ? MODULE_MAP[tgt.moduleId].injectableTargets.find(
                        (t) => t.field === lk.targetField,
                      )?.label
                    : undefined;
                  return (
                    <tr key={lk.id}>
                      <td>
                        <strong>{src?.title ?? lk.sourceJobId}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                          {srcLabel ?? lk.sourceOutputKey}
                        </div>
                        <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {lk.sourceOutputKey}
                        </div>
                      </td>
                      <td style={{ color: 'var(--primary)' }}>
                        <ArrowRight size={14} />
                      </td>
                      <td>
                        <strong>{tgt?.title ?? lk.targetJobId}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                          {tgtLabel ?? lk.targetField}
                        </div>
                        <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {lk.targetField}
                        </div>
                      </td>
                      <td className="mono-num">×{lk.multiplier}</td>
                      <td className="no-print" style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => removeLink(lk.id)}
                          aria-label="Hapus sambungan"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Live Transferred Data Inspector (Shows exact values flowing FC -> MPS -> MRP -> SC) */}
      {state.batchSummary?.transfersByJobId &&
        Object.values(state.batchSummary.transfersByJobId).flat().length > 0 && (
          <section className="surface-panel" aria-label="Inspeksi Data yang Berpindah Antar-Tahap">
            <div className="sheet-section-label">
              03 · Bukti Data yang Berpindah Antar-Tahap (Live)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {Object.values(state.batchSummary.transfersByJobId)
                .flat()
                .map((tr) => {
                  const srcMeta = MODULE_MAP[tr.sourceModuleId];
                  const tgtMeta = MODULE_MAP[tr.targetModuleId];
                  return (
                    <div key={`pipe-tr-${tr.linkId}`} className="pipeline-transfer-card" style={{ marginBottom: 0 }}>
                      <div className="pipeline-transfer-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="stage-pill" style={{ background: srcMeta.stageAccentVar }}>
                            {srcMeta.stageNumber} · {srcMeta.code}
                          </span>
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                          <span className="stage-pill" style={{ background: tgtMeta.stageAccentVar }}>
                            {tgtMeta.stageNumber} · {tgtMeta.code}
                          </span>
                          <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                            {tr.headline}
                          </strong>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => selectJob(tr.targetJobId, true)}
                        >
                          Buka {tgtMeta.code}
                        </button>
                      </div>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {tr.headers.map((h, i) => (
                                <th key={i}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tr.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={cIdx > 0 ? 'mono-num' : undefined}
                                    style={cIdx === 0 ? { fontWeight: 600 } : undefined}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
    </>
  );
}
