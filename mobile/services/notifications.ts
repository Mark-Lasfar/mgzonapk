import messaging from '@react-native-firebase/messaging'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from './api'

export class NotificationService {
  async requestPermission() {
    try {
      const authStatus = await messaging().requestPermission()
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL

      if (enabled) {
        const fcmToken = await this.getFCMToken()
        if (fcmToken) {
          await this.updateFCMToken(fcmToken)
        }
      }

      return enabled
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return false
    }
  }

  private async getFCMToken() {
    const fcmToken = await messaging().getToken()
    await AsyncStorage.setItem('@MGZon:fcmToken', fcmToken)
    return fcmToken
  }

  private async updateFCMToken(token: string) {
    try {
      await api.post('/users/fcm-token', { token })
    } catch (error) {
      console.error('Failed to update FCM token:', error)
    }
  }

  setupNotificationListeners() {
    // Handle FCM token refresh
    messaging().onTokenRefresh(async (token) => {
      await this.updateFCMToken(token)
    })

    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background Message:', remoteMessage)
      // Handle background message (e.g., update local storage, show notification)
    })

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground Message:', remoteMessage)
      // Handle foreground message (e.g., show in-app notification)
    })

    // Handle notification open
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage)
      // Handle notification tap (e.g., navigate to specific screen)
    })

    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('Initial notification:', remoteMessage)
          // Handle notification tap (e.g., navigate to specific screen)
        }
      })
  }
}

export const notificationService = new NotificationService()