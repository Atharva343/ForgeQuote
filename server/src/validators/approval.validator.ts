import { z } from 'zod';

export const submitQuotationSchema = z.object({
  comments: z.string().max(1000).optional(),
});

export const approveQuotationSchema = z.object({
  comments: z.string().max(1000).optional(),
});

export const rejectQuotationSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required' })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(1000, 'Rejection reason cannot exceed 1000 characters'),
});

export const approvalQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

export type SubmitQuotationInput = z.infer<typeof submitQuotationSchema>;
export type ApproveQuotationInput = z.infer<typeof approveQuotationSchema>;
export type RejectQuotationInput = z.infer<typeof rejectQuotationSchema>;
export type ApprovalQueueQueryInput = z.infer<typeof approvalQueueQuerySchema>;

