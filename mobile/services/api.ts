import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const api = axios.create({
  baseURL: 'https://hager-zon.vercel.app',
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@MGZon:token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['@MGZon:token', '@MGZon:user']);
      // Handle unauthorized access (e.g., redirect to login)
    }
    return Promise.reject(error);
  }
);