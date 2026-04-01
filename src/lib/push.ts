import { app } from './firebase';

const VAPID_KEY = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();

export async function getBrowserFcmToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  if (!VAPID_KEY) {
    console.warn('[push] VITE_FIREBASE_VAPID_KEY missing; skipping push registration');
    return null;
  }

  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  return token || null;
}
