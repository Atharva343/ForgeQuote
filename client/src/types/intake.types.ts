export type ExtractionMethod = 'DETERMINISTIC_EXCEL' | 'DETERMINISTIC_PDF' | 'AI_GEMINI' | 'MANUAL';

export interface ExtractedField<T = any> {
  field: string;
  value: T;
  source: string;
  sourceLocation: string;
  confidence: number;
  extractionMethod: ExtractionMethod;
}

export interface RoutingSuggestionItem {
  sequence: number;
  operationName: string;
  machineCode: string;
  cycleTimeMinutes: number;
  setupTimeMinutes: number;
  sourcePartName: string;
  sourcePartNumber?: string | null;
  sourceRfqNumber: string;
  confidence: number;
  isAccepted?: boolean;
}

export interface ExtractedPartItem {
  id?: string;
  partName: ExtractedField<string>;
  partNumber?: ExtractedField<string | null>;
  drawingNumber?: ExtractedField<string | null>;
  material: ExtractedField<string>;
  grossWeightKg: ExtractedField<number | null>;
  annualVolume: ExtractedField<number | null>;
  notes?: ExtractedField<string | null>;
  routingSuggestions?: RoutingSuggestionItem[];
}

export interface ConflictWarning {
  field: string;
  values: Array<{ source: string; value: any }>;
  warningMessage: string;
}

export interface IntakeExtractionData {
  draftId?: string;
  customerName?: ExtractedField<string | null>;
  rfqTitle?: ExtractedField<string | null>;
  rfqDescription?: ExtractedField<string | null>;
  parts: ExtractedPartItem[];
  conflictWarnings: ConflictWarning[];
  overallConfidence: number;
  extractedAt: string;
}

export interface IntakeDocumentUploaded {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  hasExtractableText: boolean;
  createdAt: string;
}

export interface CreateRfqFromIntakeInput {
  draftId?: string;
  customerId?: string;
  customerName?: string;
  customerIndustry?: string;
  title: string;
  description?: string;
  dueDate?: string;
  receivedAt?: string;
  parts: Array<{
    partName: string;
    partNumber?: string;
    drawingNumber?: string;
    material: string;
    grossWeightKg: number;
    annualVolume: number;
    notes?: string;
    routingOperations?: Array<{
      sequence: number;
      operationName: string;
      machineCode: string;
      cycleTimeMinutes: number;
      setupTimeMinutes: number;
    }>;
  }>;
  documentIds?: string[];
}

