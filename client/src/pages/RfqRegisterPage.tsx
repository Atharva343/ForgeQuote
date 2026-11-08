import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Pencil,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { rfqService } from '../services/rfq.service';
import { customerService } from '../services/customer.service';
import { useAuth } from '../contexts/AuthContext';
import { RfqStatus, RfqQueryParams } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { CreateRfqDialog } from '../components/rfq/CreateRfqDialog';
import { RfqDetailSheet } from '../components/rfq/RfqDetailSheet';
import { RfqIntakeDialog } from '../components/intake/RfqIntakeDialog';

export const RfqRegisterPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEstimator = user?.role === 'ESTIMATOR';

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<RfqStatus | ''>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [sortBy, setSortBy] = useState<'receivedAt' | 'dueDate' | 'rfqNumber'>('receivedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [intakeDialogOpen, setIntakeDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch registered customers for filter dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: customerService.getCustomers,
  });

  // Query parameters object
  const queryParams: RfqQueryParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: selectedStatus || undefined,
    customerId: selectedCustomerId || undefined,
    sortBy,
    sortOrder,
  };

  // Fetch RFQs
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['rfqs', queryParams],
    queryFn: () => rfqService.getRfqs(queryParams),
    placeholderData: (previousData) => previousData,
  });

  const rfqs = data?.rfqs || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const handleSortToggle = (field: 'receivedAt' | 'dueDate' | 'rfqNumber') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const openDetailSheet = (rfqId: string) => {
    setSelectedRfqId(rfqId);
    setDetailSheetOpen(true);
  };

  const getStatusBadge = (status: RfqStatus) => {
    switch (status) {
      case 'ESTIMATING':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[11px] font-bold">
            ESTIMATING
          </Badge>
        );
      case 'SENT':
        return (
          <Badge variant="outline" className="border-sky-500/40 text-sky-400 bg-sky-500/10 text-[11px] font-bold">
            SENT
          </Badge>
        );
      case 'WON':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[11px] font-bold">
            WON
          </Badge>
        );
      case 'LOST':
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-[11px] font-bold">
            LOST
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <FileSpreadsheet className="h-6 w-6 text-amber-500" />
              <span>RFQ Register</span>
            </h1>
            <Badge
              variant="outline"
              className={
                isEstimator
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs'
                  : 'border-purple-500/40 text-purple-400 bg-purple-500/10 text-xs'
              }
            >
              {isEstimator ? 'Estimator Intake & Management' : 'Commercial Desk View (Read-Only)'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manufacturing Request for Quotation intake, parts manifest, drawing revisions, and live estimation tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isEstimator && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIntakeDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs h-9 shadow-sm"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                <span>AI Intake</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                <span>Manual RFQ</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900/90 border-slate-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by RFQ #, Customer, Part name or Part #..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs focus-visible:ring-amber-500"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as RfqStatus | '');
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Statuses (Estimating, Sent, Won, Lost)</option>
              <option value="ESTIMATING">Estimating</option>
              <option value="SENT">Sent</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="md:col-span-4">
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.industry})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {(debouncedSearch || selectedStatus || selectedCustomerId) && (
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-800/80 text-xs text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
            <span>Active Filters:</span>
            {debouncedSearch && (
              <span className="bg-slate-800 px-2 py-0.5 rounded text-amber-400 font-mono text-[11px]">
                Search: "{debouncedSearch}"
              </span>
            )}
            {selectedStatus && (
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 text-[11px]">
                Status: {selectedStatus}
              </span>
            )}
            {selectedCustomerId && (
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 text-[11px]">
                Customer: {customers.find((c) => c.id === selectedCustomerId)?.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setDebouncedSearch('');
                setSelectedStatus('');
                setSelectedCustomerId('');
                setPage(1);
              }}
              className="text-xs h-6 px-2 text-slate-400 hover:text-white"
            >
              Clear All
            </Button>
          </div>
        )}
      </Card>

      {/* RFQ Register Data Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center justify-center space-x-2 text-slate-400 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
              <span>Querying Neon PostgreSQL database...</span>
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-950/60 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Failed to retrieve RFQ records</p>
            <p className="text-xs text-slate-400">{(error as any)?.message || 'Database connection error'}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="border-slate-700">
              Try Again
            </Button>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">No RFQ records found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {debouncedSearch || selectedStatus || selectedCustomerId
                ? 'No matching RFQs match your search and filter criteria. Try adjusting or clearing your filters.'
                : 'No RFQ records currently registered in the database.'}
            </p>
            {isEstimator && (
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Register First RFQ
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/80 border-b border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-800">
                  <TableHead className="text-slate-400 text-xs font-semibold py-3 pl-4">
                    <button
                      onClick={() => handleSortToggle('rfqNumber')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>RFQ NUMBER</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-500" />
                    </button>
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3">CUSTOMER</TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3">PART / MANIFEST</TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3">
                    <button
                      onClick={() => handleSortToggle('receivedAt')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>RECEIVED</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-500" />
                    </button>
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3">
                    <button
                      onClick={() => handleSortToggle('dueDate')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>DUE DATE</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-500" />
                    </button>
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3">ESTIMATOR / OWNER</TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3">STATUS</TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold py-3 text-right pr-4">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-slate-800/60">
                {rfqs.map((rfq) => {
                  const mainPart = rfq.parts?.[0];
                  const totalParts = rfq.parts?.length || 0;

                  return (
                    <TableRow
                      key={rfq.id}
                      className="hover:bg-slate-800/40 transition-colors border-slate-800/60"
                    >
                      {/* RFQ Number */}
                      <TableCell className="py-3 pl-4">
                        <button
                          onClick={() => openDetailSheet(rfq.id)}
                          className="font-mono text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-left transition-colors"
                        >
                          {rfq.rfqNumber}
                        </button>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                          {rfq.title}
                        </div>
                      </TableCell>

                      {/* Customer */}
                      <TableCell className="py-3 text-xs">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[150px]">{rfq.customer.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{rfq.customer.industry}</div>
                      </TableCell>

                      {/* Part Information */}
                      <TableCell className="py-3 text-xs">
                        {mainPart ? (
                          <div>
                            <div className="font-medium text-slate-200 truncate max-w-[200px]">
                              {mainPart.partName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono text-slate-400">
                                {mainPart.partNumber || mainPart.material}
                              </span>
                              {totalParts > 1 && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 border-slate-700 bg-slate-800 text-slate-400"
                                >
                                  +{totalParts - 1} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No parts</span>
                        )}
                      </TableCell>

                      {/* Received Date */}
                      <TableCell className="py-3 text-xs text-slate-300 font-mono">
                        {new Date(rfq.receivedAt).toLocaleDateString()}
                      </TableCell>

                      {/* Due Date */}
                      <TableCell className="py-3 text-xs font-mono">
                        {rfq.dueDate ? (
                          <span className="text-slate-300">
                            {new Date(rfq.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic font-sans">Not set</span>
                        )}
                      </TableCell>

                      {/* Owner */}
                      <TableCell className="py-3 text-xs">
                        <div className="font-medium text-slate-300 truncate max-w-[120px]">
                          {rfq.owner?.name || 'Unassigned'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {rfq.owner?.email ? rfq.owner.email.split('@')[0] : '—'}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        {getStatusBadge(rfq.status)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View RFQ Details"
                            onClick={() => openDetailSheet(rfq.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {isEstimator && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit / Update Status"
                              onClick={() => openDetailSheet(rfq.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination & Metadata Bar */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{rfqs.length}</strong> of{' '}
            <strong className="text-white">{pagination.total}</strong> RFQ records
            {pagination.totalPages > 1 && (
              <span className="ml-2 font-mono text-slate-500">
                (Page {pagination.page} of {pagination.totalPages})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage || isFetching}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              <span>Previous</span>
            </Button>

            <span className="text-slate-500 font-mono px-2">
              {pagination.page} / {pagination.totalPages || 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage || isFetching}
              onClick={() => setPage((prev) => prev + 1)}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* AI-Assisted RFQ Intake Dialog */}
      <RfqIntakeDialog
        open={intakeDialogOpen}
        onOpenChange={setIntakeDialogOpen}
        onCreated={(rfqId) => {
          queryClient.invalidateQueries({ queryKey: ['rfqs'] });
          if (rfqId) {
            openDetailSheet(rfqId);
          }
        }}
      />

      {/* Create RFQ Dialog */}
      <CreateRfqDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['rfqs'] });
        }}
      />

      {/* RFQ Detail & Edit Sheet */}
      <RfqDetailSheet
        rfqId={selectedRfqId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onStatusUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['rfqs'] });
        }}
      />
    </div>
  );
};

export default RfqRegisterPage;
