import apiClient from '../lib/axios';

export interface HealthResponse {
  status: string;
  data: {
    status: string;
    timestamp: string;
    service: string;
    version: string;
  };
}

export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
};

export { apiClient };

