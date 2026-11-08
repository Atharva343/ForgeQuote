import { z } from 'zod';

export const HistoricalQuoteQuerySchema = z.object({
  search: z.string().optional(),
  customerName: z.string().optional(),
  material: z.string().optional(),
  currency: z.string().optional(),
  startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  minQuantity: z.coerce.number().int().min(0).optional(),
  maxQuantity: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['quoteDate', 'quantity', 'unitPrice', 'createdAt', 'customerName', 'partNumber']).default('quoteDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type HistoricalQuoteQueryParams = z.infer<typeof HistoricalQuoteQuerySchema>;

export const ColumnMappingSchema = z.object({
  quoteReference: z.string().min(1, 'Quote reference column is required'),
  customerName: z.string().min(1, 'Customer name column is required'),
  partNumber: z.string().optional(),
  partDescription: z.string().optional(),
  material: z.string().optional(),
  grossWeightKg: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: z.string().optional(),
  currency: z.string().optional(),
  quoteDate: z.string().optional(),
  processDescription: z.string().optional(),
});

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

export const ValidateHistoricalImportSchema = z.object({
  fileName: z.string().min(1),
  sheetName: z.string().optional(),
  columnMapping: ColumnMappingSchema,
  allowDuplicates: z.boolean().default(false),
});

export const SimilarPartQuerySchema = z.object({
  rfqPartId: z.string().uuid().optional(),
  partNumber: z.string().optional(),
  partName: z.string().optional(),
  material: z.string().optional(),
  grossWeightKg: z.coerce.number().positive().optional(),
  annualVolume: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type SimilarPartQueryParams = z.infer<typeof SimilarPartQuerySchema>;

