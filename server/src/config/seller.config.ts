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

  // Fully configured legal seller profile with real legal credentials
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

  // Safe Demo Mode: Activated whenever real legal credentials are missing.
  // Never invent GSTIN, registered address, or legal company details.
  // Generated PDFs prominently display DEMO / NOT FOR COMMERCIAL USE.
  return {
    isConfigured: false,
    isDemo: true,
    companyName: companyName
      ? `${companyName} (DEMO / NOT FOR COMMERCIAL USE)`
      : 'ForgeQuote Demo System (DEMO / NOT FOR COMMERCIAL USE)',
    address: address || undefined,
    email: email || undefined,
    phone: phone || undefined,
    gstin: gstin || undefined,
    website: website || undefined,
    paymentTerms: paymentTerms || 'Standard Terms (DEMO / NOT FOR COMMERCIAL USE)',
    deliveryTerms: deliveryTerms || 'Ex-Works (DEMO / NOT FOR COMMERCIAL USE)',
    validityText,
    signatoryName: signatoryName || undefined,
    signatoryDesignation: signatoryDesignation || undefined,
    logoPath,
    missingRequiredFields,
  };
}
