import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Factory,
  LayoutDashboard,
  FileSpreadsheet,
  Calculator,
  Coins,
  History,
  CheckSquare,
  FileText,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isEstimator = user?.role === 'ESTIMATOR';
  const isSalesHead = user?.role === 'SALES_HEAD';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block">ForgeQuote</span>
              <span className="text-[11px] text-slate-400 font-mono">Cost Estimation OS</span>
            </div>
          </div>

          {/* User Profile Mini Banner */}
          <div className="p-4 mx-3 my-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Role</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono py-0 font-bold ${
                  isSalesHead
                    ? 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                    : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                }`}
              >
                {user?.role}
              </Badge>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {isEstimator ? 'Estimator Workspace' : 'Commercial Desk'}
            </div>

            {/* Common: Dashboard */}
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </NavLink>

            {/* ESTIMATOR Role Links */}
            {isEstimator && (
              <>
                <NavLink
                  to="/rfqs"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>RFQ Register</span>
                </NavLink>

                <NavLink
                  to="/costing"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Calculator className="h-4 w-4" />
                  <span>Part Costing</span>
                </NavLink>

                <NavLink
                  to="/rate-masters"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Coins className="h-4 w-4" />
                  <span>Rate Masters</span>
                </NavLink>
              </>
            )}

            {/* SALES_HEAD Role Links */}
            {isSalesHead && (
              <>
                <NavLink
                  to="/rfqs"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>RFQ Register</span>
                </NavLink>

                <NavLink
                  to="/costing"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Calculator className="h-4 w-4" />
                  <span>Part Costing</span>
                </NavLink>

                <NavLink
                  to="/approvals"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>Approval Queue</span>
                </NavLink>

                <NavLink
                  to="/quotations"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <FileText className="h-4 w-4" />
                  <span>Quotations</span>
                </NavLink>

                <NavLink
                  to="/rate-masters"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Coins className="h-4 w-4" />
                  <span>Rate Masters</span>
                </NavLink>
              </>
            )}

            {/* Common: Historical Quotes */}
            <NavLink
              to="/historical-quotes"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <History className="h-4 w-4" />
              <span>Historical Quotes</span>
            </NavLink>
          </nav>
        </div>

        {/* Sidebar Footer: Sign Out */}
        <div className="p-4 border-t border-slate-800">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 border-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs py-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-white font-medium capitalize">
              {window.location.pathname.replace('/', '') || 'Dashboard'}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>API Connected (0.0.0.0:5000)</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

