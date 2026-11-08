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
import { Coins, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const materialRateFormSchema = z
  .object({
    materialCode: z
      .string({ required_error: 'Material code is required' })
      .trim()
      .min(1, 'Material code is required')
      .max(50),
    materialName: z
      .string({ required_error: 'Material name is required' })
      .trim()
      .min(1, 'Material name is required')
      .max(100),
    ratePerKg: z.coerce
      .number({ invalid_type_error: 'Rate per kg must be a valid number' })
      .positive('Rate per kg must be greater than 0'),
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

type MaterialRateFormData = z.infer<typeof materialRateFormSchema>;

interface AddMaterialRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export const AddMaterialRateDialog: React.FC<AddMaterialRateDialogProps> = ({
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
  } = useForm<MaterialRateFormData>({
    resolver: zodResolver(materialRateFormSchema),
    defaultValues: {
      materialCode: '',
      materialName: '',
      ratePerKg: 75.0,
      currency: 'INR',
      validFrom: todayStr,
      validTo: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: rateService.createMaterialRate,
    onSuccess: (newRate) => {
      queryClient.invalidateQueries({ queryKey: ['materialRates'] });
      setSuccessToast(`Material rate for ${newRate.materialCode} successfully registered!`);
      reset();
      if (onCreated) onCreated();
      setTimeout(() => {
        setSuccessToast(null);
        onOpenChange(false);
      }, 1200);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create material rate';
      setSubmitError(msg);
    },
  });

  const onSubmit = (data: MaterialRateFormData) => {
    setSubmitError(null);
    createMutation.mutate({
      materialCode: data.materialCode.trim().toUpperCase(),
      materialName: data.materialName.trim(),
      ratePerKg: data.ratePerKg,
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
            <Coins className="h-5 w-5 text-amber-500" />
            <span>Add Material Rate Version</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Configure benchmark material rates. New versions are versioned with effective dates without overwriting past prices.
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
                Material Code <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., EN8 or 20MNCR5"
                className="h-8 text-xs bg-slate-950 border-slate-800 uppercase font-mono"
                {...register('materialCode')}
              />
              {errors.materialCode && (
                <p className="text-[10px] text-red-400">{errors.materialCode.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-300">
                Currency
              </Label>
              <Input
                placeholder="INR"
                className="h-8 text-xs bg-slate-950 border-slate-800 font-mono"
                {...register('currency')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-300">
              Material Specification Name <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="e.g., Carbon Steel EN8 Round Bar"
              className="h-8 text-xs bg-slate-950 border-slate-800"
              {...register('materialName')}
            />
            {errors.materialName && (
              <p className="text-[10px] text-red-400">{errors.materialName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-300">
              Rate per Kilogram (₹/kg) <span className="text-red-400">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="85.50"
              className="h-8 text-xs bg-slate-950 border-slate-800 font-mono"
              {...register('ratePerKg')}
            />
            {errors.ratePerKg && (
              <p className="text-[10px] text-red-400">{errors.ratePerKg.message}</p>
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
                'Save Material Rate'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

