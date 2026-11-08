import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RfqRegisterPage from './pages/RfqRegisterPage';
import PartCostingPage from './pages/PartCostingPage';
import RateMastersPage from './pages/RateMastersPage';
import ApprovalQueuePage from './pages/ApprovalQueuePage';
import QuotationsPage from './pages/QuotationsPage';
import HistoricalQuotesPage from './pages/HistoricalQuotesPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public login route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Dashboard Layout and Sub-routes */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Index route redirects to /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Shared RFQ Register (Estimator: Full Control; Sales Head: Read-Only) */}
          <Route
            path="/rfqs"
            element={
              <ProtectedRoute allowedRoles={['ESTIMATOR', 'SALES_HEAD']}>
                <RfqRegisterPage />
              </ProtectedRoute>
            }
          />

          {/* Part Costing (Estimator: Full Control; Sales Head: Read-Only View) */}
          <Route
            path="/costing"
            element={
              <ProtectedRoute allowedRoles={['ESTIMATOR', 'SALES_HEAD']}>
                <PartCostingPage />
              </ProtectedRoute>
            }
          />
          {/* Shared Rate Masters (Estimator: Full Control; Sales Head: Read-Only) */}
          <Route
            path="/rate-masters"
            element={
              <ProtectedRoute allowedRoles={['ESTIMATOR', 'SALES_HEAD']}>
                <RateMastersPage />
              </ProtectedRoute>
            }
          />

          {/* Sales Head-only routes */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute allowedRoles={['SALES_HEAD']}>
                <ApprovalQueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations"
            element={
              <ProtectedRoute allowedRoles={['SALES_HEAD']}>
                <QuotationsPage />
              </ProtectedRoute>
            }
          />

          {/* Shared protected route */}
          <Route
            path="/historical-quotes"
            element={
              <ProtectedRoute allowedRoles={['ESTIMATOR', 'SALES_HEAD']}>
                <HistoricalQuotesPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
