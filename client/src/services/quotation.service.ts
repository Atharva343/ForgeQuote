import apiClient from '../lib/axios';
import {
  CostingInput,
  CostingCalculationResult,
  QuotationRecord,
  ApiResponse,
  PdfGenerationResponse,
  PdfDownloadResponse,
} from '../types';

export const quotationService = {
  /**
   * Preview deterministic costing for a part without saving
   */
  async previewCosting(
    rfqId: string,
    input: CostingInput
  ): Promise<CostingCalculationResult> {
    const res = await apiClient.post<ApiResponse<CostingCalculationResult>>(
      `/rfqs/${rfqId}/quotations/preview`,
      input
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to preview costing');
    }
    return res.data.data;
  },

  /**
   * Create and persist a new DRAFT quotation with immutable rate snapshots
   */
  async createQuotation(
    rfqId: string,
    input: CostingInput
  ): Promise<QuotationRecord> {
    const res = await apiClient.post<ApiResponse<{ quotation: QuotationRecord }>>(
      `/rfqs/${rfqId}/quotations`,
      input
    );
    if (!res.data.data?.quotation) {
      throw new Error(res.data.message || 'Failed to create quotation');
    }
    return res.data.data.quotation;
  },

  /**
   * Fetch all quotation versions for an RFQ
   */
  async getQuotationsByRfq(rfqId: string): Promise<QuotationRecord[]> {
    const res = await apiClient.get<
      ApiResponse<{ quotations: QuotationRecord[] }>
    >(`/rfqs/${rfqId}/quotations`);
    return res.data.data?.quotations || [];
  },

  /**
   * Fetch a single quotation by ID
   */
  async getQuotationById(id: string): Promise<QuotationRecord> {
    const res = await apiClient.get<ApiResponse<{ quotation: QuotationRecord }>>(
      `/quotations/${id}`
    );
    if (!res.data.data?.quotation) {
      throw new Error(res.data.message || 'Quotation not found');
    }
    return res.data.data.quotation;
  },

  /**
   * Generate customer-facing PDF for an APPROVED quotation
   */
  async generatePdf(quotationId: string): Promise<PdfGenerationResponse> {
    const res = await apiClient.post<ApiResponse<PdfGenerationResponse>>(
      `/quotations/${quotationId}/pdf`
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to generate quotation PDF');
    }
    return res.data.data;
  },

  /**
   * Retrieve PDF metadata and short-lived signed URL
   */
  async getPdf(quotationId: string): Promise<PdfDownloadResponse> {
    const res = await apiClient.get<ApiResponse<PdfDownloadResponse>>(
      `/quotations/${quotationId}/pdf`
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve quotation PDF metadata');
    }
    return res.data.data;
  },

  /**
   * Securely stream & trigger browser download of PDF artifact
   */
  async downloadPdfBlob(quotationId: string, defaultFileName?: string): Promise<void> {
    const res = await apiClient.get(`/quotations/${quotationId}/pdf?stream=true`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = defaultFileName || `Quotation-${quotationId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

