import apiClient from '../lib/axios';
import { ApiResponse, Rfq } from '../types';
import {
  IntakeDocumentUploaded,
  IntakeExtractionData,
  CreateRfqFromIntakeInput,
  RoutingSuggestionItem,
} from '../types/intake.types';

export const intakeService = {
  /**
   * Upload an RFQ document (PDF or Excel) to private storage
   */
  async uploadDocument(file: File): Promise<IntakeDocumentUploaded> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<ApiResponse<IntakeDocumentUploaded>>(
      '/rfq-intake/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Failed to upload document');
    }

    return res.data.data;
  },

  /**
   * Run multi-source extraction (Email + Excel + PDF)
   */
  async extractData(payload: {
    emailText?: string;
    documentIds?: string[];
  }): Promise<IntakeExtractionData> {
    const res = await apiClient.post<ApiResponse<IntakeExtractionData>>(
      '/rfq-intake/extract',
      payload
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Extraction failed');
    }

    return res.data.data;
  },

  /**
   * Query historical routing suggestions for a specific part
   */
  async getRoutingSuggestions(params: {
    material: string;
    partName: string;
    annualVolume?: number;
  }): Promise<RoutingSuggestionItem[]> {
    const res = await apiClient.get<ApiResponse<RoutingSuggestionItem[]>>(
      '/rfq-intake/routing-suggestions',
      { params }
    );
    return res.data.data || [];
  },

  /**
   * Fetch intake draft by ID
   */
  async getDraft(id: string): Promise<any> {
    const res = await apiClient.get<ApiResponse<any>>(`/rfq-intake/${id}`);
    return res.data.data;
  },

  /**
   * Confirm and create an RFQ atomically from intake data
   */
  async createRfq(payload: CreateRfqFromIntakeInput): Promise<Rfq> {
    const res = await apiClient.post<ApiResponse<Rfq>>(
      '/rfq-intake/create-rfq',
      payload
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error(res.data.message || 'Failed to create RFQ from intake');
    }

    return res.data.data;
  },
};

