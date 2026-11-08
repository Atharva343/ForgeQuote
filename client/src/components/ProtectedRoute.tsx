import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Factory, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 animate-pulse">
            <Factory className="h-7 w-7" />
          </div>
          <div className="text-sm font-medium text-slate-400">Verifying ForgeQuote session...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-5">
          <div className="h-12 w-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-sm text-slate-400">
            Your role (<span className="text-amber-400 font-semibold">{user.role}</span>) does not have authorization to view this resource.
          </p>
          <div className="pt-2">
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : null;
};

export default ProtectedRoute;

