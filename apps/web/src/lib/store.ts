'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ApiClient, createApiClient } from '@axioma/api-client';
import type { Balance } from '@axioma/shared';

// ============================================
// Types
// ============================================

interface User {
  id: string;
  email: string;
  role: string;
  balance?: Balance | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setToken: (_token: string | null) => void;
  setUser: (_user: User | null) => void;
  setError: (_error: string | null) => void;
  setLoading: (_loading: boolean) => void;
  logout: () => void;
}

// ============================================
// Auth Store
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      setError: (error) => set({ error }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ token: null, user: null, error: null }),
    }),
    {
      name: 'axioma-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// ============================================
// API Client Singleton
// ============================================

let apiClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClient) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    apiClient = createApiClient({
      baseUrl,
      getToken: () => useAuthStore.getState().token,
      setToken: (token) => useAuthStore.getState().setToken(token),
    });
  }
  return apiClient;
}

// ============================================
// Auth Actions
// ============================================

export async function register(email: string, password: string): Promise<void> {
  const store = useAuthStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const client = getApiClient();
    const response = await client.register({ email, password });
    store.setToken(response.token);
    store.setUser(response.user as User);
  } catch (err: any) {
    store.setError(err.message || 'Registration failed');
    throw err;
  } finally {
    store.setLoading(false);
  }
}

export async function login(email: string, password: string): Promise<void> {
  const store = useAuthStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const client = getApiClient();
    const response = await client.login({ email, password });
    store.setToken(response.token);
    store.setUser(response.user as User);
  } catch (err: any) {
    store.setError(err.message || 'Login failed');
    throw err;
  } finally {
    store.setLoading(false);
  }
}

export async function fetchMe(): Promise<void> {
  const store = useAuthStore.getState();
  if (!store.token) return;

  try {
    const client = getApiClient();
    const user = await client.getMe();
    store.setUser(user as User);
  } catch {
    store.logout();
  }
}

export function logout(): void {
  const store = useAuthStore.getState();
  store.logout();
}
