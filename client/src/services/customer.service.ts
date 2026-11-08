import apiClient from '../lib/axios';
import { Customer, ApiResponse } from '../types';

export const customerService = {
  async getCustomers(): Promise<Customer[]> {
    const res = await apiClient.get<ApiResponse<{ customers: Customer[] }>>('/customers');
    return res.data.data?.customers || [];
  },
};

