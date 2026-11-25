import { WorkspaceProvider } from './store/workspaceStore.tsx';
import { WorkspaceErrorBoundary } from './ui/components/WorkspaceErrorBoundary.tsx';
import { AppShell } from './ui/layouts/AppShell.tsx';

export default function App() {
  return (
    <WorkspaceErrorBoundary>
      <WorkspaceProvider>
        <AppShell />
      </WorkspaceProvider>
    </WorkspaceErrorBoundary>
  );
}
