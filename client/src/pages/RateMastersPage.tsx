import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  Cpu,
  Plus,
  Search,
  RefreshCw,
  History,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { rateService } from '../services/rate.service';
import { useAuth } from '../contexts/AuthContext';
import { RateValidityStatus, RateQueryParams } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { AddMaterialRateDialog } from '../components/rates/AddMaterialRateDialog';
import { AddMachineRateDialog } from '../components/rates/AddMachineRateDialog';
import { RateHistoryDrawer } from '../components/rates/RateHistoryDrawer';

export const RateMastersPage: React.FC = () => {
  const { user } = useAuth();
  const isEstimator = user?.role === 'ESTIMATOR';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'materials' | 'machines'>('materials');

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'CURRENT' | 'EXPIRED' | 'UPCOMING'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Dialog & Drawer State
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyTargetCode, setHistoryTargetCode] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const queryParams: RateQueryParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: selectedStatus,
    sortBy: 'validFrom',
    sortOrder: 'desc',
  };

  // 1. Fetch Material Rates
  const {
    data: materialData,
    isLoading: isLoadingMaterials,
    isError: isErrorMaterials,
    error: errorMaterials,
    isFetching: isFetchingMaterials,
    refetch: refetchMaterials,
  } = useQuery({
    queryKey: ['materialRates', queryParams],
    queryFn: () => rateService.getMaterialRates(queryParams),
    enabled: activeTab === 'materials',
    placeholderData: (prev) => prev,
  });

  // 2. Fetch Machine Rates
  const {
    data: machineData,
    isLoading: isLoadingMachines,
    isError: isErrorMachines,
    error: errorMachines,
    isFetching: isFetchingMachines,
    refetch: refetchMachines,
  } = useQuery({
    queryKey: ['machineRates', queryParams],
    queryFn: () => rateService.getMachineRates(queryParams),
    enabled: activeTab === 'machines',
    placeholderData: (prev) => prev,
  });

  const materialRates = materialData?.rates || [];
  const materialPagination = materialData?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const machineRates = machineData?.rates || [];
  const machinePagination = machineData?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const openHistory = (code: string) => {
    setHistoryTargetCode(code);
    setHistoryDrawerOpen(true);
  };

  const getStatusBadge = (status: RateValidityStatus) => {
    switch (status) {
      case 'CURRENT':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[11px] font-bold">
            CURRENT
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="outline" className="border-slate-700 text-slate-400 bg-slate-800/80 text-[11px]">
            EXPIRED
          </Badge>
        );
      case 'UPCOMING':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[11px]">
            UPCOMING
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'materials') {
      refetchMaterials();
    } else {
      refetchMachines();
    }
  };

  const isFetchingAny = isFetchingMaterials || isFetchingMachines;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Coins className="h-6 w-6 text-amber-500" />
              <span>Rate Masters Catalog</span>
            </h1>
            <Badge
              variant="outline"
              className={
                isEstimator
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs'
                  : 'border-purple-500/40 text-purple-400 bg-purple-500/10 text-xs'
              }
            >
              {isEstimator ? 'Estimator Rate Authority' : 'Commercial Desk View (Read-Only)'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Global material indices and hourly machine operating rate masters with immutable effective-date versioning.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetchingAny}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetchingAny ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isEstimator && (
            <>
              {activeTab === 'materials' ? (
                <Button
                  size="sm"
                  onClick={() => setAddMaterialOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  <span>New Material Rate</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setAddMachineOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  <span>New Machine Rate</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'materials' | 'machines');
          setSearchInput('');
          setDebouncedSearch('');
          setPage(1);
        }}
        className="w-full space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger
              value="materials"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-xs flex items-center gap-2 px-4 py-1.5"
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Material Rates</span>
            </TabsTrigger>
            <TabsTrigger
              value="machines"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-xs flex items-center gap-2 px-4 py-1.5"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Machine Hourly Rates</span>
            </TabsTrigger>
          </TabsList>

          {/* Search and Status Filters */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                type="text"
                placeholder={activeTab === 'materials' ? 'Search material code / name...' : 'Search operation / machine...'}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 h-8 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 text-xs focus-visible:ring-amber-500"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CURRENT">Current Only</option>
              <option value="EXPIRED">Expired</option>
              <option value="UPCOMING">Upcoming</option>
            </select>
          </div>
        </div>

        {/* Active Filter Pill */}
        {(debouncedSearch || selectedStatus !== 'ALL') && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
            <span>Active Filters:</span>
            {debouncedSearch && (
              <span className="bg-slate-800 px-2 py-0.5 rounded text-amber-400 font-mono text-[11px]">
                Search: "{debouncedSearch}"
              </span>
            )}
            {selectedStatus !== 'ALL' && (
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 text-[11px]">
                Status: {selectedStatus}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setDebouncedSearch('');
                setSelectedStatus('ALL');
                setPage(1);
              }}
              className="text-xs h-5 px-2 text-slate-400 hover:text-white"
            >
              Clear
            </Button>
          </div>
        )}

        {/* =========================================================================
            TAB 1: MATERIAL RATES
           ========================================================================= */}
        <TabsContent value="materials" className="space-y-4 m-0">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-lg">
            {isLoadingMaterials ? (
              <div className="p-8 space-y-4">
                <div className="flex items-center justify-center space-x-2 text-slate-400 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                  <span>Loading Material Rate master versions...</span>
                </div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-slate-950/60 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ) : isErrorMaterials ? (
              <div className="p-8 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
                <p className="text-sm font-semibold text-white">Failed to retrieve material rates</p>
                <p className="text-xs text-slate-400">{(errorMaterials as any)?.message || 'Database error'}</p>
                <Button size="sm" variant="outline" onClick={() => refetchMaterials()} className="border-slate-700">
                  Try Again
                </Button>
              </div>
            ) : materialRates.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                  <Coins className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Material Rates registered</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {debouncedSearch || selectedStatus !== 'ALL'
                    ? 'No material rates match the current filter criteria.'
                    : 'No material rates exist in the catalog yet. Estimators can register raw material benchmark prices with effective date tracking.'}
                </p>
                {isEstimator && (
                  <Button
                    size="sm"
                    onClick={() => setAddMaterialOpen(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add First Material Rate
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/80 border-b border-slate-800">
                    <TableRow className="hover:bg-transparent border-slate-800">
                      <TableHead className="text-slate-400 text-xs font-semibold py-3 pl-4">MATERIAL CODE</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">SPECIFICATION NAME</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">RATE PER KG</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">VALID FROM</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">VALID TO</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">STATUS</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3 text-right pr-4">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody className="divide-y divide-slate-800/60">
                    {materialRates.map((mat) => (
                      <TableRow key={mat.id} className="hover:bg-slate-800/40 transition-colors border-slate-800/60">
                        {/* Code */}
                        <TableCell className="py-3 pl-4">
                          <button
                            onClick={() => openHistory(mat.materialCode)}
                            className="font-mono text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-left transition-colors"
                          >
                            {mat.materialCode}
                          </button>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="py-3 text-xs font-medium text-slate-200">
                          {mat.materialName}
                        </TableCell>

                        {/* Rate */}
                        <TableCell className="py-3 text-xs font-mono font-bold text-white">
                          ₹{mat.ratePerKg.toFixed(2)}{' '}
                          <span className="text-[10px] text-slate-500 font-sans">/ kg ({mat.currency})</span>
                        </TableCell>

                        {/* Valid From */}
                        <TableCell className="py-3 text-xs text-slate-300 font-mono">
                          {new Date(mat.validFrom).toLocaleDateString()}
                        </TableCell>

                        {/* Valid To */}
                        <TableCell className="py-3 text-xs font-mono">
                          {mat.validTo ? (
                            <span className="text-slate-300">{new Date(mat.validTo).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-emerald-400 italic font-sans text-[11px]">Open-ended</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          {getStatusBadge(mat.status)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right pr-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHistory(mat.materialCode)}
                            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 ml-auto"
                          >
                            <History className="h-3.5 w-3.5 text-amber-500" />
                            <span>Version History</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Bar */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                Showing <strong className="text-white">{materialRates.length}</strong> of{' '}
                <strong className="text-white">{materialPagination.total}</strong> material rate records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!materialPagination.hasPrevPage || isFetchingMaterials}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  <span>Previous</span>
                </Button>

                <span className="text-slate-500 font-mono px-2">
                  {materialPagination.page} / {materialPagination.totalPages || 1}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!materialPagination.hasNextPage || isFetchingMaterials}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 2: MACHINE RATES
           ========================================================================= */}
        <TabsContent value="machines" className="space-y-4 m-0">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-lg">
            {isLoadingMachines ? (
              <div className="p-8 space-y-4">
                <div className="flex items-center justify-center space-x-2 text-slate-400 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                  <span>Loading Machine Rate master versions...</span>
                </div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-slate-950/60 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ) : isErrorMachines ? (
              <div className="p-8 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
                <p className="text-sm font-semibold text-white">Failed to retrieve machine rates</p>
                <p className="text-xs text-slate-400">{(errorMachines as any)?.message || 'Database error'}</p>
                <Button size="sm" variant="outline" onClick={() => refetchMachines()} className="border-slate-700">
                  Try Again
                </Button>
              </div>
            ) : machineRates.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                  <Cpu className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Machine Rates found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {debouncedSearch || selectedStatus !== 'ALL'
                    ? 'No machine rates match the current filter criteria.'
                    : 'No machine rates registered in the catalog yet.'}
                </p>
                {isEstimator && (
                  <Button
                    size="sm"
                    onClick={() => setAddMachineOpen(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Machine Rate
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/80 border-b border-slate-800">
                    <TableRow className="hover:bg-transparent border-slate-800">
                      <TableHead className="text-slate-400 text-xs font-semibold py-3 pl-4">OPERATION CODE</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">PROCESS NAME</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">MACHINE DESCRIPTION</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">HOURLY RATE</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">VALID FROM</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">VALID TO</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">STATUS</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold py-3 text-right pr-4">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody className="divide-y divide-slate-800/60">
                    {machineRates.map((mach) => (
                      <TableRow key={mach.id} className="hover:bg-slate-800/40 transition-colors border-slate-800/60">
                        {/* Operation Code */}
                        <TableCell className="py-3 pl-4">
                          <button
                            onClick={() => openHistory(mach.operationCode)}
                            className="font-mono text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-left transition-colors"
                          >
                            {mach.operationCode}
                          </button>
                        </TableCell>

                        {/* Process Name */}
                        <TableCell className="py-3 text-xs font-medium text-slate-200">
                          {mach.operationName}
                        </TableCell>

                        {/* Machine */}
                        <TableCell className="py-3 text-xs text-slate-300">
                          {mach.machineName}
                        </TableCell>

                        {/* Rate */}
                        <TableCell className="py-3 text-xs font-mono font-bold text-white">
                          ₹{mach.hourlyRate.toFixed(2)}{' '}
                          <span className="text-[10px] text-slate-500 font-sans">/ hr ({mach.currency})</span>
                        </TableCell>

                        {/* Valid From */}
                        <TableCell className="py-3 text-xs text-slate-300 font-mono">
                          {new Date(mach.validFrom).toLocaleDateString()}
                        </TableCell>

                        {/* Valid To */}
                        <TableCell className="py-3 text-xs font-mono">
                          {mach.validTo ? (
                            <span className="text-slate-300">{new Date(mach.validTo).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-emerald-400 italic font-sans text-[11px]">Open-ended</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          {getStatusBadge(mach.status)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right pr-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHistory(mach.operationCode)}
                            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 ml-auto"
                          >
                            <History className="h-3.5 w-3.5 text-amber-500" />
                            <span>Version History</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Bar */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                Showing <strong className="text-white">{machineRates.length}</strong> of{' '}
                <strong className="text-white">{machinePagination.total}</strong> machine rate records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!machinePagination.hasPrevPage || isFetchingMachines}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  <span>Previous</span>
                </Button>

                <span className="text-slate-500 font-mono px-2">
                  {machinePagination.page} / {machinePagination.totalPages || 1}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!machinePagination.hasNextPage || isFetchingMachines}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs & Drawers */}
      <AddMaterialRateDialog
        open={addMaterialOpen}
        onOpenChange={setAddMaterialOpen}
        onCreated={() => refetchMaterials()}
      />

      <AddMachineRateDialog
        open={addMachineOpen}
        onOpenChange={setAddMachineOpen}
        onCreated={() => refetchMachines()}
      />

      <RateHistoryDrawer
        type={activeTab === 'materials' ? 'material' : 'machine'}
        code={historyTargetCode}
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        onRateClosed={() => {
          if (activeTab === 'materials') {
            refetchMaterials();
          } else {
            refetchMachines();
          }
        }}
      />
    </div>
  );
};

export default RateMastersPage;
