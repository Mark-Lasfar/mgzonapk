import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store } from './store';
import RootNavigator from './navigation/RootNavigator';
import { ThemeProvider } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { Toast } from './components/Toast';
import { notificationService } from './services/notifications';

export default function App() {
  useEffect(() => {
    async function setupNotifications() {
      const hasPermission = await notificationService.requestPermission();
      if (hasPermission) {
        notificationService.setupNotificationListeners();
      }
    }

    setupNotifications();
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <NavigationContainer>
              <RootNavigator />
              <Toast />
            </NavigationContainer>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}
