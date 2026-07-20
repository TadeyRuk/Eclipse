import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { EmployerPage } from './pages/EmployerPage';
import { ObserverPage } from './pages/ObserverPage';
import { EmployeePage } from './pages/EmployeePage';

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/employer" replace />} />
        <Route path="/employer" element={<EmployerPage />} />
        <Route path="/observer" element={<ObserverPage />} />
        <Route path="/employee" element={<EmployeePage />} />
      </Routes>
    </Shell>
  );
}
