import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  Coins,
  Cpu,
  Info,
  Clock,
  ShieldCheck,
  TrendingUp,
  Send,
  Eye,
  FileText,
  Download,
} from 'lucide-react';
import { rfqService } from '../services/rfq.service';
import { quotationService } from '../services/quotation.service';
import { approvalService } from '../services/approval.service';
import { QuotationApprovalDialog } from '../components/approval/QuotationApprovalDialog';
import { SimilarHistoricalParts } from '../components/costing/SimilarHistoricalParts';
import { useAuth } from '../contexts/AuthContext';
import {
  CostingInput,
  CostingCalculationResult,
  OperationCostDetail,
} from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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

export const PartCostingPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const isEstimator = user?.role === 'ESTIMATOR';

  // URL state
  const paramRfqId = searchParams.get('rfqId') || '';
  const paramPartId = searchParams.get('partId') || '';

  // Local selection state
  const [selectedRfqId, setSelectedRfqId] = useState<string>(paramRfqId);
  const [selectedPartId, setSelectedPartId] = useState<string>(paramPartId);

  // Costing parameter form state
  const [scrapPercentage, setScrapPercentage] = useState<number>(5);
  const [overheadPercentage, setOverheadPercentage] = useState<number>(10);
  const [freightPerUnit, setFreightPerUnit] = useState<number>(2.5);
  const [marginPercentage, setMarginPercentage] = useState<number>(15);
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [quotationDate, setQuotationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Volume scenarios state (2 or 3 production batch quantities)
  const [volume1, setVolume1] = useState<number>(1000);
  const [volume2, setVolume2] = useState<number>(5000);
  const [volume3, setVolume3] = useState<number>(10000);
  const [useThreeVolumes, setUseThreeVolumes] = useState<boolean>(true);

  // Preview result and error states
  const [previewResult, setPreviewResult] = useState<CostingCalculationResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);

  // Approval Dialog & Selection state
  const [selectedDialogQuotationId, setSelectedDialogQuotationId] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState<boolean>(false);

  // 1. Fetch RFQ List for dropdown
  const { data: rfqListData, isLoading: isLoadingRfqs } = useQuery({
    queryKey: ['costing-rfqs-list'],
    queryFn: () => rfqService.getRfqs({ limit: 100 }),
  });
  const rfqs = rfqListData?.rfqs || [];

  // Auto-select first RFQ if none selected
  useEffect(() => {
    if (!selectedRfqId && rfqs.length > 0) {
      setSelectedRfqId(rfqs[0].id);
    }
  }, [rfqs, selectedRfqId]);

  // Keep URL in sync
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (selectedRfqId) nextParams.set('rfqId', selectedRfqId);
    if (selectedPartId) nextParams.set('partId', selectedPartId);
    setSearchParams(nextParams, { replace: true });
  }, [selectedRfqId, selectedPartId, setSearchParams]);

  // 2. Fetch Selected RFQ detail with parts & routing operations
  const {
    data: selectedRfq,
    isLoading: isLoadingSelectedRfq,
  } = useQuery({
    queryKey: ['rfq-detail-costing', selectedRfqId],
    queryFn: () => rfqService.getRfqById(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  // Auto-select first part or keep matched part
  useEffect(() => {
    if (selectedRfq?.parts && selectedRfq.parts.length > 0) {
      const exists = selectedRfq.parts.find((p) => p.id === selectedPartId);
      if (!exists) {
        setSelectedPartId(selectedRfq.parts[0].id);
      }
    } else {
      setSelectedPartId('');
    }
  }, [selectedRfq, selectedPartId]);

  // Current selected part
  const currentPart = selectedRfq?.parts?.find((p) => p.id === selectedPartId) || null;

  // Initialize suggested volumes when current part changes
  useEffect(() => {
    if (currentPart?.annualVolume) {
      const annVol = currentPart.annualVolume;
      const vol1 = Math.max(100, Math.round(annVol * 0.25));
      const vol2 = annVol;
      const vol3 = Math.round(annVol * 2);
      setVolume1(vol1);
      setVolume2(vol2);
      setVolume3(vol3);
    }
  }, [currentPart?.id, currentPart?.annualVolume]);

  // 3. Fetch Quotations history for the selected RFQ
  const {
    data: quotationHistory = [],
    isLoading: isLoadingQuotations,
    refetch: refetchQuotations,
  } = useQuery({
    queryKey: ['rfq-quotations', selectedRfqId],
    queryFn: () => quotationService.getQuotationsByRfq(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  // Prepare input payload
  const buildCostingInput = (): CostingInput => {
    const volumes = useThreeVolumes ? [volume1, volume2, volume3] : [volume1, volume2];
    return {
      rfqPartId: selectedPartId,
      scrapPercentage: Number(scrapPercentage),
      overheadPercentage: Number(overheadPercentage),
      freightPerUnit: Number(freightPerUnit),
      marginPercentage: Number(marginPercentage),
      gstPercentage: Number(gstPercentage),
      volumeScenarios: volumes,
      quotationDate: quotationDate || undefined,
    };
  };

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      setSaveSuccessMessage(null);
      if (!selectedRfqId || !selectedPartId) {
        throw new Error('Please select both an RFQ and a Part.');
      }
      return await quotationService.previewCosting(selectedRfqId, buildCostingInput());
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setSelectedScenarioIndex(0);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Cost calculation preview failed';
      setActionError(msg);
      setPreviewResult(null);
    },
  });

  // Save Quotation mutation (Estimator only)
  const saveQuotationMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      setSaveSuccessMessage(null);
      if (!selectedRfqId || !selectedPartId) {
        throw new Error('Please select both an RFQ and a Part.');
      }
      return await quotationService.createQuotation(selectedRfqId, buildCostingInput());
    },
    onSuccess: (savedQuote) => {
      setSaveSuccessMessage(
        `Quotation ${savedQuote.quoteNumber} (v${savedQuote.version}) created successfully in DRAFT status.`
      );
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations', selectedRfqId] });
      refetchQuotations();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to save quotation';
      setActionError(msg);
    },
  });

  // Submit Quotation mutation (Estimator submits DRAFT quotation)
  const submitQuotationMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      setActionError(null);
      setSaveSuccessMessage(null);
      return await approvalService.submitQuotation(quoteId);
    },
    onSuccess: (res) => {
      if (res.requiresApproval) {
        setSaveSuccessMessage(
          `Quotation ${res.quotation.quoteNumber} submitted and placed in Sales Head Approval Queue (Evaluated Pre-GST Value: ₹${res.evaluatedAnnualValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} > ₹25L threshold).`
        );
      } else {
        setSaveSuccessMessage(
          `Quotation ${res.quotation.quoteNumber} auto-approved directly (Evaluated Pre-GST Value: ₹${res.evaluatedAnnualValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <= ₹25L threshold. Sales Head approval not required).`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations', selectedRfqId] });
      refetchQuotations();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to submit quotation';
      setActionError(msg);
    },
  });

  // PDF Generation & Download state
  const [downloadingQuoteId, setDownloadingQuoteId] = useState<string | null>(null);

  const generatePdfMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      setActionError(null);
      setSaveSuccessMessage(null);
      return await quotationService.generatePdf(quoteId);
    },
    onSuccess: (res) => {
      setSaveSuccessMessage(
        `PDF artifact for ${res.quoteNumber} (${res.fileName}) generated successfully in private storage.`
      );
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations', selectedRfqId] });
      refetchQuotations();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to generate PDF';
      setActionError(msg);
    },
  });

  const handleDownloadPdf = async (quote: any) => {
    try {
      setDownloadingQuoteId(quote.id);
      await quotationService.downloadPdfBlob(
        quote.id,
        quote.pdf?.fileName || `${quote.quoteNumber}.pdf`
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to download PDF');
    } finally {
      setDownloadingQuoteId(null);
    }
  };

  // Helper currency formatter (INR)
  const formatInr = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const isMissingRateError =
    actionError &&
    (actionError.toLowerCase().includes('rate') ||
      actionError.toLowerCase().includes('effective') ||
      actionError.toLowerCase().includes('not found'));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Calculator className="h-6 w-6 text-amber-500" />
            <span>Deterministic Costing Engine & Quotation Workspace</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Arbitrary-precision costing calculation with effective rate resolution, multi-volume tiers, and immutable snapshots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEstimator ? (
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
              Estimator (Full Access)
            </Badge>
          ) : (
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              Sales Head (Read-Only Review)
            </Badge>
          )}
        </div>
      </div>

      {/* Global Action Banner: Error / Missing Rate Alert */}
      {actionError && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/80 text-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-red-300">Costing Error</p>
            <p className="mt-0.5 text-red-200/90">{actionError}</p>
            {isMissingRateError && (
              <div className="mt-3 flex items-center gap-2">
                <Link to="/rate-masters">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-700 bg-red-900/30 text-red-100 hover:bg-red-800/50 text-xs gap-1.5"
                  >
                    <Coins className="h-3.5 w-3.5" />
                    Configure Rates in Rate Masters
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Success Banner */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-300">Quotation Created</p>
            <p className="mt-0.5 text-emerald-200/90">{saveSuccessMessage}</p>
          </div>
        </div>
      )}

      {/* RFQ & Part Selection Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            {/* RFQ Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select RFQ
              </Label>
              <select
                className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={selectedRfqId}
                onChange={(e) => {
                  setSelectedRfqId(e.target.value);
                  setPreviewResult(null);
                  setActionError(null);
                  setSaveSuccessMessage(null);
                }}
                disabled={isLoadingRfqs}
              >
                {rfqs.map((rfq) => (
                  <option key={rfq.id} value={rfq.id}>
                    {rfq.rfqNumber} — {rfq.customer?.name} ({rfq.title})
                  </option>
                ))}
              </select>
            </div>

            {/* Part Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Part to Cost
              </Label>
              <select
                className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={selectedPartId}
                onChange={(e) => {
                  setSelectedPartId(e.target.value);
                  setPreviewResult(null);
                  setActionError(null);
                  setSaveSuccessMessage(null);
                }}
                disabled={isLoadingSelectedRfq || !selectedRfq?.parts?.length}
              >
                {selectedRfq?.parts?.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.partName} ({part.material}) — {part.annualVolume?.toLocaleString()} pcs/yr
                  </option>
                ))}
              </select>
            </div>

            {/* Quotation Effective Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Effective As Of Date
              </Label>
              <Input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Part & RFQ Details */}
      {currentPart && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Part Specs Card */}
          <Card className="bg-slate-900 border-slate-800 lg:col-span-1">
            <CardHeader className="pb-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-500" />
                  <span>Part Specifications</span>
                </CardTitle>
                <Badge variant="outline" className="border-slate-700 text-slate-300">
                  {selectedRfq?.rfqNumber}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Customer: {selectedRfq?.customer?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Part Name:</span>
                <span className="font-semibold text-white">{currentPart.partName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Part / Drawing No:</span>
                <span className="font-mono text-slate-200">
                  {currentPart.drawingNumber || currentPart.partNumber || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Specified Material:</span>
                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                  {currentPart.material}
                </Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Gross Weight:</span>
                <span className="font-mono text-white font-medium">{currentPart.grossWeightKg} kg</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Annual Production Volume:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {currentPart.annualVolume?.toLocaleString()} units/yr
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Routing Operations Card */}
          <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
            <CardHeader className="pb-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-amber-500" />
                  <span>Manufacturing Routing Operations ({currentPart.routingOperations?.length || 0})</span>
                </CardTitle>
                <span className="text-xs text-slate-400">Sequential shop floor operations</span>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {currentPart.routingOperations && currentPart.routingOperations.length > 0 ? (
                <div className="rounded border border-slate-800 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-950/60">
                      <TableRow className="border-slate-800 text-[11px]">
                        <TableHead className="w-12 text-slate-400">Seq</TableHead>
                        <TableHead className="text-slate-400">Operation</TableHead>
                        <TableHead className="text-slate-400 font-mono">Machine Code</TableHead>
                        <TableHead className="text-right text-slate-400">Setup (min)</TableHead>
                        <TableHead className="text-right text-slate-400">Cycle (min)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {currentPart.routingOperations.map((op) => (
                        <TableRow key={op.id} className="border-slate-800/80 hover:bg-slate-800/40">
                          <TableCell className="font-mono font-medium text-slate-400">
                            #{op.sequence}
                          </TableCell>
                          <TableCell className="font-medium text-slate-200">
                            {op.operationName}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px] border border-amber-500/20">
                              {op.machineCode}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-300">
                            {op.setupTimeMinutes} min
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-300">
                            {op.cycleTimeMinutes} min
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">
                  No routing operations found for this part. Please configure routing in the RFQ Register.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Similar Historical Parts Reference Panel */}
      {currentPart && (
        <SimilarHistoricalParts
          rfqPartId={currentPart.id}
          partNumber={currentPart.partNumber || undefined}
          partName={currentPart.partName}
          material={currentPart.material}
          grossWeightKg={currentPart.grossWeightKg ? Number(currentPart.grossWeightKg) : undefined}
          annualVolume={currentPart.annualVolume}
        />
      )}

      {/* Costing Parameters & Multi-Volume Formulation */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              <span>Costing Formulation Assumptions</span>
            </span>
            <div className="flex items-center gap-2 text-xs font-normal text-slate-400">
              <span>Scenarios:</span>
              <button
                type="button"
                onClick={() => setUseThreeVolumes(false)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  !useThreeVolumes
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                2 Volumes
              </button>
              <button
                type="button"
                onClick={() => setUseThreeVolumes(true)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  useThreeVolumes
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                3 Volumes
              </button>
            </div>
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Set markups, scrap allowances, overhead allocation, and production batch volume scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          {/* Inputs Row 1: Markups and Overheads */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Scrap Allowance (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={scrapPercentage}
                onChange={(e) => setScrapPercentage(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
              <span className="text-[10px] text-slate-500">% of Material Cost</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Overhead Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={overheadPercentage}
                onChange={(e) => setOverheadPercentage(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
              <span className="text-[10px] text-slate-500">% of (Material + Process + Scrap)</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Freight Per Unit (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={freightPerUnit}
                onChange={(e) => setFreightPerUnit(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
              <span className="text-[10px] text-slate-500">Per unit flat shipping</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Target Margin (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="99.9"
                value={marginPercentage}
                onChange={(e) => setMarginPercentage(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
              <span className="text-[10px] text-slate-500">Gross margin on selling price</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">GST Rate (%)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={gstPercentage}
                onChange={(e) => setGstPercentage(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
              <span className="text-[10px] text-slate-500">Standard 18% GST</span>
            </div>
          </div>

          {/* Inputs Row 2: Production Volume Scenarios */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Production Batch Quantity Scenarios (Setup Cost is amortized over Batch Q)</span>
              </span>
              <span className="text-[11px] text-slate-500">Must be distinct positive integers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Volume Scenario 1 (Units)</Label>
                <Input
                  type="number"
                  min="1"
                  value={volume1}
                  onChange={(e) => setVolume1(parseInt(e.target.value, 10) || 0)}
                  className="bg-slate-900 border-slate-700 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-400">
                  Volume Scenario 2 (Units) {volume2 === currentPart?.annualVolume && '(Annual Volume)'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={volume2}
                  onChange={(e) => setVolume2(parseInt(e.target.value, 10) || 0)}
                  className="bg-slate-900 border-slate-700 text-white font-mono"
                />
              </div>

              {useThreeVolumes && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Volume Scenario 3 (Units)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={volume3}
                    onChange={(e) => setVolume3(parseInt(e.target.value, 10) || 0)}
                    className="bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending || !selectedPartId}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-sm"
              >
                {previewMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                Calculate Deterministic Preview
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {isEstimator ? (
                <Button
                  type="button"
                  onClick={() => saveQuotationMutation.mutate()}
                  disabled={
                    saveQuotationMutation.isPending ||
                    previewMutation.isPending ||
                    !selectedPartId
                  }
                  variant="outline"
                  className="border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 font-semibold gap-2 text-sm"
                >
                  {saveQuotationMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save as DRAFT Quotation
                </Button>
              ) : (
                <Badge variant="outline" className="border-slate-700 text-slate-400 py-1.5 px-3">
                  Quotation creation restricted to Estimator role
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculated Preview Section */}
      {previewResult && (
        <div className="space-y-6">
          {/* Multi-Volume Scenario Comparison Table */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span>Multi-Volume Cost & Price Comparison</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Gross Margin formulation: Selling Price Before GST = Total Cost / (1 - Margin%)
                  </CardDescription>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span>Commercial Approval Rule: Annual Value &ge; ₹25,00,000</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded border border-slate-800 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/80">
                    <TableRow className="border-slate-800 text-[11px]">
                      <TableHead className="text-slate-400">Batch Qty</TableHead>
                      <TableHead className="text-right text-slate-400">Material Cost</TableHead>
                      <TableHead className="text-right text-slate-400">Process Cost</TableHead>
                      <TableHead className="text-right text-slate-400">Scrap Cost</TableHead>
                      <TableHead className="text-right text-slate-400">Overhead</TableHead>
                      <TableHead className="text-right text-slate-400">Freight</TableHead>
                      <TableHead className="text-right text-slate-300 font-semibold bg-slate-800/40">
                        Total Cost
                      </TableHead>
                      <TableHead className="text-right text-amber-400 font-bold bg-amber-500/10">
                        Selling Price (Excl. GST)
                      </TableHead>
                      <TableHead className="text-right text-slate-400">GST (18%)</TableHead>
                      <TableHead className="text-right text-emerald-400 font-bold bg-emerald-500/10">
                        Price (Incl. GST)
                      </TableHead>
                      <TableHead className="text-right text-slate-300">
                        Pre-GST Annual Value
                      </TableHead>
                      <TableHead className="text-center text-slate-400">Approval Rule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {previewResult.scenarios.map((sc, idx) => {
                      const isHighValue = sc.annualValue >= 2500000;
                      const isSelected = selectedScenarioIndex === idx;

                      return (
                        <TableRow
                          key={sc.productionVolume}
                          onClick={() => setSelectedScenarioIndex(idx)}
                          className={`cursor-pointer transition-colors border-slate-800/80 ${
                            isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <TableCell className="font-mono font-bold text-white">
                            {sc.productionVolume.toLocaleString()} units
                            {isSelected && (
                              <span className="ml-2 text-[10px] text-amber-400 font-normal">
                                (Selected)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-300">
                            {formatInr(sc.materialCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-300">
                            {formatInr(sc.processCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-400">
                            {formatInr(sc.scrapCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-400">
                            {formatInr(sc.overheadCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-400">
                            {formatInr(sc.freightCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-white bg-slate-800/40">
                            {formatInr(sc.totalCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-amber-400 bg-amber-500/10 text-sm">
                            {formatInr(sc.sellingPriceBeforeGst)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-400">
                            {formatInr(sc.gstAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-400 bg-emerald-500/10 text-sm">
                            {formatInr(sc.sellingPriceWithGst)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-200">
                            {formatInr(sc.annualValue)}
                          </TableCell>
                          <TableCell className="text-center">
                            {isHighValue ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/50 text-amber-400 bg-amber-500/10 text-[10px] whitespace-nowrap"
                              >
                                &ge; ₹25L (Needs Sales Head)
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[10px] whitespace-nowrap"
                              >
                                Direct (&lt; ₹25L)
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Active Scenario Routing Cost Breakdown */}
          {previewResult.scenarios[selectedScenarioIndex] && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Routing Operations Breakdown */}
              <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-amber-500" />
                      <span>
                        Routing Cost Breakdown (Batch Qty:{' '}
                        {previewResult.scenarios[
                          selectedScenarioIndex
                        ].productionVolume.toLocaleString()}{' '}
                        units)
                      </span>
                    </CardTitle>
                    <span className="text-xs font-mono text-amber-400">
                      Total Process Cost:{' '}
                      {formatInr(
                        previewResult.scenarios[selectedScenarioIndex].processCost
                      )}
                    </span>
                  </div>
                  <CardDescription className="text-xs text-slate-400">
                    Cycle Cost = (Cycle Time &times; Hourly Rate) / 60 | Setup Cost = (Setup Time
                    &times; Hourly Rate) / (60 &times; Batch Qty)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="rounded border border-slate-800 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-950/60">
                        <TableRow className="border-slate-800 text-[11px]">
                          <TableHead className="w-12 text-slate-400">Seq</TableHead>
                          <TableHead className="text-slate-400">Operation</TableHead>
                          <TableHead className="text-slate-400 font-mono">Machine</TableHead>
                          <TableHead className="text-right text-slate-400">Rate (₹/hr)</TableHead>
                          <TableHead className="text-right text-slate-400">Cycle Time</TableHead>
                          <TableHead className="text-right text-slate-300 font-semibold">
                            Cycle Cost
                          </TableHead>
                          <TableHead className="text-right text-slate-400">Setup Time</TableHead>
                          <TableHead className="text-right text-slate-300 font-semibold">
                            Setup Cost / Pc
                          </TableHead>
                          <TableHead className="text-right text-amber-400 font-bold">
                            Total Op Cost
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {previewResult.scenarios[
                          selectedScenarioIndex
                        ].operationDetails.map((op: OperationCostDetail) => (
                          <TableRow
                            key={`${op.sequence}-${op.machineCode}`}
                            className="border-slate-800/80 hover:bg-slate-800/30"
                          >
                            <TableCell className="font-mono text-slate-400">
                              #{op.sequence}
                            </TableCell>
                            <TableCell className="font-medium text-slate-200">
                              {op.operationName}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                                {op.machineCode}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-300">
                              {formatInr(op.hourlyRate)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-400">
                              {op.cycleTimeMinutes}m
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-200 font-semibold">
                              {formatInr(op.cycleCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-400">
                              {op.setupTimeMinutes}m
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-200 font-semibold">
                              {formatInr(op.setupCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-amber-400 bg-amber-500/5">
                              {formatInr(op.totalOperationCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Rate Master Snapshot Card */}
              <Card className="bg-slate-900 border-slate-800 lg:col-span-1">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span>Applied Rate Snapshot</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Rates effective as of {quotationDate}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  {/* Material Rate */}
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Material Rate</span>
                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono">
                        {previewResult.rateSnapshot.material.materialCode}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Material Name:</span>
                      <span className="text-slate-200">
                        {previewResult.rateSnapshot.material.materialName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rate / kg:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatInr(previewResult.rateSnapshot.material.ratePerKg)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                      <span>Valid From:</span>
                      <span>
                        {new Date(
                          previewResult.rateSnapshot.material.validFrom
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Machine Rates */}
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Machine Rates</span>
                      <span className="text-[10px] text-slate-400">
                        {previewResult.rateSnapshot.routingOperations.length} machines resolved
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {previewResult.rateSnapshot.routingOperations.map((rOp) => (
                        <div
                          key={rOp.id}
                          className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/40"
                        >
                          <span className="text-slate-300 font-mono">{rOp.machineCode}</span>
                          <span className="text-slate-400 truncate max-w-[100px]">
                            {rOp.machineName}
                          </span>
                          <span className="font-mono text-amber-400 font-semibold">
                            {formatInr(rOp.hourlyRate)}/hr
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-800/30 p-2.5 rounded">
                    <Info className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>
                      Rates are locked immutably into the quotation record at creation time.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Quotation Versions History for the RFQ */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-amber-500" />
              <span>Quotation History for {selectedRfq?.rfqNumber}</span>
            </CardTitle>
            <Badge variant="outline" className="border-slate-700 text-slate-400">
              {quotationHistory.length} Version{quotationHistory.length !== 1 ? 's' : ''} Created
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400">
            Audit trail of quotation versions created for this RFQ.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingQuotations ? (
            <div className="py-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading quotation history...</span>
            </div>
          ) : quotationHistory.length > 0 ? (
            <div className="rounded border border-slate-800 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 text-[11px]">
                    <TableHead className="text-slate-400">Quote Number</TableHead>
                    <TableHead className="text-slate-400">Version</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Created By</TableHead>
                    <TableHead className="text-slate-400">Parts Quoted</TableHead>
                    <TableHead className="text-slate-400">Created At</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {quotationHistory.map((q) => (
                    <TableRow key={q.id} className="border-slate-800/80 hover:bg-slate-800/40">
                      <TableCell className="font-mono font-bold text-amber-400">
                        {q.quoteNumber}
                      </TableCell>
                      <TableCell className="font-mono text-slate-300">v{q.version}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            q.status === 'DRAFT'
                              ? 'border-slate-600 text-slate-300 bg-slate-800/60'
                              : q.status === 'PENDING_APPROVAL'
                              ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                              : q.status === 'APPROVED'
                              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                              : 'border-red-500/50 text-red-400 bg-red-500/10'
                          }`}
                        >
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {q.createdBy?.name || 'Estimator'}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {q.quoteParts?.length || 1} Part(s)
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono">
                        {new Date(q.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Submit button for Estimator on DRAFT */}
                          {isEstimator && q.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-slate-950 font-medium"
                              onClick={() => submitQuotationMutation.mutate(q.id)}
                              disabled={submitQuotationMutation.isPending}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Submit
                            </Button>
                          )}

                          {/* PDF actions for APPROVED quotations */}
                          {q.status === 'APPROVED' &&
                            (q.pdf ? (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
                                onClick={() => handleDownloadPdf(q)}
                                disabled={downloadingQuoteId === q.id}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                {downloadingQuoteId === q.id ? 'Downloading...' : 'PDF'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-950/40"
                                onClick={() => generatePdfMutation.mutate(q.id)}
                                disabled={generatePdfMutation.isPending}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Generate PDF
                              </Button>
                            ))}

                          {/* Inspect / Review Dialog */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                            onClick={() => {
                              setSelectedDialogQuotationId(q.id);
                              setReviewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Inspect / History
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              No quotations created yet for this RFQ. Use the form above to preview and save the initial quotation.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review & History Modal Dialog */}
      <QuotationApprovalDialog
        quotationId={selectedDialogQuotationId}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onDecisionSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ['rfq-quotations', selectedRfqId] });
          refetchQuotations();
        }}
      />
    </div>
  );
};

export default PartCostingPage;
