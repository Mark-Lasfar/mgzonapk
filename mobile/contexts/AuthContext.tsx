import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface AuthContextData {
  isAuthenticated: boolean;
  user: any;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  async function loadStoredData() {
    try {
      const [token, storedUser] = await Promise.all([
        AsyncStorage.getItem('@MGZon:token'),
        AsyncStorage.getItem('@MGZon:user'),
      ]);

      if (token && storedUser) {
        api.defaults.headers.authorization = `Bearer ${token}`;
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading stored auth data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn({ email, password }) {
    try {
      const response = await api.post('/auth/signin', {
        email,
        password,
      });

      const { token, user: userData } = response.data;

      api.defaults.headers.authorization = `Bearer ${token}`;

      await AsyncStorage.setItem('@MGZon:token', token);
      await AsyncStorage.setItem('@MGZon:user', JSON.stringify(userData));

      setUser(userData);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Authentication failed');
    }
  }

  async function signUp(data) {
    try {
      await api.post('/auth/signup', data);
      await signIn({
        email: data.email,
        password: data.password,
      });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  async function signOut() {
    try {
      await AsyncStorage.multiRemove(['@MGZon:token', '@MGZon:user']);
      setUser(null);
      api.defaults.headers.authorization = undefined;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        signIn,
        signOut,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}