import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Upload,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { historicalQuoteService } from '../services/historical-quote.service';
import { useAuth } from '../contexts/AuthContext';
import {
  HistoricalQuoteRecord,
  HistoricalQuoteQueryParams,
} from '../types/historical-quote.types';
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
import { HistoricalQuoteImportDialog } from '../components/historical/HistoricalQuoteImportDialog';
import { HistoricalQuoteDetailDialog } from '../components/historical/HistoricalQuoteDetailDialog';

export const HistoricalQuotesPage: React.FC = () => {
  const { user } = useAuth();
  const isEstimator = user?.role === 'ESTIMATOR';

  // State for filters & pagination
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minQty, setMinQty] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [sortBy, setSortBy] = useState<
    'quoteDate' | 'quantity' | 'unitPrice' | 'createdAt' | 'customerName' | 'partNumber'
  >('quoteDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HistoricalQuoteRecord | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const queryParams: HistoricalQuoteQueryParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    customerName: customerFilter || undefined,
    material: materialFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    minQuantity: minQty ? parseInt(minQty, 10) : undefined,
    maxQuantity: maxQty ? parseInt(maxQty, 10) : undefined,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['historical-quotes', queryParams],
    queryFn: () => historicalQuoteService.searchQuotes(queryParams),
    placeholderData: (previousData) => previousData,
  });

  const records = data?.records || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const openDetail = (record: HistoricalQuoteRecord) => {
    setSelectedRecord(record);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <History className="h-6 w-6 text-amber-500" />
              <span>Historical Quotations Archive</span>
            </h1>
            <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs font-semibold">
              Reference Only
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Search past customer quotations, inspect legacy pricing archives, and benchmark component rates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isEstimator && (
            <Button
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 shadow-sm"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              <span>Import Excel / CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-200">Rate Governance Policy:</span> Historical records are imported reference archives. They are completely decoupled from current Material Rates, Machine Rates, and active ForgeQuote approval workflows.
        </div>
      </div>

      {/* Search & Filters Card */}
      <Card className="bg-slate-900/90 border-slate-800 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by Quote Ref, Customer, Part # or Description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs focus-visible:ring-amber-500"
            />
          </div>

          {/* Customer Filter */}
          <div className="md:col-span-3">
            <Input
              type="text"
              placeholder="Filter by Customer..."
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
            />
          </div>

          {/* Material Filter */}
          <div className="md:col-span-4">
            <Input
              type="text"
              placeholder="Filter by Material (e.g., AL 6061, SS316L)..."
              value={materialFilter}
              onChange={(e) => {
                setMaterialFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
            />
          </div>
        </div>

        {/* Extended Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-slate-800/60 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Quote Date From:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-8 bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Quote Date To:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-8 bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Min Quantity:</span>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={minQty}
              onChange={(e) => {
                setMinQty(e.target.value);
                setPage(1);
              }}
              className="h-8 bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Max Quantity:</span>
            <Input
              type="number"
              placeholder="e.g. 50000"
              value={maxQty}
              onChange={(e) => {
                setMaxQty(e.target.value);
                setPage(1);
              }}
              className="h-8 bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Historical Quotations Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-950">
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead
                className="text-slate-400 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('quoteDate')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Quote Date</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-slate-400 font-semibold">Quote Ref</TableHead>
              <TableHead
                className="text-slate-400 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('customerName')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Customer</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="text-slate-400 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('partNumber')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Part Details</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-slate-400 font-semibold">Material</TableHead>
              <TableHead
                className="text-slate-400 font-semibold text-right cursor-pointer hover:text-white"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Volume</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="text-slate-400 font-semibold text-right cursor-pointer hover:text-white"
                onClick={() => handleSort('unitPrice')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Historical Price</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-slate-400 font-semibold text-center">Status</TableHead>
              <TableHead className="text-slate-400 font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                    <span>Loading historical quotation records...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-rose-400">
                  Failed to load records. {(error as any)?.message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileSpreadsheet className="w-8 h-8 text-slate-600" />
                    <span className="font-medium text-slate-300">No historical quotations found</span>
                    <span className="text-xs text-slate-500">
                      {isEstimator
                        ? 'Click "Import Excel / CSV" to batch-import historical quotations.'
                        : 'No historical records match your search query.'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow
                  key={record.id}
                  className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                  onClick={() => openDetail(record)}
                >
                  {/* Quote Date */}
                  <TableCell className="text-xs text-slate-300">
                    {record.quoteDate
                      ? new Date(record.quoteDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </TableCell>

                  {/* Quote Ref */}
                  <TableCell className="font-mono text-xs font-semibold text-amber-400">
                    {record.quoteReference}
                  </TableCell>

                  {/* Customer */}
                  <TableCell className="text-xs text-white font-medium">
                    {record.customerName}
                  </TableCell>

                  {/* Part Details */}
                  <TableCell className="text-xs">
                    <div className="font-medium text-slate-200">
                      {record.partDescription || record.partNumber || '—'}
                    </div>
                    {record.partNumber && record.partDescription && (
                      <div className="font-mono text-[11px] text-slate-400">
                        {record.partNumber}
                      </div>
                    )}
                  </TableCell>

                  {/* Material */}
                  <TableCell className="text-xs text-slate-300">
                    {record.material || '—'}
                  </TableCell>

                  {/* Volume */}
                  <TableCell className="text-xs text-right font-mono text-slate-300">
                    {record.quantity ? `${record.quantity.toLocaleString()} pcs` : '—'}
                  </TableCell>

                  {/* Historical Unit Price */}
                  <TableCell className="text-xs text-right font-mono font-semibold text-emerald-400">
                    {record.unitPrice !== null && record.unitPrice !== undefined
                      ? `${record.currency} ${Number(record.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="text-center">
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-[10px]">
                      HISTORICAL
                    </Badge>
                  </TableCell>

                  {/* Action */}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(record);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-3.5 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing {records.length} of {pagination.total.toLocaleString()} records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage || isFetching}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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

      {/* Guided Import Dialog */}
      <HistoricalQuoteImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => {
          refetch();
        }}
      />

      {/* Record Detail Dialog */}
      <HistoricalQuoteDetailDialog
        record={selectedRecord}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
};

export default HistoricalQuotesPage;
