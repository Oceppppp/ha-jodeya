import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext.ts';

export function SystemStatusBanners() {
  const { state, dismissStorageWarning } = useWorkspace();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let mounted = true;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || !mounted) return;
      if (reg.waiting) setWaitingWorker(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller && mounted) {
            setWaitingWorker(nw);
          }
        });
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!state.storageWarning && !waitingWorker) return null;

  return (
    <div
      className="no-print"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '0.4rem 1.25rem 0',
      }}
    >
      {state.storageWarning && (
        <div
          className="alert-strip alert-warning"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={13} /> {state.storageWarning}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={dismissStorageWarning}
            aria-label="Tutup peringatan penyimpanan"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {waitingWorker && (
        <div
          className="alert-strip alert-info"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
        >
          <span>Versi terbaru Ha Jodeya tersedia dan siap diaktifkan.</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }}
          >
            <RefreshCw size={12} /> Muat Ulang Sekarang
          </button>
        </div>
      )}
    </div>
  );
}
