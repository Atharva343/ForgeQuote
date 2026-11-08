import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { quotationService } from '../../services/quotation.service';
import { approvalService } from '../../services/approval.service';
import { useAuth } from '../../contexts/AuthContext';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldAlert,
  Coins,
  Layers,
  RefreshCw,
  TrendingUp,
  History,
  Check,
  FileText,
  Download,
  FileCheck,
} from 'lucide-react';

interface QuotationApprovalDialogProps {
  quotationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecisionSubmitted?: () => void;
}

export const QuotationApprovalDialog: React.FC<QuotationApprovalDialogProps> = ({
  quotationId,
  open,
  onOpenChange,
  onDecisionSubmitted,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSalesHead = user?.role === 'SALES_HEAD';

  const [activeTab, setActiveTab] = useState<'costing' | 'rates' | 'history'>('costing');
  const [rejectReason, setRejectReason] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch full quotation details
  const {
    data: quotation,
    isLoading: isLoadingQuotation,
    refetch: refetchQuotation,
  } = useQuery({
    queryKey: ['quotation-detail', quotationId],
    queryFn: () => quotationService.getQuotationById(quotationId!),
    enabled: !!quotationId && open,
  });

  // Fetch approval history
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['quotation-history', quotationId],
    queryFn: () => approvalService.getApprovalHistory(quotationId!),
    enabled: !!quotationId && open,
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      return await approvalService.approveQuotation(quotationId!, approvalComments);
    },
    onSuccess: () => {
      setShowApproveConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations'] });
      refetchQuotation();
      refetchHistory();
      if (onDecisionSubmitted) onDecisionSubmitted();
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Approval failed');
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      if (!rejectReason.trim()) {
        throw new Error('A rejection reason is required.');
      }
      return await approvalService.rejectQuotation(quotationId!, rejectReason.trim());
    },
    onSuccess: () => {
      setShowRejectConfirm(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations'] });
      refetchQuotation();
      refetchHistory();
      if (onDecisionSubmitted) onDecisionSubmitted();
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Rejection failed');
    },
  });

  // Generate PDF Mutation
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      if (!quotationId) return;
      return await quotationService.generatePdf(quotationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-detail', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations'] });
      refetchQuotation();
      if (onDecisionSubmitted) onDecisionSubmitted();
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to generate PDF');
    },
  });

  const handleDownloadPdf = async () => {
    if (!quotationId || !quotation) return;
    try {
      setPdfDownloading(true);
      await quotationService.downloadPdfBlob(
        quotationId,
        quotation.pdf?.fileName || `${quotation.quoteNumber}.pdf`
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to download PDF');
    } finally {
      setPdfDownloading(false);
    }
  };

  const formatInr = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (!open) return null;

  const isPending = quotation?.status === 'PENDING_APPROVAL';

  // Compute highest annual pre-GST value across all volume scenarios
  let highestAnnualPreGst = 0;
  if (quotation?.quoteParts) {
    for (const qp of quotation.quoteParts) {
      if (qp.volumePrices) {
        for (const vp of qp.volumePrices) {
          if (vp.annualValue > highestAnnualPreGst) {
            highestAnnualPreGst = vp.annualValue;
          }
        }
      }
    }
  }

  const exceedsThreshold = highestAnnualPreGst > 2500000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <DialogTitle className="text-xl font-bold text-white font-mono">
                  {quotation?.quoteNumber || 'Quotation Review'}
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-xs border-slate-700 text-slate-300">
                  v{quotation?.version}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    quotation?.status === 'DRAFT'
                      ? 'border-slate-600 text-slate-400 bg-slate-800/60'
                      : quotation?.status === 'PENDING_APPROVAL'
                      ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                      : quotation?.status === 'APPROVED'
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                      : 'border-red-500/50 text-red-400 bg-red-500/10'
                  }`}
                >
                  {quotation?.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>RFQ: {quotation?.rfq?.rfqNumber}</span>
                <span>•</span>
                <span>Customer: {quotation?.rfq?.customer?.name}</span>
                <span>•</span>
                <span>Estimator: {quotation?.createdBy?.name}</span>
              </DialogDescription>
            </div>

            {/* Threshold Indicator Badge */}
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                Highest Pre-GST Annual Value
              </span>
              <span className="text-base font-bold font-mono text-amber-400">
                {formatInr(highestAnnualPreGst)}
              </span>
              <div>
                {exceedsThreshold ? (
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/40 text-[10px] gap-1">
                    <ShieldAlert className="h-3 w-3" /> Exceeds ₹25L Threshold (Sign-off Required)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 text-[10px] gap-1">
                    <Check className="h-3 w-3" /> Within ₹25L Direct Limit
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Action Error Banner */}
        {actionError && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/80 text-red-200 flex items-start gap-2.5 text-xs">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Action Failed</p>
              <p>{actionError}</p>
            </div>
          </div>
        )}

        {isLoadingQuotation ? (
          <div className="py-16 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading quotation details...</span>
          </div>
        ) : quotation ? (
          <div className="space-y-6 pt-2">
            {/* Context Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">RFQ Title</span>
                <span className="font-semibold text-slate-200 truncate block">
                  {quotation.rfq?.title}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Customer</span>
                <span className="font-semibold text-slate-200 truncate block">
                  {quotation.rfq?.customer?.name}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Submitted At</span>
                <span className="font-mono text-slate-300">
                  {quotation.submittedAt ? new Date(quotation.submittedAt).toLocaleString() : 'Not submitted'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Decision Time</span>
                <span className="font-mono text-slate-300">
                  {quotation.approvedAt ? new Date(quotation.approvedAt).toLocaleString() : 'Pending'}
                </span>
              </div>
            </div>

            {/* Customer-Facing PDF Generation & Download Card */}
            <div className="p-3.5 rounded-lg border bg-slate-950/80 border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      quotation.status === 'APPROVED'
                        ? quotation.pdf
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                    }`}
                  >
                    {quotation.pdf ? (
                      <FileCheck className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Customer-Facing PDF Quotation
                      </h4>
                      {quotation.pdf && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                          Artifact Ready
                        </Badge>
                      )}
                    </div>
                    {quotation.status === 'APPROVED' ? (
                      quotation.pdf ? (
                        <p className="text-xs text-slate-400 mt-1">
                          File: <span className="font-mono text-slate-200">{quotation.pdf.fileName}</span> ({(Number(quotation.pdf.sizeBytes) / 1024).toFixed(1)} KB) • Generated {new Date(quotation.pdf.createdAt).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">
                          This quotation has received commercial approval. Generate the formal PDF document for customer dispatch.
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
                        PDF generation is locked. Quotation must be in <span className="font-semibold text-slate-400">APPROVED</span> status before generating the formal customer PDF.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {quotation.status === 'APPROVED' ? (
                    quotation.pdf ? (
                      <Button
                        size="sm"
                        onClick={handleDownloadPdf}
                        disabled={pdfDownloading}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold gap-1.5 shadow-sm"
                      >
                        {pdfDownloading ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Download PDF
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => generatePdfMutation.mutate()}
                        disabled={generatePdfMutation.isPending}
                        className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold gap-1.5 shadow-sm"
                      >
                        {generatePdfMutation.isPending ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        Generate Official PDF
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="h-8 text-xs border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      PDF Locked
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(val: any) => setActiveTab(val)}
              className="space-y-4"
            >
              <TabsList className="bg-slate-950 border border-slate-800 p-1">
                <TabsTrigger
                  value="costing"
                  className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-xs font-semibold gap-1.5"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Costing & Pricing Scenarios
                </TabsTrigger>
                <TabsTrigger
                  value="rates"
                  className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-xs font-semibold gap-1.5"
                >
                  <Coins className="h-3.5 w-3.5" />
                  Rate Snapshots
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-xs font-semibold gap-1.5"
                >
                  <History className="h-3.5 w-3.5" />
                  Approval Audit Trail ({history.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Costing Scenarios */}
              <TabsContent value="costing" className="space-y-5">
                {quotation.quoteParts?.map((qp) => (
                  <Card key={qp.id} className="bg-slate-950/40 border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                          <Layers className="h-4 w-4 text-amber-500" />
                          <span>Part: {qp.rfqPart?.partName}</span>
                          <span className="text-xs font-mono text-slate-400">
                            ({qp.rfqPart?.material})
                          </span>
                        </CardTitle>
                        <span className="text-xs text-slate-400">
                          Gross Weight: {qp.rfqPart?.grossWeightKg} kg | Annual Volume:{' '}
                          {qp.rfqPart?.annualVolume?.toLocaleString()} units
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="rounded border border-slate-800 overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-950">
                            <TableRow className="border-slate-800 text-[11px]">
                              <TableHead className="text-slate-400">Batch Qty</TableHead>
                              <TableHead className="text-right text-slate-400">Material</TableHead>
                              <TableHead className="text-right text-slate-400">Process</TableHead>
                              <TableHead className="text-right text-slate-400">Scrap</TableHead>
                              <TableHead className="text-right text-slate-400">Overhead</TableHead>
                              <TableHead className="text-right text-slate-400">Freight</TableHead>
                              <TableHead className="text-right text-slate-300 font-semibold bg-slate-900/40">
                                Total Cost
                              </TableHead>
                              <TableHead className="text-right text-slate-300">Margin %</TableHead>
                              <TableHead className="text-right text-amber-400 font-bold bg-amber-500/10">
                                Price (Excl. GST)
                              </TableHead>
                              <TableHead className="text-right text-slate-400">GST (18%)</TableHead>
                              <TableHead className="text-right text-emerald-400 font-bold bg-emerald-500/10">
                                Price (Incl. GST)
                              </TableHead>
                              <TableHead className="text-right text-slate-300 font-semibold">
                                Pre-GST Annual Value
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="text-xs">
                            {qp.volumePrices?.map((vp) => (
                              <TableRow key={vp.id} className="border-slate-800/80">
                                <TableCell className="font-mono font-bold text-white">
                                  {vp.productionVolume.toLocaleString()} units
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-300">
                                  {formatInr(vp.materialCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-300">
                                  {formatInr(vp.processCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-400">
                                  {formatInr(vp.scrapCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-400">
                                  {formatInr(vp.overheadCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-400">
                                  {formatInr(vp.freightCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-white bg-slate-900/40">
                                  {formatInr(vp.totalCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-300">
                                  {vp.marginPercentage}%
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-400 bg-amber-500/10">
                                  {formatInr(vp.sellingPricePerUnit)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-400">
                                  {formatInr(vp.gstAmount)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-emerald-400 bg-emerald-500/10">
                                  {formatInr(vp.sellingPriceWithGst)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-slate-200">
                                  {formatInr(vp.annualValue)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Tab 2: Rate Snapshots */}
              <TabsContent value="rates" className="space-y-4">
                {quotation.quoteParts?.map((qp) => {
                  const snap = qp.rateSnapshot || {};
                  const mat = snap.material || {};
                  const machines = snap.routingOperations || snap.routing || [];

                  return (
                    <div key={qp.id} className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-4">
                      <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        Locked Rate Snapshots for {qp.rfqPart?.partName}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 rounded border border-slate-800 bg-slate-900/60 space-y-1.5">
                          <span className="font-semibold text-slate-300 block">Material Rate Applied</span>
                          <div className="flex justify-between text-slate-400">
                            <span>Code:</span>
                            <span className="font-mono text-slate-200">{mat.materialCode || mat.code}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Effective Rate:</span>
                            <span className="font-mono font-bold text-amber-400">
                              {formatInr(mat.ratePerKg || mat.rate)}/kg
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded border border-slate-800 bg-slate-900/60 space-y-1.5">
                          <span className="font-semibold text-slate-300 block">Routing Machines ({machines.length})</span>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {machines.map((m: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[11px] text-slate-400 border-b border-slate-800/40 py-0.5">
                                <span className="font-mono text-slate-300">{m.machineCode || m.code}</span>
                                <span className="font-mono text-amber-400 font-semibold">
                                  {formatInr(m.hourlyRate || m.rate)}/hr
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              {/* Tab 3: Approval History */}
              <TabsContent value="history" className="space-y-3">
                {history.length > 0 ? (
                  <div className="space-y-2.5">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                item.decision === 'APPROVED' || item.decision === 'AUTO_APPROVED'
                                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                                  : item.decision === 'REJECTED'
                                  ? 'border-red-500/50 text-red-400 bg-red-500/10'
                                  : 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                              }`}
                            >
                              {item.decision}
                            </Badge>
                            <span className="font-semibold text-white">
                              {item.actor?.name || 'System'} ({item.role})
                            </span>
                          </div>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {item.evaluatedAnnualValue && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-3">
                            <span>
                              Evaluated Value: <strong className="text-slate-200">{formatInr(item.evaluatedAnnualValue)}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Threshold: <strong className="text-slate-200">{formatInr(item.thresholdValue)}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Approval Required: <strong className="text-slate-200">{item.requiresApproval ? 'Yes' : 'No'}</strong>
                            </span>
                          </div>
                        )}

                        {item.rejectionReason && (
                          <p className="text-red-300 bg-red-950/30 p-2 rounded border border-red-900/40 text-[11px]">
                            <strong>Rejection Reason:</strong> {item.rejectionReason}
                          </p>
                        )}

                        {item.comments && !item.rejectionReason && (
                          <p className="text-slate-300 italic text-[11px]">
                            Notes: {item.comments}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No approval audit entries recorded yet.
                  </p>
                )}
              </TabsContent>
            </Tabs>

            {/* Sales Head Decision Actions */}
            {isSalesHead && isPending && (
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-purple-400" />
                    <span>Commercial Sign-off Decision</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Your sign-off will transition this quotation to APPROVED or REJECTED.
                  </span>
                </div>

                {/* Approve Confirmation Form */}
                {showApproveConfirm ? (
                  <div className="p-3.5 rounded bg-emerald-950/30 border border-emerald-800/80 space-y-3">
                    <p className="text-xs font-semibold text-emerald-300">
                      Confirm Approval of Quotation {quotation.quoteNumber}
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Approval Comments (Optional)</Label>
                      <Input
                        value={approvalComments}
                        onChange={(e) => setApprovalComments(e.target.value)}
                        placeholder="e.g., Margin approved as per strategic customer tier"
                        className="bg-slate-900 border-slate-700 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowApproveConfirm(false)}
                        className="text-xs text-slate-400"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate()}
                        disabled={approveMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                      >
                        {approveMutation.isPending ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Confirm Commercial Approval
                      </Button>
                    </div>
                  </div>
                ) : showRejectConfirm ? (
                  /* Reject Confirmation Form */
                  <div className="p-3.5 rounded bg-red-950/30 border border-red-800/80 space-y-3">
                    <p className="text-xs font-semibold text-red-300">
                      Reject Quotation {quotation.quoteNumber} (Mandatory Reason)
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Rejection Reason</Label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="State the commercial or margin reason for rejection (required)..."
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowRejectConfirm(false)}
                        className="text-xs text-slate-400"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => rejectMutation.mutate()}
                        disabled={rejectMutation.isPending || !rejectReason.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5"
                      >
                        {rejectMutation.isPending ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Submit Rejection
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Initial Decision Buttons */
                  <div className="flex justify-end gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowRejectConfirm(true);
                        setShowApproveConfirm(false);
                      }}
                      className="border-red-700/80 text-red-400 hover:bg-red-950/40 text-xs gap-1.5 font-semibold"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject Quotation
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowApproveConfirm(true);
                        setShowRejectConfirm(false);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve Quotation
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="border-t border-slate-800 pt-3 flex justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-400"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
