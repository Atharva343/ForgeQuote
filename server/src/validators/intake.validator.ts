import { z } from 'zod';

export const extractIntakeInputSchema = z.object({
  draftId: z.string().uuid().optional(),
  emailText: z.string().optional(),
  documentIds: z.array(z.string().uuid()).optional().default([]),
});

export type ExtractIntakeInput = z.infer<typeof extractIntakeInputSchema>;

export const intakeRoutingOperationSchema = z.object({
  sequence: z.number().int().min(1),
  operationName: z.string().min(1),
  machineCode: z.string().min(1),
  cycleTimeMinutes: z.number().positive(),
  setupTimeMinutes: z.number().min(0).default(0),
});

export const intakePartSchema = z.object({
  partName: z.string().min(1, 'Part name is required'),
  partNumber: z.string().nullable().optional(),
  drawingNumber: z.string().nullable().optional(),
  material: z.string().min(1, 'Material specification is required'),
  grossWeightKg: z.number().positive('Gross weight must be greater than 0'),
  annualVolume: z.number().int().positive('Annual volume must be greater than 0'),
  notes: z.string().nullable().optional(),
  routingOperations: z.array(intakeRoutingOperationSchema).optional().default([]),
});

export const createRfqFromIntakeSchema = z.object({
  draftId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).optional(),
  customerIndustry: z.string().optional(),
  customerEmail: z.string().email().optional(),
  title: z.string().min(3, 'RFQ title must be at least 3 characters'),
  description: z.string().nullable().optional(),
  receivedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  parts: z.array(intakePartSchema).min(1, 'At least one part is required to create an RFQ'),
  documentIds: z.array(z.string().uuid()).optional().default([]),
  confirmOverwriteRfqId: z.string().uuid().optional(),
});

export type CreateRfqFromIntakeInput = z.infer<typeof createRfqFromIntakeSchema>;

