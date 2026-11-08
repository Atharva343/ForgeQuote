import { env } from './env';

export interface SellerCompanyProfile {
  isConfigured: boolean;
  isDemo: boolean;
  companyName: string;
  address?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  website?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityText?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  logoPath?: string;
  missingRequiredFields: string[];
}

export function getSellerProfile(): SellerCompanyProfile {
  const isProd = env.NODE_ENV === 'production';

  const companyName = env.SELLER_COMPANY_NAME?.trim();
  const gstin = env.SELLER_GSTIN?.trim();
  const address = env.SELLER_ADDRESS?.trim();
  const email = env.SELLER_EMAIL?.trim();
  const phone = env.SELLER_PHONE?.trim();
  const website = env.SELLER_WEBSITE?.trim();
  const paymentTerms = env.SELLER_PAYMENT_TERMS?.trim();
  const deliveryTerms = env.SELLER_DELIVERY_TERMS?.trim();
  const validityText = env.SELLER_VALIDITY_TEXT?.trim() || '30 days from quotation date';
  const signatoryName = env.SELLER_SIGNATORY_NAME?.trim();
  const signatoryDesignation = env.SELLER_SIGNATORY_DESIGNATION?.trim();
  const logoPath = env.SELLER_LOGO_PATH?.trim();

  const missingRequiredFields: string[] = [];
  if (!companyName) missingRequiredFields.push('Company Legal Name');
  if (!gstin) missingRequiredFields.push('GSTIN');
  if (!address) missingRequiredFields.push('Registered Address');
  if (!email && !phone) missingRequiredFields.push('Contact Information (Email or Phone)');

  const hasAllRequired = missingRequiredFields.length === 0;

  if (hasAllRequired) {
    return {
      isConfigured: true,
      isDemo: false,
      companyName: companyName!,
      address,
      email,
      phone,
      gstin,
      website,
      paymentTerms,
      deliveryTerms,
      validityText,
      signatoryName,
      signatoryDesignation,
      logoPath,
      missingRequiredFields: [],
    };
  }

  // If in production and missing required fields
  if (isProd) {
    return {
      isConfigured: false,
      isDemo: false,
      companyName: companyName || '[SELLER COMPANY NOT CONFIGURED]',
      address,
      email,
      phone,
      gstin,
      website,
      paymentTerms,
      deliveryTerms,
      validityText,
      signatoryName,
      signatoryDesignation,
      logoPath,
      missingRequiredFields,
    };
  }

  // Development/Test fallback: explicitly marked DEMO profile
  return {
    isConfigured: false,
    isDemo: true,
    companyName: 'ForgeQuote Precision Engineering Ltd. (DEMO / NOT FOR COMMERCIAL USE)',
    address: 'Demo Precision Park, Phase II, Chakan, Pune, Maharashtra 410501 [DEMO ADDRESS]',
    email: 'quotes@demo.forgequote.io [DEMO]',
    phone: '+91 20 5555 0199 [DEMO]',
    gstin: '27AAAAA0000A1Z5 [DEMO GSTIN]',
    website: 'https://demo.forgequote.io',
    paymentTerms: '30 Days Net from invoice date [DEMO TERMS]',
    deliveryTerms: 'Ex-Works Pune [DEMO TERMS]',
    validityText: '30 days from quotation date [DEMO]',
    signatoryName: 'Authorized Commercial Signatory [DEMO]',
    signatoryDesignation: 'Head of Estimating & Commercials [DEMO]',
    missingRequiredFields,
  };
}

