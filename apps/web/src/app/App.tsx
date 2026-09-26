import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { EclipseRuntimeProvider, type EclipseRuntime } from '../shared/runtime/EclipseRuntime';
import { PageTransition } from '../shared/motion';
import { AppShell } from './AppShell';
import { EmployerPage } from '../features/employer';
import { ObserverPage } from '../features/observer';
import { EmployeePage } from '../features/employee';

export function App({ runtime }: { runtime: EclipseRuntime }) {
  const location = useLocation();

  return (
    <EclipseRuntimeProvider runtime={runtime}>
      <AppShell>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/employer" replace />} />
              <Route path="/employer" element={<EmployerPage />} />
              <Route path="/observer" element={<ObserverPage />} />
              <Route path="/employee" element={<EmployeePage />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </AppShell>
    </EclipseRuntimeProvider>
  );
}
