import apiClient from '../lib/axios';
import {
  ApprovalQueueResponse,
  ApprovalHistoryItem,
  SubmitQuotationResponse,
  QuotationRecord,
  ApiResponse,
} from '../types';

export const approvalService = {
  /**
   * Submit a DRAFT quotation for approval or direct auto-approval
   */
  async submitQuotation(
    quotationId: string,
    comments?: string
  ): Promise<SubmitQuotationResponse> {
    const res = await apiClient.post<ApiResponse<SubmitQuotationResponse>>(
      `/quotations/${quotationId}/submit`,
      { comments }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to submit quotation');
    }
    return res.data.data;
  },

  /**
   * Fetch the Sales Head approval queue
   */
  async getApprovalQueue(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<ApprovalQueueResponse> {
    const res = await apiClient.get<ApiResponse<ApprovalQueueResponse>>(
      '/approvals/queue',
      { params }
    );
    return (
      res.data.data || {
        items: [],
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
   * Approve a pending quotation (Sales Head only)
   */
  async approveQuotation(
    quotationId: string,
    comments?: string
  ): Promise<{ quotation: QuotationRecord; approval: any }> {
    const res = await apiClient.post<
      ApiResponse<{ quotation: QuotationRecord; approval: any }>
    >(`/quotations/${quotationId}/approve`, { comments });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to approve quotation');
    }
    return res.data.data;
  },

  /**
   * Reject a pending quotation with mandatory reason (Sales Head only)
   */
  async rejectQuotation(
    quotationId: string,
    reason: string
  ): Promise<{ quotation: QuotationRecord; approval: any }> {
    const res = await apiClient.post<
      ApiResponse<{ quotation: QuotationRecord; approval: any }>
    >(`/quotations/${quotationId}/reject`, { reason });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to reject quotation');
    }
    return res.data.data;
  },

  /**
   * Fetch complete submission and approval audit history for a quotation
   */
  async getApprovalHistory(
    quotationId: string
  ): Promise<ApprovalHistoryItem[]> {
    const res = await apiClient.get<
      ApiResponse<{ history: ApprovalHistoryItem[] }>
    >(`/quotations/${quotationId}/approval-history`);
    return res.data.data?.history || [];
  },
};

