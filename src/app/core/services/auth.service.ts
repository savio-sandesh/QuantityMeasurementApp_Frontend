import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_BASE_URL } from '../constants/api.constants';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
  role: 'User';
}

export interface AuthResponse {
  token?: string;
  jwtToken?: string;
  accessToken?: string;
  message?: string;
  error?: string;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  async register(payload: SignupPayload): Promise<AuthResponse> {
    try {
      return await firstValueFrom(this.http.post<AuthResponse>(`${AUTH_API_BASE_URL}/register`, payload));
    } catch (error) {
      throw new Error(this.toFriendlyErrorMessage(error, 'Signup failed. Please try again.'));
    }
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    try {
      const response = await firstValueFrom(this.http.post<AuthResponse>(`${AUTH_API_BASE_URL}/login`, payload));
      const token = response.token || response.jwtToken || response.accessToken;

      if (!token) {
        throw new Error('Login succeeded but token was not returned by the server.');
      }

      this.storeToken(token);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message === 'Login succeeded but token was not returned by the server.') {
        throw error;
      }

      throw new Error(this.toFriendlyErrorMessage(error, 'Invalid credentials. Please check your email and password.'));
    }
  }

  storeToken(token: string): void {
    localStorage.setItem('jwtToken', token);
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('jwtToken') || localStorage.getItem('token');
  }

  clearSession(): void {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('token');
  }

  hasValidSession(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    return !this.isTokenExpired(token);
  }

  isTokenExpired(token: string): boolean {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const expiry = payload?.exp;

      if (typeof expiry !== 'number') {
        return false;
      }

      return Date.now() >= expiry * 1000;
    } catch {
      return false;
    }
  }

  private toFriendlyErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const candidate =
        (error as { error?: unknown }).error ??
        (error as { message?: unknown }).message ??
        (error as { title?: unknown }).title;

      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }

      const status = (error as { status?: unknown }).status;
      if (status === 0) {
        return 'Cannot reach backend API. Please ensure the Web API is running on localhost:5111.';
      }
      if (status === 401) {
        return fallback;
      }
      if (status === 400) {
        return fallback;
      }
      if (status === 500) {
        return 'Server error occurred. Please try again later.';
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
