import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authService, AuthResponse, LoginPayload, RegisterPayload } from '../services/auth';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  portal: 'client' | 'admin';
  error: string | null;

  setPortal: (portal: 'client' | 'admin') => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  employeeLogin: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
}

const handleAuthSuccess = async (data: AuthResponse, portal: 'client' | 'admin') => {
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  await SecureStore.setItemAsync('user', JSON.stringify(data.user));
  await SecureStore.setItemAsync('portal', portal);
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  portal: 'client',
  error: null,

  setPortal: (portal) => set({ portal }),

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authService.clientLogin(payload);
      await handleAuthSuccess(data, 'client');
      set({ user: data.user, isAuthenticated: true, isLoading: false, portal: 'client' });
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authService.clientRegister(payload);
      await handleAuthSuccess(data, 'client');
      set({ user: data.user, isAuthenticated: true, isLoading: false, portal: 'client' });
    } catch (err: any) {
      const message = err.response?.data?.error || 'Registration failed';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  employeeLogin: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authService.employeeLogin(payload);
      await handleAuthSuccess(data, 'admin');
      set({ user: data.user, isAuthenticated: true, isLoading: false, portal: 'admin' });
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('portal');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  restore: async () => {
    try {
      const userStr = await SecureStore.getItemAsync('user');
      const token = await SecureStore.getItemAsync('accessToken');
      const portal = (await SecureStore.getItemAsync('portal')) as 'client' | 'admin' || 'client';
      if (userStr && token) {
        set({ user: JSON.parse(userStr), isAuthenticated: true, isLoading: false, portal });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
