import api from './api';

export interface LoginPayload {
  phone?: string;
  email?: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  password: string;
  preferredLanguage?: 'fr' | 'en';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    role?: string;
  };
}

export const authService = {
  clientLogin: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/client/login', payload),

  clientRegister: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/client/register', payload),

  employeeLogin: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/employee/login', payload),

  clientRefresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/client/refresh', { refreshToken }),

  employeeRefresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/employee/refresh', { refreshToken }),

  googleAuth: (idToken: string) =>
    api.post<AuthResponse>('/auth/client/google', { idToken }),
};
