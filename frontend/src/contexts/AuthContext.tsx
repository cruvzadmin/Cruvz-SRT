import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Types
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
  message?: string;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem('cruvz_auth_token');
        const storedUser = localStorage.getItem('cruvz_user_data');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // Set axios default authorization header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear corrupted data
        localStorage.removeItem('cruvz_auth_token');
        localStorage.removeItem('cruvz_user_data');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Axios interceptor for token refresh
  useEffect(() => {
    const refreshTokenWrapper = async () => {
      try {
        await refreshToken();
      } catch (refreshError) {
        logout();
      }
    };

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && token) {
          // Token expired, try to refresh or logout
          await refreshTokenWrapper();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token]); // Removed logout dependency to fix order issue

  const logout = (): void => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cruvz_auth_token');
    localStorage.removeItem('cruvz_user');
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await axios.post<AuthResponse>('/api/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        const { user: userData, token: authToken } = response.data.data;
        
        // Update state
        setUser(userData);
        setToken(authToken);
        
        // Store in localStorage
        localStorage.setItem('cruvz_auth_token', authToken);
        localStorage.setItem('cruvz_user_data', JSON.stringify(userData));
        
        // Set axios default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.error || error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await axios.post<AuthResponse>('/api/auth/register', userData);

      if (response.data.success) {
        const { user: newUser, token: authToken } = response.data.data;
        
        // Update state
        setUser(newUser);
        setToken(authToken);
        
        // Store in localStorage
        localStorage.setItem('cruvz_auth_token', authToken);
        localStorage.setItem('cruvz_user_data', JSON.stringify(newUser));
        
        // Set axios default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.error || error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      if (!token) {
        throw new Error('No token available');
      }

      // Note: This endpoint needs to be implemented in the backend
      const response = await axios.post<AuthResponse>('/api/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const { user: userData, token: newToken } = response.data.data;
        
        // Update state
        setUser(userData);
        setToken(newToken);
        
        // Update localStorage
        localStorage.setItem('cruvz_auth_token', newToken);
        localStorage.setItem('cruvz_user_data', JSON.stringify(userData));
        
        // Update axios header
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export types for use in other components
export type { User, RegisterData, AuthResponse };