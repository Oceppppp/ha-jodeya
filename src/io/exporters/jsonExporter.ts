import type { ModuleJob, PipelineLink } from '../../core/types/workspace.types.ts';

export function exportWorkspaceBundleJson(
  jobs: ModuleJob[],
  links: PipelineLink[],
  projectName = 'Ha_Jodeya_Project',
): void {
  const bundle = {
    app: 'Ha Jodeya',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    projectName,
    jobs,
    links,
  };
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 36) || 'Proyek';
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.hajodeya.json`;
  a.click();
  URL.revokeObjectURL(url);
}
