import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  ShieldAlert,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { approvalService } from '../services/approval.service';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { QuotationApprovalDialog } from '../components/approval/QuotationApprovalDialog';

export const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuth();
  const isSalesHead = user?.role === 'SALES_HEAD';

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Review Dialog State
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query Approval Queue
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['approval-queue', { page, limit, search: debouncedSearch }],
    queryFn: () =>
      approvalService.getApprovalQueue({
        page,
        limit,
        search: debouncedSearch || undefined,
      }),
    enabled: isSalesHead,
  });

  const items = data?.items || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const formatInr = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Metrics
  const totalPending = pagination.total;

  if (!isSalesHead) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <Card className="bg-slate-900 border-red-800/80">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Access Restricted — Sales Head Role Required</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              The Commercial Approval Queue is reserved strictly for the SALES_HEAD role. Estimator accounts can track their submitted quotations in the Part Costing and Quotations workspaces.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CheckSquare className="h-6 w-6 text-purple-400" />
            <span>Commercial Approval Queue</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Commercial sign-off desk for quotations exceeding the ₹25,00,000 annual pre-GST threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-500/10 font-mono text-xs">
            Sales Head Authority
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-slate-800 text-slate-300 hover:text-white h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Quotations Pending Sign-off
              </span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">
                {totalPending}
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Threshold Rule
              </span>
              <span className="text-base font-bold font-mono text-amber-400 mt-1 block">
                &ge; ₹25,00,000 Pre-GST
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Queue Sort Order
              </span>
              <span className="text-sm font-semibold text-slate-200 mt-1 block">
                Oldest Submissions First
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by quote number, RFQ number, customer name, or estimator..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 bg-slate-950 border-slate-800 text-slate-200 text-sm h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Pending Commercial Sign-offs</span>
            </CardTitle>
            <span className="text-xs text-slate-400">
              Showing {items.length} of {totalPending} quotations
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading commercial approval queue...</span>
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-400">
              Failed to load approval queue: {(error as any)?.message || 'Server error'}
            </div>
          ) : items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/70">
                  <TableRow className="border-slate-800 text-[11px]">
                    <TableHead className="text-slate-400">Quote Number</TableHead>
                    <TableHead className="text-slate-400">RFQ Number</TableHead>
                    <TableHead className="text-slate-400">Customer</TableHead>
                    <TableHead className="text-slate-400">Estimator</TableHead>
                    <TableHead className="text-slate-400">Submitted At</TableHead>
                    <TableHead className="text-right text-slate-400">Highest Pre-GST Value</TableHead>
                    <TableHead className="text-center text-slate-400">Approval Requirement</TableHead>
                    <TableHead className="text-right text-slate-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {items.map((item) => (
                    <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/30">
                      <TableCell className="font-mono font-bold text-amber-400">
                        {item.quoteNumber}
                        <span className="ml-1.5 text-[10px] text-slate-500 font-normal">
                          (v{item.version})
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-300">
                        {item.rfq?.rfqNumber}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-200">
                        {item.rfq?.customer?.name}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {item.createdBy?.name || 'Estimator'}
                      </TableCell>
                      <TableCell className="font-mono text-slate-400">
                        {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-amber-400 bg-amber-500/5">
                        {formatInr(item.highestAnnualPreGstValue)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 text-amber-400 bg-amber-500/10 text-[10px]"
                        >
                          &ge; ₹25 Lakh (Sign-off)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedQuotationId(item.id);
                            setReviewDialogOpen(true);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-8 gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review & Decide
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500 space-y-2">
              <CheckSquare className="h-8 w-8 mx-auto text-slate-600 mb-2" />
              <p className="font-semibold text-slate-400">No Quotations Pending Sign-off</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All submitted commercial quotes have been reviewed. When an estimator submits a quotation exceeding ₹25,00,000, it will appear here.
              </p>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage}
                  className="border-slate-800 h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage}
                  className="border-slate-800 h-8 gap-1 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <QuotationApprovalDialog
        quotationId={selectedQuotationId}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onDecisionSubmitted={() => {
          refetch();
        }}
      />
    </div>
  );
};

export default ApprovalQueuePage;
