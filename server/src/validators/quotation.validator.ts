import { z } from 'zod';

export const costingInputSchema = z
  .object({
    rfqPartId: z
      .string({ required_error: 'Part ID is required for costing' })
      .uuid('Invalid RFQ part identifier format'),
    scrapPercentage: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ invalid_type_error: 'Scrap percentage must be a number' })
        .min(0, 'Scrap percentage cannot be negative')
        .max(100, 'Scrap percentage cannot exceed 100%')
        .default(0)
    ),
    overheadPercentage: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ invalid_type_error: 'Overhead percentage must be a number' })
        .min(0, 'Overhead percentage cannot be negative')
        .max(500, 'Overhead percentage cannot exceed 500%')
        .default(0)
    ),
    freightPerUnit: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ invalid_type_error: 'Freight per unit must be a number' })
        .min(0, 'Freight per unit cannot be negative')
        .default(0)
    ),
    marginPercentage: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ required_error: 'Margin percentage is required' })
        .min(0, 'Margin percentage cannot be negative')
        .refine((val) => val < 100, {
          message: 'Margin percentage must be strictly less than 100%',
        })
    ),
    gstPercentage: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? 18 : typeof val === 'string' ? parseFloat(val) : val),
      z
        .number({ invalid_type_error: 'GST percentage must be a number' })
        .min(0, 'GST percentage cannot be negative')
        .max(100, 'GST percentage cannot exceed 100%')
        .default(18)
    ),
    volumeScenarios: z
      .array(
        z.preprocess(
          (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
          z
            .number({ invalid_type_error: 'Volume scenario must be an integer' })
            .int('Volume scenario must be an integer')
            .positive('Production volume must be strictly positive (greater than 0)')
        ),
        { required_error: 'At least two volume scenarios are required' }
      )
      .min(2, 'At least two production volume scenarios are required')
      .max(3, 'At most three production volume scenarios are supported'),
    quotationDate: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid quotation date format',
      }),
  })
  .superRefine((data, ctx) => {
    // Check for duplicate volume scenarios
    const seen = new Set<number>();
    for (let i = 0; i < data.volumeScenarios.length; i++) {
      const vol = data.volumeScenarios[i];
      if (seen.has(vol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['volumeScenarios'],
          message: `Duplicate production volume detected: ${vol}. Each volume scenario must be unique.`,
        });
        break;
      }
      seen.add(vol);
    }
  });

export type CostingInput = z.infer<typeof costingInputSchema>;

