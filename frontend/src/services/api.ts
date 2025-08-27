import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Types for API responses
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface Stream {
  id: string;
  name: string;
  application: string;
  status: 'live' | 'offline' | 'starting' | 'stopping';
  protocol: 'RTMP' | 'SRT' | 'WebRTC' | 'LLHLS' | 'HLS' | 'MPEGTS';
  viewers: number;
  bitrate: number;
  fps: number;
  duration: string;
  created_at: string;
  updated_at: string;
  input_url: string;
  output_urls: {
    rtmp?: string;
    srt?: string;
    webrtc?: string;
    hls?: string;
    llhls?: string;
  };
}

export interface CreateStreamRequest {
  name: string;
  application: string;
  protocol: Stream['protocol'];
  enableRecording?: boolean;
  enableTranscoding?: boolean;
  maxBitrate?: number;
  targetFps?: number;
}

export interface AnalyticsData {
  timestamp: string;
  viewers: number;
  bitrate: number;
  fps: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIn: number;
  networkOut: number;
}

class ApiService {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await this.instance.post('/api/auth/refresh', {
                refreshToken
              });
              
              const { token } = response.data;
              localStorage.setItem('authToken', token);
              
              // Retry the original request
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete(url, config);
  }

  // Authentication endpoints
  async login(credentials: { username: string; password: string }) {
    const response = await this.post('/api/auth/login', credentials);
    return response.data;
  }

  async register(userData: { username: string; email: string; password: string; fullName: string }) {
    const response = await this.post('/api/auth/register', userData);
    return response.data;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await this.post('/api/auth/logout', { refreshToken });
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // Stream management endpoints
  async getStreams(): Promise<Stream[]> {
    const response = await this.get('/api/streams');
    return response.data;
  }

  async createStream(streamData: CreateStreamRequest): Promise<Stream> {
    const response = await this.post('/api/streams', streamData);
    return response.data;
  }

  async startStream(streamId: string): Promise<void> {
    await this.post(`/api/streams/${streamId}/start`);
  }

  async stopStream(streamId: string): Promise<void> {
    await this.post(`/api/streams/${streamId}/stop`);
  }

  async deleteStream(streamId: string): Promise<void> {
    await this.delete(`/api/streams/${streamId}`);
  }

  async getStreamDetails(streamId: string): Promise<Stream> {
    const response = await this.get(`/api/streams/${streamId}`);
    return response.data;
  }

  // Analytics endpoints
  async getAnalyticsData(timeRange: string = '1h'): Promise<AnalyticsData[]> {
    const response = await this.get(`/api/analytics/data?range=${timeRange}`);
    return response.data;
  }

  async getStreamMetrics() {
    const response = await this.get('/api/analytics/metrics');
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.get('/api/system/health');
    return response.data;
  }

  // OvenMediaEngine integration
  async getOvenMediaEngineStats() {
    const response = await this.get('/api/ovenmediaengine/stats');
    return response.data;
  }

  async getOvenMediaEngineApplications() {
    const response = await this.get('/api/ovenmediaengine/applications');
    return response.data;
  }

  async createOvenMediaEngineApplication(appData: any) {
    const response = await this.post('/api/ovenmediaengine/applications', appData);
    return response.data;
  }

  // Profile management
  async getProfile() {
    const response = await this.get('/api/profile');
    return response.data;
  }

  async updateProfile(profileData: any) {
    const response = await this.put('/api/profile', profileData);
    return response.data;
  }

  async updatePreferences(preferences: any) {
    const response = await this.put('/api/profile/preferences', preferences);
    return response.data;
  }

  async getApiKeys() {
    const response = await this.get('/api/profile/api-keys');
    return response.data;
  }

  async createApiKey(keyData: any) {
    const response = await this.post('/api/profile/api-keys', keyData);
    return response.data;
  }

  async deleteApiKey(keyId: string) {
    await this.delete(`/api/profile/api-keys/${keyId}`);
  }

  async getSecurityLogs() {
    const response = await this.get('/api/profile/security-logs');
    return response.data;
  }

  // Utility methods
  setAuthToken(token: string) {
    localStorage.setItem('authToken', token);
  }

  setRefreshToken(token: string) {
    localStorage.setItem('refreshToken', token);
  }

  getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }

  clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }
}

// Create a singleton instance
export const api = new ApiService();
export default api;