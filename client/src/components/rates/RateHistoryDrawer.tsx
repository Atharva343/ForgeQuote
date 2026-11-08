import React, { useState } from 'react';
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
import { rateService } from '../../services/rate.service';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialRate, MachineRate, RateValidityStatus } from '../../types';
import {
  History,
  Calendar,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface RateHistoryDrawerProps {
  type: 'material' | 'machine';
  code: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRateClosed?: () => void;
}

export const RateHistoryDrawer: React.FC<RateHistoryDrawerProps> = ({
  type,
  code,
  open,
  onOpenChange,
  onRateClosed,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEstimator = user?.role === 'ESTIMATOR';

  // State for closing a rate version
  const [closingRateId, setClosingRateId] = useState<string | null>(null);
  const [closeDate, setCloseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [closeError, setCloseError] = useState<string | null>(null);

  const queryKey = type === 'material' ? ['materialRateHistory', code] : ['machineRateHistory', code];

  const {
    data: history = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Array<MaterialRate | MachineRate>>({
    queryKey,
    queryFn: async () => {
      if (!code) return [];
      return type === 'material'
        ? await rateService.getMaterialRateHistory(code)
        : await rateService.getMachineRateHistory(code);
    },
    enabled: !!code && open,
  });

  const closeMutation = useMutation<MaterialRate | MachineRate, Error, { id: string; validTo: string }>({
    mutationFn: async ({ id, validTo }: { id: string; validTo: string }) => {
      const payload = { validTo: new Date(validTo).toISOString() };
      return type === 'material'
        ? await rateService.closeMaterialRate(id, payload)
        : await rateService.closeMachineRate(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [type === 'material' ? 'materialRates' : 'machineRates'] });
      setClosingRateId(null);
      setCloseError(null);
      if (onRateClosed) onRateClosed();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to close rate validity';
      setCloseError(msg);
    },
  });

  const getStatusBadge = (status: RateValidityStatus) => {
    switch (status) {
      case 'CURRENT':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold text-[10px]">
            CURRENT
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="outline" className="border-slate-700 text-slate-400 bg-slate-800/80 text-[10px]">
            EXPIRED
          </Badge>
        );
      case 'UPCOMING':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px]">
            UPCOMING
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleExecuteClose = (id: string) => {
    setCloseError(null);
    closeMutation.mutate({ id, validTo: closeDate });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl bg-slate-900 border-slate-800 text-slate-100 p-6 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 w-fit">
            <History className="h-3.5 w-3.5" />
            <span>{code}</span>
          </div>
          <SheetTitle className="text-xl font-bold text-white pt-2">
            Historical Version Audit Trail
          </SheetTitle>
          <SheetDescription className="text-slate-400 text-xs">
            Complete version history for {type === 'material' ? 'Material Grade' : 'Machine Operation'}. Rates are strictly preserved over time.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading version records...</p>
          </div>
        ) : isError ? (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 space-y-2 mt-4">
            <p className="text-sm font-semibold">Failed to load historical versions.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm mt-4">
            No historical versions recorded for {code}.
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {history.map((versionItem: MaterialRate | MachineRate, index) => {
              const isMaterial = type === 'material';
              const matItem = versionItem as MaterialRate;
              const machItem = versionItem as MachineRate;
              const isBeingClosed = closingRateId === versionItem.id;

              return (
                <div
                  key={versionItem.id}
                  className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3 relative"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        Version #{history.length - index}
                      </span>
                      {getStatusBadge(versionItem.status)}
                    </div>
                    <div className="text-sm font-mono font-bold text-white">
                      {isMaterial ? (
                        <span>
                          ₹{matItem.ratePerKg.toFixed(2)} <span className="text-xs text-slate-400">/ kg</span>
                        </span>
                      ) : (
                        <span>
                          ₹{machItem.hourlyRate.toFixed(2)} <span className="text-xs text-slate-400">/ hr</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-200">
                      {isMaterial ? matItem.materialName : `${machItem.operationName} (${machItem.machineName})`}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        <span>From: {new Date(versionItem.validFrom).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        <span>
                          To: {versionItem.validTo ? new Date(versionItem.validTo).toLocaleDateString() : (
                            <span className="text-emerald-400 font-sans italic font-normal">Open-ended</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 pt-1">
                      Recorded on {new Date(versionItem.createdAt).toLocaleDateString()} at{' '}
                      {new Date(versionItem.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Controlled Close Validity Option for Estimators */}
                  {isEstimator && !versionItem.validTo && versionItem.status === 'CURRENT' && (
                    <div className="pt-2 border-t border-slate-800/80">
                      {!isBeingClosed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setClosingRateId(versionItem.id);
                            setCloseDate(new Date().toISOString().split('T')[0]);
                            setCloseError(null);
                          }}
                          className="h-7 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          <Clock className="h-3 w-3 mr-1 text-amber-500" />
                          <span>Close Validity Period</span>
                        </Button>
                      ) : (
                        <div className="space-y-2 pt-1">
                          {closeError && (
                            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-1.5">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>{closeError}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="space-y-1 grow">
                              <Label className="text-[10px] text-slate-400">Set Effective End Date</Label>
                              <Input
                                type="date"
                                value={closeDate}
                                onChange={(e) => setCloseDate(e.target.value)}
                                className="h-7 text-xs bg-slate-900 border-slate-700"
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={closeMutation.isPending}
                              onClick={() => handleExecuteClose(versionItem.id)}
                              className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold mt-4"
                            >
                              {closeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                              Confirm End
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setClosingRateId(null);
                                setCloseError(null);
                              }}
                              className="h-7 text-xs text-slate-400 hover:text-white mt-4"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
