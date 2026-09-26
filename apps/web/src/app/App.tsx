import { Navigate, Route, Routes } from 'react-router-dom';
import { EclipseRuntimeProvider, type EclipseRuntime } from '../shared/runtime/EclipseRuntime';
import { AppShell } from './AppShell';
import { EmployerPage } from '../pages/EmployerPage';
import { ObserverPage } from '../pages/ObserverPage';
import { EmployeePage } from '../pages/EmployeePage';

export function App({ runtime }: { runtime: EclipseRuntime }) {
  return (
    <EclipseRuntimeProvider runtime={runtime}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/employer" replace />} />
          <Route path="/employer" element={<EmployerPage />} />
          <Route path="/observer" element={<ObserverPage />} />
          <Route path="/employee" element={<EmployeePage />} />
        </Routes>
      </AppShell>
    </EclipseRuntimeProvider>
  );
}
