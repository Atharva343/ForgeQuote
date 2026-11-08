import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { rateService } from '../../services/rate.service';
import { Cpu, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const machineRateFormSchema = z
  .object({
    operationCode: z
      .string({ required_error: 'Operation code is required' })
      .trim()
      .min(1, 'Operation code is required')
      .max(50),
    operationName: z
      .string({ required_error: 'Operation name is required' })
      .trim()
      .min(1, 'Operation name is required')
      .max(100),
    machineName: z
      .string({ required_error: 'Machine name is required' })
      .trim()
      .min(1, 'Machine name is required')
      .max(100),
    hourlyRate: z.coerce
      .number({ invalid_type_error: 'Hourly rate must be a valid number' })
      .positive('Hourly rate must be greater than 0'),
    currency: z.string().trim().max(10).default('INR'),
    validFrom: z
      .string({ required_error: 'Valid from date is required' })
      .trim()
      .min(1, 'Valid from date is required'),
    validTo: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.validTo && data.validTo.trim() !== '') {
        return new Date(data.validTo).getTime() >= new Date(data.validFrom).getTime();
      }
      return true;
    },
    {
      message: 'Valid to date cannot be earlier than valid from date',
      path: ['validTo'],
    }
  );

type MachineRateFormData = z.infer<typeof machineRateFormSchema>;

interface AddMachineRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export const AddMachineRateDialog: React.FC<AddMachineRateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MachineRateFormData>({
    resolver: zodResolver(machineRateFormSchema),
    defaultValues: {
      operationCode: '',
      operationName: '',
      machineName: '',
      hourlyRate: 850.0,
      currency: 'INR',
      validFrom: todayStr,
      validTo: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: rateService.createMachineRate,
    onSuccess: (newRate) => {
      queryClient.invalidateQueries({ queryKey: ['machineRates'] });
      setSuccessToast(`Machine rate for ${newRate.operationCode} successfully registered!`);
      reset();
      if (onCreated) onCreated();
      setTimeout(() => {
        setSuccessToast(null);
        onOpenChange(false);
      }, 1200);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create machine rate';
      setSubmitError(msg);
    },
  });

  const onSubmit = (data: MachineRateFormData) => {
    setSubmitError(null);
    createMutation.mutate({
      operationCode: data.operationCode.trim().toUpperCase(),
      operationName: data.operationName.trim(),
      machineName: data.machineName.trim(),
      hourlyRate: data.hourlyRate,
      currency: data.currency.trim().toUpperCase() || 'INR',
      validFrom: new Date(data.validFrom).toISOString(),
      validTo: data.validTo && data.validTo.trim() !== '' ? new Date(data.validTo).toISOString() : null,
    });
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      setSubmitError(null);
      setSuccessToast(null);
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-amber-500" />
            <span>Add Machine Rate Version</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Configure hourly operational costs for CNC cells, VMCs, and lathes with strict date range validation.
          </DialogDescription>
        </DialogHeader>

        {submitError && (
          <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {successToast && (
          <div className="flex items-center space-x-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-300">
                Operation Code <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., MACH-RATE-850"
                className="h-8 text-xs bg-slate-950 border-slate-800 uppercase font-mono"
                {...register('operationCode')}
              />
              {errors.operationCode && (
                <p className="text-[10px] text-red-400">{errors.operationCode.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-300">Currency</Label>
              <Input
                placeholder="INR"
                className="h-8 text-xs bg-slate-950 border-slate-800 font-mono"
                {...register('currency')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-300">
              Operation Process Name <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="e.g., Heavy Duty CNC Turning"
              className="h-8 text-xs bg-slate-950 border-slate-800"
              {...register('operationName')}
            />
            {errors.operationName && (
              <p className="text-[10px] text-red-400">{errors.operationName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-300">
              Machine Model / Description <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="e.g., Heavy Duty CNC VMC (₹1450/hr)"
              className="h-8 text-xs bg-slate-950 border-slate-800"
              {...register('machineName')}
            />
            {errors.machineName && (
              <p className="text-[10px] text-red-400">{errors.machineName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-300">
              Machine Hourly Rate (₹/hr) <span className="text-red-400">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="1450.00"
              className="h-8 text-xs bg-slate-950 border-slate-800 font-mono"
              {...register('hourlyRate')}
            />
            {errors.hourlyRate && (
              <p className="text-[10px] text-red-400">{errors.hourlyRate.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-300">
                Effective From <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                className="h-8 text-xs bg-slate-950 border-slate-800"
                {...register('validFrom')}
              />
              {errors.validFrom && (
                <p className="text-[10px] text-red-400">{errors.validFrom.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-300">
                Effective To <span className="text-slate-500 text-[10px]">(Optional)</span>
              </Label>
              <Input
                type="date"
                className="h-8 text-xs bg-slate-950 border-slate-800"
                {...register('validTo')}
              />
              {errors.validTo && (
                <p className="text-[10px] text-red-400">{errors.validTo.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-8 text-xs"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving Version...
                </>
              ) : (
                'Save Machine Rate'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

