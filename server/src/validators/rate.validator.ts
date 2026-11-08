import { z } from 'zod';

export const createMaterialRateSchema = z
  .object({
    materialCode: z
      .string({ required_error: 'Material code is required' })
      .trim()
      .min(1, 'Material code cannot be empty')
      .max(50, 'Material code too long')
      .transform((val) => val.toUpperCase()),
    materialName: z
      .string({ required_error: 'Material name is required' })
      .trim()
      .min(1, 'Material name cannot be empty')
      .max(100, 'Material name too long'),
    ratePerKg: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ required_error: 'Rate per kg is required' })
        .positive('Rate per kg must be greater than 0')
    ),
    currency: z
      .string()
      .trim()
      .max(10)
      .default('INR')
      .transform((val) => val.toUpperCase()),
    validFrom: z
      .string({ required_error: 'Valid from date is required' })
      .trim()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Valid from date must be a valid date format',
      }),
    validTo: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Valid to date must be a valid date format',
      }),
  })
  .refine(
    (data) => {
      if (data.validTo) {
        return new Date(data.validTo).getTime() >= new Date(data.validFrom).getTime();
      }
      return true;
    },
    {
      message: 'Valid to date cannot be earlier than valid from date',
      path: ['validTo'],
    }
  );

export const createMachineRateSchema = z
  .object({
    operationCode: z
      .string({ required_error: 'Operation code is required' })
      .trim()
      .min(1, 'Operation code cannot be empty')
      .max(50, 'Operation code too long')
      .transform((val) => val.toUpperCase()),
    operationName: z
      .string({ required_error: 'Operation name is required' })
      .trim()
      .min(1, 'Operation name cannot be empty')
      .max(100, 'Operation name too long'),
    machineName: z
      .string({ required_error: 'Machine name is required' })
      .trim()
      .min(1, 'Machine name cannot be empty')
      .max(100, 'Machine name too long'),
    hourlyRate: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ required_error: 'Hourly rate is required' })
        .positive('Hourly rate must be greater than 0')
    ),
    currency: z
      .string()
      .trim()
      .max(10)
      .default('INR')
      .transform((val) => val.toUpperCase()),
    validFrom: z
      .string({ required_error: 'Valid from date is required' })
      .trim()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Valid from date must be a valid date format',
      }),
    validTo: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Valid to date must be a valid date format',
      }),
  })
  .refine(
    (data) => {
      if (data.validTo) {
        return new Date(data.validTo).getTime() >= new Date(data.validFrom).getTime();
      }
      return true;
    },
    {
      message: 'Valid to date cannot be earlier than valid from date',
      path: ['validTo'],
    }
  );

export const closeRateSchema = z.object({
  validTo: z
    .string({ required_error: 'End validity date is required' })
    .trim()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'End validity date must be a valid date format',
    }),
});

export const rateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'CURRENT', 'EXPIRED', 'UPCOMING']).default('ALL'),
  sortBy: z.string().trim().default('validFrom'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateMaterialRateInput = z.infer<typeof createMaterialRateSchema>;
export type CreateMachineRateInput = z.infer<typeof createMachineRateSchema>;
export type CloseRateInput = z.infer<typeof closeRateSchema>;
export type RateQueryInput = z.infer<typeof rateQuerySchema>;

