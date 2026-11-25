import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Terjadi kesalahan tampilan tidak terduga.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Ha Jodeya ErrorBoundary:', error, info);
  }

  private handleDownloadBackup = () => {
    try {
      const raw = localStorage.getItem('ha_jodeya_projects_v1') ?? '{}';
      const blob = new Blob([raw], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ha_Jodeya_Backup_Recovery.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore backup error
    }
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('ha_jodeya_projects_v1');
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ maxWidth: 560, margin: '10vh auto', padding: '1.5rem' }}>
        <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <strong style={{ fontSize: 'var(--text-lg)' }}>
            Pemulihan Workspace Ha Jodeya
          </strong>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Antarmuka mengalami kendala ({this.state.message}). Unduh cadangan data lokal Anda terlebih dahulu sebelum me-reset sesi.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={this.handleDownloadBackup}>
              Unduh Backup .json
            </button>
            <button type="button" className="btn btn-primary" onClick={this.handleReset}>
              Reset &amp; Muat Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
