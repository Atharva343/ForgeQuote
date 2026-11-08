import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().optional(),
    DIRECT_URL: z.string().optional(),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    AUTH_COOKIE_NAME: z.string().default('forgequote_token'),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    GEMINI_API_KEY: z.string().trim().optional(),
    GEMINI_MODEL: z.string().trim().default('gemini-3.5-flash-lite'),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('forgequote-files'),
    SEED_ESTIMATOR_PASSWORD: z.string().optional(),
    SEED_SALES_HEAD_PASSWORD: z.string().optional(),
    SELLER_COMPANY_NAME: z.string().optional(),
    SELLER_GSTIN: z.string().optional(),
    SELLER_ADDRESS: z.string().optional(),
    SELLER_EMAIL: z.string().optional(),
    SELLER_PHONE: z.string().optional(),
    SELLER_WEBSITE: z.string().optional(),
    SELLER_PAYMENT_TERMS: z.string().optional(),
    SELLER_DELIVERY_TERMS: z.string().optional(),
    SELLER_VALIDITY_TEXT: z.string().optional(),
    SELLER_SIGNATORY_NAME: z.string().optional(),
    SELLER_SIGNATORY_DESIGNATION: z.string().optional(),
    SELLER_LOGO_PATH: z.string().optional(),
  })
  .refine(
    (data) => {
      // In production, require strong JWT_SECRET
      if (data.NODE_ENV === 'production' && data.JWT_SECRET.length < 32) {
        return false;
      }
      return true;
    },
    {
      message: 'JWT_SECRET must be at least 32 characters long in production environments',
      path: ['JWT_SECRET'],
    }
  );

export const env = envSchema.parse(process.env);
