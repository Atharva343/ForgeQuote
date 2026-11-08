export interface HistoricalQuoteRecord {
  id: string;
  quoteReference: string;
  customerName: string;
  partNumber?: string | null;
  partDescription?: string | null;
  material?: string | null;
  grossWeightKg?: number | null;
  quantity?: number | null;
  unitPrice?: number | null;
  currency: string;
  quoteDate?: string | null;
  processDescription?: string | null;
  sourceFileName: string;
  sourceSheet?: string | null;
  sourceRow: number;
  batchId: string;
  importStatus: string;
  recordType: 'HISTORICAL / IMPORTED';
  createdAt: string;
  updatedAt?: string;
  batch?: {
    id: string;
    fileName: string;
    createdAt: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface ColumnMapping {
  quoteReference: string;
  customerName: string;
  partNumber?: string;
  partDescription?: string;
  material?: string;
  grossWeightKg?: string;
  quantity?: string;
  unitPrice?: string;
  currency?: string;
  quoteDate?: string;
  processDescription?: string;
}

export interface UploadPreviewData {
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Partial<ColumnMapping>;
}

export interface RowValidationError {
  row: number;
  sheet: string;
  column?: string;
  value?: any;
  message: string;
}

export interface ValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errors: RowValidationError[];
  validRows: any[];
}

export interface ImportBatchSummary {
  batchId: string;
  totalRows: number;
  importedRows: number;
  invalidRows: number;
  duplicateRows: number;
  status: string;
}

export interface SimilarHistoricalPart {
  id: string;
  quoteReference: string;
  customerName: string;
  partNumber?: string | null;
  partDescription?: string | null;
  material?: string | null;
  grossWeightKg?: number | null;
  quantity?: number | null;
  unitPrice?: number | null;
  currency: string;
  quoteDate?: string | null;
  processDescription?: string | null;
  sourceFileName: string;
  sourceSheet?: string | null;
  sourceRow: number;
  score: number;
  matchingReasons: string[];
  recordType: 'HISTORICAL / IMPORTED';
}

export interface HistoricalQuoteQueryParams {
  search?: string;
  customerName?: string;
  material?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  minQuantity?: number;
  maxQuantity?: number;
  page?: number;
  limit?: number;
  sortBy?: 'quoteDate' | 'quantity' | 'unitPrice' | 'createdAt' | 'customerName' | 'partNumber';
  sortOrder?: 'asc' | 'desc';
}

