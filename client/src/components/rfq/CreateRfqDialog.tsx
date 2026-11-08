import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { customerService } from '../../services/customer.service';
import { rfqService } from '../../services/rfq.service';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Box } from 'lucide-react';

const rfqFormSchema = z.object({
  title: z.string().trim().min(1, 'RFQ title is required').max(200),
  customerId: z.string().min(1, 'Please select a customer'),
  dueDate: z.string().optional(),
  description: z.string().max(2000).optional(),
  parts: z
    .array(
      z.object({
        partName: z.string().trim().min(1, 'Part name is required'),
        partNumber: z.string().optional(),
        drawingNumber: z.string().optional(),
        material: z.string().trim().min(1, 'Material is required'),
        grossWeightKg: z.coerce
          .number({ invalid_type_error: 'Gross weight must be a number' })
          .positive('Weight must be greater than 0'),
        annualVolume: z.coerce
          .number({ invalid_type_error: 'Annual volume must be an integer' })
          .int('Annual volume must be an integer')
          .min(1, 'Volume must be at least 1'),
        notes: z.string().optional(),
      })
    )
    .min(1, 'At least one part is required'),
});

type RfqFormData = z.infer<typeof rfqFormSchema>;

interface CreateRfqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export const CreateRfqDialog: React.FC<CreateRfqDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch registered customers
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: customerService.getCustomers,
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RfqFormData>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      title: '',
      customerId: '',
      dueDate: '',
      description: '',
      parts: [
        {
          partName: '',
          partNumber: '',
          drawingNumber: '',
          material: '',
          grossWeightKg: 1.0,
          annualVolume: 10000,
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parts',
  });

  const createMutation = useMutation({
    mutationFn: rfqService.createRfq,
    onSuccess: (newRfq) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setSuccessToast(`RFQ ${newRfq.rfqNumber} successfully registered!`);
      reset();
      if (onCreated) onCreated();
      setTimeout(() => {
        setSuccessToast(null);
        onOpenChange(false);
      }, 1200);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create RFQ';
      setSubmitError(msg);
    },
  });

  const onSubmit = (data: RfqFormData) => {
    setSubmitError(null);
    createMutation.mutate({
      title: data.title,
      customerId: data.customerId,
      description: data.description || null,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      parts: data.parts.map((p) => ({
        partName: p.partName,
        partNumber: p.partNumber || null,
        drawingNumber: p.drawingNumber || null,
        material: p.material,
        grossWeightKg: p.grossWeightKg,
        annualVolume: p.annualVolume,
        notes: p.notes || null,
      })),
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Box className="h-5 w-5 text-amber-500" />
            <span>Intake New Manufacturing RFQ</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Register a new client request, define multi-volume components, and initialize estimation tracking.
          </DialogDescription>
        </DialogHeader>

        {submitError && (
          <div className="flex items-center space-x-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {successToast && (
          <div className="flex items-center space-x-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
          {/* RFQ Core Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-300">
                RFQ Title <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., Rear Axle Pinion & Bevel Assembly"
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-amber-500"
                {...register('title')}
              />
              {errors.title && (
                <p className="text-xs text-red-400">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                Customer <span className="text-red-400">*</span>
              </Label>
              <select
                className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...register('customerId')}
                disabled={isLoadingCustomers}
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.industry})
                  </option>
                ))}
              </select>
              {errors.customerId && (
                <p className="text-xs text-red-400">{errors.customerId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Due Date</Label>
              <Input
                type="date"
                className="bg-slate-950 border-slate-800 text-white focus-visible:ring-amber-500"
                {...register('dueDate')}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-300">
                Description / Engineering Scope
              </Label>
              <textarea
                rows={2}
                placeholder="Specify special heat treatment, forging supply condition, or inspection standards..."
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-600"
                {...register('description')}
              />
            </div>
          </div>

          {/* Parts Section */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Parts Manifest ({fields.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Each RFQ requires at least one component for costing breakdown.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    partName: '',
                    partNumber: '',
                    drawingNumber: '',
                    material: '',
                    grossWeightKg: 1.0,
                    annualVolume: 10000,
                    notes: '',
                  })
                }
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 text-amber-500" />
                <span>Add Part</span>
              </Button>
            </div>

            {errors.parts?.root && (
              <p className="text-xs text-red-400">{errors.parts.root.message}</p>
            )}

            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 relative space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      PART #{idx + 1}
                    </span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(idx)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Part Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        placeholder="e.g., Planetary Pinion"
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.partName` as const)}
                      />
                      {errors.parts?.[idx]?.partName && (
                        <p className="text-[10px] text-red-400">
                          {errors.parts[idx]?.partName?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Part Number
                      </Label>
                      <Input
                        placeholder="e.g., PP-104-B"
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.partNumber` as const)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Drawing Number
                      </Label>
                      <Input
                        placeholder="e.g., DRW-2026-PP"
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.drawingNumber` as const)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Material Grade <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        placeholder="e.g., 20MnCr5 or EN8"
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.material` as const)}
                      />
                      {errors.parts?.[idx]?.material && (
                        <p className="text-[10px] text-red-400">
                          {errors.parts[idx]?.material?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Gross Weight (kg) <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.85"
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.grossWeightKg` as const)}
                      />
                      {errors.parts?.[idx]?.grossWeightKg && (
                        <p className="text-[10px] text-red-400">
                          {errors.parts[idx]?.grossWeightKg?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Annual Volume <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="number"
                        placeholder="50000"
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.annualVolume` as const)}
                      />
                      {errors.parts?.[idx]?.annualVolume && (
                        <p className="text-[10px] text-red-400">
                          {errors.parts[idx]?.annualVolume?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-[11px] font-medium text-slate-300">
                        Manufacturing / Tolerance Notes
                      </Label>
                      <Input
                        placeholder="Optional notes regarding surface roughness, induction hardening, etc."
                        className="h-8 text-xs bg-slate-900 border-slate-800"
                        {...register(`parts.${idx}.notes` as const)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering RFQ...
                </>
              ) : (
                'Create RFQ'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

