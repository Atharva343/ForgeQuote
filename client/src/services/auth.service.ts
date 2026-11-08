import apiClient from '../lib/axios';
import { ApiResponse, AuthResponse, LoginCredentials, User } from '../types';

export const authService = {
  /**
   * Logs in with email and password. Sets HTTP-only cookie on the backend.
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    if (!response.data.data?.user) {
      throw new Error(response.data.message || 'Login failed');
    }
    return response.data.data.user;
  },

  /**
   * Fetches current authenticated user session via HTTP-only cookie.
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<AuthResponse>>('/auth/me');
    if (!response.data.data?.user) {
      throw new Error(response.data.message || 'Failed to fetch user session');
    }
    return response.data.data.user;
  },

  /**
   * Logs out user and clears the HTTP-only cookie.
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};

export default authService;

