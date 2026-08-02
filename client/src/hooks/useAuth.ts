import { useState, useCallback } from 'react';
import { getToken, setToken, clearToken } from '../utils/localstore';

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = getToken();
    return { token, username: null, isAuthenticated: !!token };
  });

  const login = useCallback((token: string, username: string) => {
    setToken(token);
    setAuth({ token, username, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuth({ token: null, username: null, isAuthenticated: false });
  }, []);

  return { ...auth, login, logout };
}
