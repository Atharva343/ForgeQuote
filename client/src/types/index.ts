export type UserRole = 'ESTIMATOR' | 'SALES_HEAD';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface AuthResponse {
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ----------------------------------------------------
// CUSTOMER & RFQ MODELS
// ----------------------------------------------------

export interface Customer {
  id: string;
  name: string;
  industry: string;
  contactEmail?: string | null;
  _count?: {
    rfqs: number;
  };
}

export type RfqStatus = 'ESTIMATING' | 'SENT' | 'WON' | 'LOST';

export interface RfqPart {
  id: string;
  rfqId?: string;
  partName: string;
  partNumber?: string | null;
  drawingNumber?: string | null;
  material: string;
  grossWeightKg: number;
  annualVolume: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  routingOperations?: Array<{
    id: string;
    sequence: number;
    operationName: string;
    machineCode: string;
    setupTimeMinutes: number;
    cycleTimeMinutes: number;
  }>;
}

export interface RfqDocument {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedById?: string | null;
  uploadedBy?: {
    id: string;
    name: string;
  } | null;
}

export interface QuotationSummary {
  id: string;
  quoteNumber: string;
  version: number;
  status: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface Rfq {
  id: string;
  rfqNumber: string;
  customerId: string;
  title: string;
  description?: string | null;
  receivedAt: string;
  dueDate?: string | null;
  status: RfqStatus;
  ownerId?: string | null;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  owner?: User | null;
  parts: RfqPart[];
  documents?: RfqDocument[];
  quotations?: QuotationSummary[];
  _count?: {
    parts: number;
    documents: number;
    quotations: number;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export type RfqPagination = Pagination;

export interface RfqListResponse {
  rfqs: Rfq[];
  pagination: RfqPagination;
}

export interface RfqQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: RfqStatus | '';
  customerId?: string;
  ownerId?: string;
  sortBy?: 'receivedAt' | 'createdAt' | 'dueDate' | 'rfqNumber' | 'status' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePartInput {
  partName: string;
  partNumber?: string | null;
  drawingNumber?: string | null;
  material: string;
  grossWeightKg: number;
  annualVolume: number;
  notes?: string | null;
}

export interface CreateRfqInput {
  title: string;
  customerId: string;
  description?: string | null;
  dueDate?: string | null;
  parts: CreatePartInput[];
}

export interface UpdateRfqInput {
  title?: string;
  customerId?: string;
  description?: string | null;
  dueDate?: string | null;
  parts?: Array<Partial<CreatePartInput> & { id?: string }>;
}

export interface UpdateRfqStatusInput {
  status: RfqStatus;
  lostReason?: string | null;
}

// ----------------------------------------------------
// RATE MASTER MODELS
// ----------------------------------------------------

export type RateValidityStatus = 'CURRENT' | 'EXPIRED' | 'UPCOMING';

export interface MaterialRate {
  id: string;
  materialCode: string;
  materialName: string;
  ratePerKg: number;
  currency: string;
  validFrom: string;
  validTo?: string | null;
  status: RateValidityStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MachineRate {
  id: string;
  operationCode: string;
  operationName: string;
  machineName: string;
  hourlyRate: number;
  currency: string;
  validFrom: string;
  validTo?: string | null;
  status: RateValidityStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialRateInput {
  materialCode: string;
  materialName: string;
  ratePerKg: number;
  currency?: string;
  validFrom: string;
  validTo?: string | null;
}

export interface CreateMachineRateInput {
  operationCode: string;
  operationName: string;
  machineName: string;
  hourlyRate: number;
  currency?: string;
  validFrom: string;
  validTo?: string | null;
}

export interface CloseRateInput {
  validTo: string;
}

export interface RateQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ALL' | 'CURRENT' | 'EXPIRED' | 'UPCOMING';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RateListResponse<T> {
  rates: T[];
  pagination: RfqPagination;
}

// ----------------------------------------------------
// COSTING & QUOTATION MODELS
// ----------------------------------------------------

export interface OperationCostDetail {
  sequence: number;
  operationName: string;
  machineCode: string;
  machineName: string;
  hourlyRate: number;
  setupTimeMinutes: number;
  cycleTimeMinutes: number;
  cycleCost: number;
  setupCost: number;
  totalOperationCost: number;
}

export interface VolumeScenarioResult {
  productionVolume: number;
  materialCost: number;
  processCost: number;
  scrapCost: number;
  overheadCost: number;
  freightCost: number;
  totalCost: number;
  marginPercentage: number;
  sellingPriceBeforeGst: number;
  gstPercentage: number;
  gstAmount: number;
  sellingPriceWithGst: number;
  annualValue: number;
  operationDetails: OperationCostDetail[];
}

export interface CostingCalculationResult {
  rfq?: {
    id: string;
    rfqNumber: string;
    title: string;
    customerName: string;
  };
  rfqPart: {
    id: string;
    partName: string;
    partNumber?: string | null;
    drawingNumber?: string | null;
    material: string;
    grossWeightKg: number;
    annualVolume: number;
  };
  quotationDate: string;
  rateSnapshot: {
    quotationDate: string;
    material: {
      id: string;
      materialCode: string;
      materialName: string;
      ratePerKg: number;
      currency: string;
      validFrom: string;
      validTo: string | null;
    };
    routingOperations: Array<{
      id: string;
      sequence: number;
      operationName: string;
      machineCode: string;
      machineName: string;
      hourlyRate: number;
      currency: string;
      setupTimeMinutes: number;
      cycleTimeMinutes: number;
      validFrom: string;
      validTo: string | null;
    }>;
  };
  costBreakdown: {
    scrapPercentage: number;
    overheadPercentage: number;
    freightPerUnit: number;
    marginPercentage: number;
    gstPercentage: number;
    annualProductionVolume: number;
  };
  scenarios: VolumeScenarioResult[];
}

export interface CostingInput {
  rfqPartId: string;
  scrapPercentage: number;
  overheadPercentage: number;
  freightPerUnit: number;
  marginPercentage: number;
  gstPercentage: number;
  volumeScenarios: number[];
  quotationDate?: string;
}

export interface QuoteVolumePriceItem {
  id: string;
  quotePartId: string;
  productionVolume: number;
  materialCost: number;
  processCost: number;
  scrapCost: number;
  overheadCost: number;
  freightCost: number;
  totalCost: number;
  marginPercentage: number;
  sellingPricePerUnit: number;
  annualValue: number;
  gstPercentage: number;
  gstAmount: number;
  sellingPriceWithGst: number;
}

export interface QuotePartItem {
  id: string;
  quotationId: string;
  rfqPartId: string;
  rateSnapshot: any;
  costBreakdown: any;
  createdAt: string;
  rfqPart: RfqPart;
  volumePrices: QuoteVolumePriceItem[];
}

export interface QuotationPdfRecord {
  id: string;
  quotationId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  generatedById?: string | null;
  createdAt: string;
}

export interface PdfGenerationResponse {
  pdfId: string;
  quotationId: string;
  quoteNumber: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  downloadUrl?: string;
  isExisting: boolean;
}

export interface PdfDownloadResponse {
  pdfRecord: QuotationPdfRecord;
  downloadUrl: string;
  expiresInSeconds: number;
}

export interface QuotationRecord {
  id: string;
  quoteNumber: string;
  rfqId: string;
  version: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT';
  createdById: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  rfq?: Rfq;
  createdBy?: User;
  quoteParts: QuotePartItem[];
  pdf?: QuotationPdfRecord | null;
}

// ----------------------------------------------------
// APPROVAL WORKFLOW MODELS
// ----------------------------------------------------

export interface ApprovalQueueItem extends QuotationRecord {
  highestAnnualPreGstValue: number;
  requiresApproval: boolean;
  thresholdValue: number;
}

export interface ApprovalQueueResponse {
  items: ApprovalQueueItem[];
  pagination: Pagination;
}

export interface ApprovalHistoryItem {
  id: string;
  decision: 'SUBMITTED' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | string;
  action: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  role: string;
  timestamp: string;
  rejectionReason: string | null;
  requiresApproval: boolean;
  thresholdValue: number;
  evaluatedAnnualValue: number | null;
  comments: string | null;
}

export interface SubmitQuotationResponse {
  quotation: QuotationRecord;
  requiresApproval: boolean;
  evaluatedAnnualValue: number;
  thresholdValue: number;
}



