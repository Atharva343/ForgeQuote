import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Factory, FileSpreadsheet, CheckSquare, Coins, History, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const isEstimator = user?.role === 'ESTIMATOR';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">
            <Factory className="w-3.5 h-3.5" />
            <span>Industrial RFQ & Costing Suite</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Signed in as{' '}
            <span className="text-amber-400 font-semibold">{user?.role}</span> ({user?.email}).
          </p>
        </div>
        <div>
          <Badge
            variant="outline"
            className="px-3 py-1 font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/10"
          >
            RBAC Session Verified
          </Badge>
        </div>
      </div>

      {/* Role specific metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isEstimator ? (
          <>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span>Assigned RFQs</span>
                  <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                </CardTitle>
                <CardDescription>RFQ-2611-014, 019, 023 seeded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-white">3 Active</div>
                <Link
                  to="/rfqs"
                  className="mt-3 text-xs text-amber-400 hover:text-amber-300 inline-flex items-center space-x-1"
                >
                  <span>Open RFQ Register</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span>Costing Engine</span>
                  <Coins className="h-4 w-4 text-amber-500" />
                </CardTitle>
                <CardDescription>Multi-volume calculation readiness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-white">Ready</div>
                <Link
                  to="/costing"
                  className="mt-3 text-xs text-amber-400 hover:text-amber-300 inline-flex items-center space-x-1"
                >
                  <span>Launch Part Costing</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span>Rate Masters</span>
                  <Coins className="h-4 w-4 text-amber-500" />
                </CardTitle>
                <CardDescription>Standard ₹850, ₹950, ₹1450/hr rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-white">3 Rates</div>
                <Link
                  to="/rate-masters"
                  className="mt-3 text-xs text-amber-400 hover:text-amber-300 inline-flex items-center space-x-1"
                >
                  <span>View Machine Rates</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span>Commercial Approvals</span>
                  <CheckSquare className="h-4 w-4 text-purple-400" />
                </CardTitle>
                <CardDescription>Pending margin sign-offs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-white">0 Pending</div>
                <Link
                  to="/approvals"
                  className="mt-3 text-xs text-purple-400 hover:text-purple-300 inline-flex items-center space-x-1"
                >
                  <span>View Approval Queue</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span>Quotations</span>
                  <FileSpreadsheet className="h-4 w-4 text-purple-400" />
                </CardTitle>
                <CardDescription>Multi-version customer quotes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-white">Drafting</div>
                <Link
                  to="/quotations"
                  className="mt-3 text-xs text-purple-400 hover:text-purple-300 inline-flex items-center space-x-1"
                >
                  <span>Manage Quotations</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span>Historical Quotes</span>
                  <History className="h-4 w-4 text-purple-400" />
                </CardTitle>
                <CardDescription>Rate snapshots & win-loss ratio</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-white">Archive</div>
                <Link
                  to="/historical-quotes"
                  className="mt-3 text-xs text-purple-400 hover:text-purple-300 inline-flex items-center space-x-1"
                >
                  <span>Browse History</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

