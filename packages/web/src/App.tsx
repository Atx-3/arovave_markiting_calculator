import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPanel } from './pages/admin/AdminPanel';
import { SalesCalculator } from './pages/sales/SalesCalculator';

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<SalesCalculator />} />
                    <Route path="admin" element={<AdminPanel />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
