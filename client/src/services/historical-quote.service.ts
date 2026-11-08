import apiClient from '../lib/axios';
import { ApiResponse } from '../types';
import {
  HistoricalQuoteRecord,
  UploadPreviewData,
  ValidationResult,
  ImportBatchSummary,
  SimilarHistoricalPart,
  ColumnMapping,
  HistoricalQuoteQueryParams,
} from '../types/historical-quote.types';

export const historicalQuoteService = {
  /**
   * Upload Excel/CSV to preview headers, row count, and suggested mapping
   */
  async uploadPreview(file: File): Promise<UploadPreviewData> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<ApiResponse<UploadPreviewData>>(
      '/historical-quotes/upload-preview',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Failed to parse file preview');
    }

    return res.data.data;
  },

  /**
   * Validate all rows against column mapping
   */
  async validateImport(
    file: File,
    columnMapping: ColumnMapping,
    sheetName?: string,
    allowDuplicates: boolean = false
  ): Promise<ValidationResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('columnMapping', JSON.stringify(columnMapping));
    if (sheetName) formData.append('sheetName', sheetName);
    formData.append('allowDuplicates', String(allowDuplicates));

    const res = await apiClient.post<ApiResponse<ValidationResult>>(
      '/historical-quotes/validate',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Validation failed');
    }

    return res.data.data;
  },

  /**
   * Confirm batch import into database
   */
  async confirmImport(payload: {
    fileName: string;
    validRows: any[];
    errorSummary?: any[];
  }): Promise<ImportBatchSummary> {
    const res = await apiClient.post<ApiResponse<ImportBatchSummary>>(
      '/historical-quotes/confirm-import',
      payload
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Failed to commit import batch');
    }

    return res.data.data;
  },

  /**
   * Search historical quotes with server-side pagination & filters
   */
  async searchQuotes(params: HistoricalQuoteQueryParams): Promise<{
    records: HistoricalQuoteRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const res = await apiClient.get<any>('/historical-quotes', {
      params,
    });

    return {
      records: res.data.data || [],
      pagination: res.data.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  },

  /**
   * Get single historical quote details by ID
   */
  async getQuoteById(id: string): Promise<HistoricalQuoteRecord> {
    const res = await apiClient.get<ApiResponse<HistoricalQuoteRecord>>(
      `/historical-quotes/${id}`
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Historical quote not found');
    }

    return res.data.data;
  },

  /**
   * Retrieve explainable similar historical parts
   */
  async getSimilarParts(params: {
    rfqPartId?: string;
    partNumber?: string;
    partName?: string;
    material?: string;
    grossWeightKg?: number;
    annualVolume?: number;
    limit?: number;
  }): Promise<{
    results: SimilarHistoricalPart[];
    message: string;
    disclaimer: string;
  }> {
    const res = await apiClient.get<ApiResponse<SimilarHistoricalPart[]> & { disclaimer?: string }>(
      '/historical-quotes/similar',
      { params }
    );

    return {
      results: res.data.data || [],
      message: res.data.message || '',
      disclaimer:
        res.data.disclaimer ||
        'Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.',
    };
  },
};

