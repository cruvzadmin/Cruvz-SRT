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
  stream_key: string;
  user_id: string;
  resolution: string;
  settings: any;
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

export interface SixSigmaMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  target_value?: number;
  tolerance?: number;
  sigma_level?: number;
  timestamp: string;
  category: string;
}

export interface OMEStats {
  totalConnections: number;
  inputConnections: any;
  outputConnections: any;
  cpuUsage: number;
  memoryUsage: number;
  networkSentBytes: number;
  networkRecvBytes: number;
}

export interface ProtocolInfo {
  name: string;
  port?: number;
  input_port?: number;
  output_port?: number;
  status: string;
  description: string;
  endpoint?: string;
  input_endpoint?: string;
  output_endpoint?: string;
  connections: number;
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
  async getOMEStats(): Promise<OMEStats> {
    const response = await this.get('/api/ome/stats');
    return response.data;
  }

  async getOMEProtocols(): Promise<{ protocols: Record<string, ProtocolInfo> }> {
    const response = await this.get('/api/ome/protocols');
    return response.data;
  }

  async getOMEVHosts() {
    const response = await this.get('/api/ome/vhosts');
    return response.data;
  }

  async getOMEApplications(vhost: string = 'default') {
    const response = await this.get(`/api/ome/vhosts/${vhost}/apps`);
    return response.data;
  }

  async getOMEStreams(vhost: string = 'default', app: string = 'app') {
    const response = await this.get(`/api/ome/vhosts/${vhost}/apps/${app}/streams`);
    return response.data;
  }

  async startOMERecording(vhost: string, app: string, stream: string, options: any) {
    const response = await this.post(`/api/ome/vhosts/${vhost}/apps/${app}/streams/${stream}/start_recording`, options);
    return response.data;
  }

  async stopOMERecording(vhost: string, app: string, stream: string, recordId: string) {
    const response = await this.post(`/api/ome/vhosts/${vhost}/apps/${app}/streams/${stream}/stop_recording`, { recordId });
    return response.data;
  }

  async startOMEPush(vhost: string, app: string, stream: string, rtmpUrl: string, streamKey: string) {
    const response = await this.post(`/api/ome/vhosts/${vhost}/apps/${app}/streams/${stream}/push`, {
      rtmpUrl,
      streamKey
    });
    return response.data;
  }

  async stopOMEPush(vhost: string, app: string, stream: string, pushId: string) {
    const response = await this.delete(`/api/ome/vhosts/${vhost}/apps/${app}/streams/${stream}/push/${pushId}`);
    return response.data;
  }

  async getOMEHealth() {
    const response = await this.get('/api/ome/health');
    return response.data;
  }

  // Six Sigma Metrics
  async getSixSigmaMetrics(category?: string, timeRange?: string): Promise<SixSigmaMetric[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (timeRange) params.append('range', timeRange);
    
    const response = await this.get(`/api/six-sigma/metrics?${params.toString()}`);
    return response.data;
  }

  async createSixSigmaMetric(metric: Partial<SixSigmaMetric>) {
    const response = await this.post('/api/six-sigma/metrics', metric);
    return response.data;
  }

  async getSixSigmaReport(timeRange: string = '24h') {
    const response = await this.get(`/api/six-sigma/report?range=${timeRange}`);
    return response.data;
  }

  async getQualityDashboard() {
    const response = await this.get('/api/six-sigma/dashboard');
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
