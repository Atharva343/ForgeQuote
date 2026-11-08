import apiClient from '../lib/axios';
import {
  MaterialRate,
  MachineRate,
  CreateMaterialRateInput,
  CreateMachineRateInput,
  CloseRateInput,
  RateQueryParams,
  RateListResponse,
  ApiResponse,
} from '../types';

export const rateService = {
  // =========================================================================
  // MATERIAL RATES
  // =========================================================================

  /**
   * Fetch paginated list of material rates
   */
  async getMaterialRates(params: RateQueryParams = {}): Promise<RateListResponse<MaterialRate>> {
    const cleanedParams: Record<string, any> = {};
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanedParams[key] = val;
      }
    });

    const res = await apiClient.get<ApiResponse<RateListResponse<MaterialRate>>>('/rates/materials', {
      params: cleanedParams,
    });

    return (
      res.data.data || {
        rates: [],
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
   * Fetch complete version history for a given materialCode
   */
  async getMaterialRateHistory(materialCode: string): Promise<MaterialRate[]> {
    const res = await apiClient.get<ApiResponse<{ materialCode: string; history: MaterialRate[] }>>(
      `/rates/materials/${encodeURIComponent(materialCode)}/history`
    );
    return res.data.data?.history || [];
  },

  /**
   * Create a new material rate version
   */
  async createMaterialRate(data: CreateMaterialRateInput): Promise<MaterialRate> {
    const res = await apiClient.post<ApiResponse<{ rate: MaterialRate }>>('/rates/materials', data);
    if (!res.data.data?.rate) {
      throw new Error(res.data.message || 'Failed to create material rate');
    }
    return res.data.data.rate;
  },

  /**
   * Controlled end of validity for a material rate
   */
  async closeMaterialRate(id: string, data: CloseRateInput): Promise<MaterialRate> {
    const res = await apiClient.patch<ApiResponse<{ rate: MaterialRate }>>(`/rates/materials/${id}/close`, data);
    if (!res.data.data?.rate) {
      throw new Error(res.data.message || 'Failed to close material rate validity');
    }
    return res.data.data.rate;
  },

  // =========================================================================
  // MACHINE RATES
  // =========================================================================

  /**
   * Fetch paginated list of machine rates
   */
  async getMachineRates(params: RateQueryParams = {}): Promise<RateListResponse<MachineRate>> {
    const cleanedParams: Record<string, any> = {};
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanedParams[key] = val;
      }
    });

    const res = await apiClient.get<ApiResponse<RateListResponse<MachineRate>>>('/rates/machines', {
      params: cleanedParams,
    });

    return (
      res.data.data || {
        rates: [],
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
   * Fetch complete version history for a given operationCode
   */
  async getMachineRateHistory(operationCode: string): Promise<MachineRate[]> {
    const res = await apiClient.get<ApiResponse<{ operationCode: string; history: MachineRate[] }>>(
      `/rates/machines/${encodeURIComponent(operationCode)}/history`
    );
    return res.data.data?.history || [];
  },

  /**
   * Create a new machine rate version
   */
  async createMachineRate(data: CreateMachineRateInput): Promise<MachineRate> {
    const res = await apiClient.post<ApiResponse<{ rate: MachineRate }>>('/rates/machines', data);
    if (!res.data.data?.rate) {
      throw new Error(res.data.message || 'Failed to create machine rate');
    }
    return res.data.data.rate;
  },

  /**
   * Controlled end of validity for a machine rate
   */
  async closeMachineRate(id: string, data: CloseRateInput): Promise<MachineRate> {
    const res = await apiClient.patch<ApiResponse<{ rate: MachineRate }>>(`/rates/machines/${id}/close`, data);
    if (!res.data.data?.rate) {
      throw new Error(res.data.message || 'Failed to close machine rate validity');
    }
    return res.data.data.rate;
  },
};

