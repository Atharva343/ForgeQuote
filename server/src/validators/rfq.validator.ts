import { z } from 'zod';
import { RfqStatus } from '@prisma/client';

export const partInputSchema = z.object({
  id: z.string().uuid().optional(),
  partName: z.string({ required_error: 'Part name is required' }).trim().min(1, 'Part name is required').max(200),
  partNumber: z.string().trim().max(100).optional().nullable(),
  drawingNumber: z.string().trim().max(100).optional().nullable(),
  material: z.string({ required_error: 'Material is required' }).trim().min(1, 'Material is required').max(100),
  grossWeightKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number({ required_error: 'Gross weight is required' }).positive('Gross weight must be greater than 0')
  ),
  annualVolume: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number({ required_error: 'Annual volume is required' }).int('Annual volume must be an integer').min(1, 'Annual volume must be at least 1')
  ),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const createRfqSchema = z.object({
  title: z.string({ required_error: 'RFQ title is required' }).trim().min(1, 'RFQ title is required').max(200),
  customerId: z.string({ required_error: 'Customer ID is required' }).uuid('Invalid customer identifier format'),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid due date format',
    }),
  parts: z
    .array(partInputSchema, { required_error: 'At least one part is required' })
    .min(1, 'At least one part is required for RFQ creation'),
});

export const updateRfqSchema = z.object({
  title: z.string().trim().min(1, 'RFQ title cannot be empty').max(200).optional(),
  customerId: z.string().uuid('Invalid customer identifier format').optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid due date format',
    }),
  parts: z.array(partInputSchema).min(1, 'At least one part is required if parts are updated').optional(),
});

export const updateRfqStatusSchema = z
  .object({
    status: z.nativeEnum(RfqStatus, {
      required_error: 'Valid RFQ status is required (ESTIMATING, SENT, WON, LOST)',
      invalid_type_error: 'Invalid RFQ status. Permitted values: ESTIMATING, SENT, WON, LOST',
    }),
    lostReason: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === RfqStatus.LOST) {
      if (!data.lostReason || data.lostReason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lostReason'],
          message: 'A non-empty reason (at least 3 characters) is required when marking an RFQ as LOST',
        });
      }
    }
  });

export const rfqQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.nativeEnum(RfqStatus).optional(),
  customerId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  sortBy: z.enum(['receivedAt', 'createdAt', 'dueDate', 'rfqNumber', 'status', 'title']).default('receivedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateRfqInput = z.infer<typeof createRfqSchema>;
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>;
export type UpdateRfqStatusInput = z.infer<typeof updateRfqStatusSchema>;
export type RfqQueryInput = z.infer<typeof rfqQuerySchema>;

