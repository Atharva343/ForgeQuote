import apiClient from '../lib/axios';
import {
  Rfq,
  RfqListResponse,
  RfqQueryParams,
  CreateRfqInput,
  UpdateRfqInput,
  UpdateRfqStatusInput,
  ApiResponse,
} from '../types';

export const rfqService = {
  /**
   * Fetch paginated list of RFQs with optional search and filters
   */
  async getRfqs(params: RfqQueryParams = {}): Promise<RfqListResponse> {
    const cleanedParams: Record<string, any> = {};
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanedParams[key] = val;
      }
    });

    const res = await apiClient.get<ApiResponse<RfqListResponse>>('/rfqs', {
      params: cleanedParams,
    });

    return (
      res.data.data || {
        rfqs: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    );
  },

  /**
   * Fetch complete RFQ details by ID
   */
  async getRfqById(id: string): Promise<Rfq> {
    const res = await apiClient.get<ApiResponse<{ rfq: Rfq }>>(`/rfqs/${id}`);
    if (!res.data.data?.rfq) {
      throw new Error(res.data.message || 'RFQ not found');
    }
    return res.data.data.rfq;
  },

  /**
   * Create new RFQ with multiple parts
   */
  async createRfq(data: CreateRfqInput): Promise<Rfq> {
    const res = await apiClient.post<ApiResponse<{ rfq: Rfq }>>('/rfqs', data);
    if (!res.data.data?.rfq) {
      throw new Error(res.data.message || 'Failed to create RFQ');
    }
    return res.data.data.rfq;
  },

  /**
   * Update RFQ metadata or parts
   */
  async updateRfq(id: string, data: UpdateRfqInput): Promise<Rfq> {
    const res = await apiClient.patch<ApiResponse<{ rfq: Rfq }>>(`/rfqs/${id}`, data);
    if (!res.data.data?.rfq) {
      throw new Error(res.data.message || 'Failed to update RFQ');
    }
    return res.data.data.rfq;
  },

  /**
   * Update RFQ workflow status
   */
  async updateRfqStatus(id: string, data: UpdateRfqStatusInput): Promise<Rfq> {
    const res = await apiClient.patch<ApiResponse<{ rfq: Rfq }>>(`/rfqs/${id}/status`, data);
    if (!res.data.data?.rfq) {
      throw new Error(res.data.message || 'Failed to update RFQ status');
    }
    return res.data.data.rfq;
  },
};

