import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { rfqService } from '../../services/rfq.service';
import { useAuth } from '../../contexts/AuthContext';
import { RfqStatus } from '../../types';
import {
  FileSpreadsheet,
  Building2,
  Calendar,
  Layers,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Calculator,
} from 'lucide-react';

interface RfqDetailSheetProps {
  rfqId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated?: () => void;
}

export const RfqDetailSheet: React.FC<RfqDetailSheetProps> = ({
  rfqId,
  open,
  onOpenChange,
  onStatusUpdated,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEstimator = user?.role === 'ESTIMATOR';
  const navigate = useNavigate();

  // Status transition state
  const [targetStatus, setTargetStatus] = useState<RfqStatus | null>(null);
  const [lostReason, setLostReason] = useState<string>('');
  const [statusError, setStatusError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const {
    data: rfq,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: () => (rfqId ? rfqService.getRfqById(rfqId) : null),
    enabled: !!rfqId && open,
  });

  // Populate edit fields when data arrives
  React.useEffect(() => {
    if (rfq) {
      setEditTitle(rfq.title);
      setEditDescription(rfq.description || '');
      setEditDueDate(rfq.dueDate ? rfq.dueDate.split('T')[0] : '');
      setTargetStatus(null);
      setLostReason(rfq.lostReason || '');
      setIsEditing(false);
    }
  }, [rfq]);

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: RfqStatus; reason?: string }) => {
      if (!rfqId) throw new Error('No RFQ selected');
      return rfqService.updateRfqStatus(rfqId, {
        status,
        lostReason: status === 'LOST' ? reason : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] });
      setTargetStatus(null);
      setStatusError(null);
      if (onStatusUpdated) onStatusUpdated();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Status update failed';
      setStatusError(msg);
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: () => {
      if (!rfqId) throw new Error('No RFQ selected');
      return rfqService.updateRfq(rfqId, {
        title: editTitle,
        description: editDescription || null,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] });
      setIsEditing(false);
      setEditError(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update RFQ';
      setEditError(msg);
    },
  });

  const handleApplyStatus = (status: RfqStatus) => {
    setStatusError(null);
    if (status === 'LOST') {
      setTargetStatus('LOST');
      return;
    }
    statusMutation.mutate({ status });
  };

  const handleConfirmLost = () => {
    if (!lostReason || lostReason.trim().length < 3) {
      setStatusError('Please provide a reason with at least 3 characters for marking as LOST');
      return;
    }
    statusMutation.mutate({ status: 'LOST', reason: lostReason.trim() });
  };

  const getStatusBadge = (status?: RfqStatus) => {
    switch (status) {
      case 'ESTIMATING':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold">
            ESTIMATING
          </Badge>
        );
      case 'SENT':
        return (
          <Badge variant="outline" className="border-sky-500/40 text-sky-400 bg-sky-500/10 font-bold">
            SENT
          </Badge>
        );
      case 'WON':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold">
            WON
          </Badge>
        );
      case 'LOST':
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 font-bold">
            LOST
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl bg-slate-900 border-slate-800 text-slate-100 p-6 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading RFQ workspace...</p>
          </div>
        )}

        {isError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 space-y-2">
            <p className="text-sm font-semibold">Failed to load RFQ record.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {rfq && (
          <div className="space-y-6">
            <SheetHeader className="pb-4 border-b border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                    {rfq.rfqNumber}
                  </span>
                  {getStatusBadge(rfq.status)}
                </div>

                {isEstimator && !isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs h-8 flex items-center gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-500" />
                    <span>Edit Metadata</span>
                  </Button>
                )}
              </div>

              {!isEditing ? (
                <div className="pt-2">
                  <SheetTitle className="text-xl font-bold text-white leading-tight">
                    {rfq.title}
                  </SheetTitle>
                  <SheetDescription className="text-slate-400 text-xs mt-1">
                    Received on {new Date(rfq.receivedAt).toLocaleDateString()}
                  </SheetDescription>
                </div>
              ) : (
                <div className="pt-3 space-y-3">
                  {editError && (
                    <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                      {editError}
                    </p>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">RFQ Title</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Due Date</Label>
                    <Input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Description</Label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => editMutation.mutate()}
                      disabled={editMutation.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-7 text-xs"
                    >
                      {editMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                      Save Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="text-slate-400 hover:text-white h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </SheetHeader>

            {/* Status Transition Control (ESTIMATOR ONLY) */}
            {isEstimator && (
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Workflow Status Control
                  </span>
                  <span className="text-[11px] text-slate-500">Estimator Authority</span>
                </div>

                {statusError && (
                  <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{statusError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    size="sm"
                    variant={rfq.status === 'ESTIMATING' ? 'default' : 'outline'}
                    disabled={statusMutation.isPending || rfq.status === 'ESTIMATING'}
                    onClick={() => handleApplyStatus('ESTIMATING')}
                    className={`text-xs h-8 ${
                      rfq.status === 'ESTIMATING'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Estimating
                  </Button>

                  <Button
                    size="sm"
                    variant={rfq.status === 'SENT' ? 'default' : 'outline'}
                    disabled={statusMutation.isPending || rfq.status === 'SENT'}
                    onClick={() => handleApplyStatus('SENT')}
                    className={`text-xs h-8 ${
                      rfq.status === 'SENT'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Sent
                  </Button>

                  <Button
                    size="sm"
                    variant={rfq.status === 'WON' ? 'default' : 'outline'}
                    disabled={statusMutation.isPending || rfq.status === 'WON'}
                    onClick={() => handleApplyStatus('WON')}
                    className={`text-xs h-8 ${
                      rfq.status === 'WON'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Won
                  </Button>

                  <Button
                    size="sm"
                    variant={rfq.status === 'LOST' ? 'default' : 'outline'}
                    disabled={statusMutation.isPending || rfq.status === 'LOST'}
                    onClick={() => handleApplyStatus('LOST')}
                    className={`text-xs h-8 ${
                      rfq.status === 'LOST'
                        ? 'bg-rose-500 text-white font-bold'
                        : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Lost
                  </Button>
                </div>

                {/* Lost Reason Required Prompt */}
                {targetStatus === 'LOST' && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <Label className="text-xs text-rose-400 font-semibold">
                      Reason for Lost RFQ (Required) <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      placeholder="e.g., Target piece price was 15% below raw material index"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      className="bg-slate-900 border-rose-500/40 text-white text-xs h-8"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleConfirmLost}
                        disabled={statusMutation.isPending}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-7"
                      >
                        {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Confirm Lost Status
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTargetStatus(null)}
                        className="text-slate-400 text-xs h-7"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {rfq.status === 'LOST' && rfq.lostReason && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                    <span className="font-semibold text-rose-400 uppercase tracking-wider block text-[10px]">
                      Recorded Lost Reason
                    </span>
                    <p className="text-rose-200">{rfq.lostReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Read-Only Status Notice for Sales Head */}
            {!isEstimator && (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Current Status: <strong className="text-white">{rfq.status}</strong></span>
                <span className="text-[11px] text-slate-500">Read-Only Mode</span>
              </div>
            )}

            {/* Overview Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-400" /> Customer
                </span>
                <p className="text-sm font-semibold text-white">{rfq.customer.name}</p>
                <p className="text-xs text-slate-400">{rfq.customer.industry}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" /> Due Date
                </span>
                <p className="text-sm font-semibold text-white">
                  {rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString() : (
                    <span className="text-slate-500 font-normal italic">Not set</span>
                  )}
                </p>
                <span className="text-[11px] text-slate-500">
                  Assigned Owner: <strong className="text-slate-300">{rfq.owner?.name || 'Unassigned'}</strong>
                </span>
              </div>
            </div>

            {/* Description */}
            {rfq.description && (
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider block">
                  Engineering Scope / Notes
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">{rfq.description}</p>
              </div>
            )}

            {/* Parts Manifest */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-500" />
                  <span>Parts Manifest ({rfq.parts.length})</span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {rfq.parts.map((part, index) => (
                  <div
                    key={part.id}
                    className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-bold text-white">{part.partName}</span>
                      </div>
                      {part.drawingNumber && (
                        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {part.drawingNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="bg-slate-900/70 p-2 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-500 block uppercase">Material</span>
                        <span className="font-semibold text-slate-200">{part.material}</span>
                      </div>
                      <div className="bg-slate-900/70 p-2 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-500 block uppercase">Gross Weight</span>
                        <span className="font-semibold text-slate-200">{part.grossWeightKg} kg</span>
                      </div>
                      <div className="bg-slate-900/70 p-2 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-500 block uppercase">Annual Volume</span>
                        <span className="font-semibold text-slate-200">{part.annualVolume.toLocaleString()} pcs</span>
                      </div>
                      <div className="bg-slate-900/70 p-2 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-500 block uppercase">Routing Ops</span>
                        <span className="font-semibold text-slate-200">{part.routingOperations?.length || 0} ops</span>
                      </div>
                    </div>

                    {part.notes && (
                      <p className="text-[11px] text-slate-400 italic pt-1">
                        Note: {part.notes}
                      </p>
                    )}

                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/costing?rfqId=${rfq.id}&partId=${part.id}`);
                        }}
                        className="h-7 text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 gap-1.5"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        Cost this Part
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents & Quotations Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" /> Uploaded Documents ({rfq.documents?.length || 0})
                </span>
                {rfq.documents && rfq.documents.length > 0 ? (
                  <div className="space-y-1.5">
                    {rfq.documents.map((doc) => (
                      <div key={doc.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                        <span className="truncate text-slate-300 max-w-[180px]">{doc.fileName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No drawing packages uploaded yet.</p>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" /> Quotation Bids ({rfq.quotations?.length || 0})
                </span>
                {rfq.quotations && rfq.quotations.length > 0 ? (
                  <div className="space-y-1.5">
                    {rfq.quotations.map((q) => (
                      <div key={q.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                        <span className="font-mono text-amber-400">{q.quoteNumber} (v{q.version})</span>
                        <Badge variant="outline" className="text-[10px]">{q.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No quotation records generated yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
