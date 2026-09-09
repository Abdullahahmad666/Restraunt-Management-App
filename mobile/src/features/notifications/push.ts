/**
 * Push notification setup - the foreground display handler, plus getting
 * this device's Expo push token so it can be registered with the backend
 * (see registerDevice in ./api) and actually receive what the notifications
 * feature sends: shift reminders, a manager's staff check-in/out alerts,
 * and so on.
 *
 * Only works in a development or production build - Expo Go dropped remote
 * push notification support as of SDK 53, so this silently gives up there
 * instead of showing a permission prompt for a token that will never
 * arrive. This project already ships expo-dev-client for exactly that
 * reason; running through `expo start` into Expo Go will never receive a
 * push, a dev build will.
 */
import Constants, {ExecutionEnvironment} from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

import type {DevicePlatform} from './types';

// Registered once at import time - this module is only ever imported from
// the one place (useRegisterPushToken) that runs for the lifetime of the app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getExpoPushToken(): Promise<{
  token: string;
  platform: DevicePlatform;
} | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return null;
  }

  const {data: token} = await Notifications.getExpoPushTokenAsync({projectId});
  return {token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID'};
}
