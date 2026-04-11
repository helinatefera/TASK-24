import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Use cached user for instant render; will be verified against server below
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const isAuthenticated = !!user;

  // On mount, fetch authoritative user profile from server via httpOnly session cookie.
  // This replaces any stale/tampered localStorage data with the server's truth.
  useEffect(() => {
    apiClient.get('/auth/me')
      .then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        // No valid session — clear cached user
        localStorage.removeItem('user');
        setUser(null);
      });
  }, []);

  async function login(username: string, password: string) {
    // Server sets httpOnly cookie; response contains user (no token)
    const res = await apiClient.post('/auth/login', { username, password });
    const serverUser = res.data.user;
    setUser(serverUser);
    localStorage.setItem('user', JSON.stringify(serverUser));
  }

  async function register(data: { username: string; email: string; password: string; role?: string }) {
    const res = await apiClient.post('/auth/register', data);
    const serverUser = res.data.user;
    setUser(serverUser);
    localStorage.setItem('user', JSON.stringify(serverUser));
  }

  async function logout() {
    try {
      await apiClient.post('/auth/logout'); // Server clears httpOnly cookie
    } catch {}
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
