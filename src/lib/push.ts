import { app } from './firebase';

const DEFAULT_VAPID_KEY = 'BANoMmpeuOTAK5zhi4NxLvy7a7cJrvLQ0Bxu_CnT0abaD2yW4ejqSLGdtEVp4lQlBaNjtVnqU_Vd4VW0jugAa0o';
const VAPID_KEY = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || DEFAULT_VAPID_KEY).trim();

function resolveMessagingSwUrl(): string {
  const base = String(import.meta.env.BASE_URL || '/');
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}firebase-messaging-sw.js`;
}

// getToken() fails with "no active Service Worker" if the worker is still installing.
async function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return registration;

  const pending = registration.installing || registration.waiting;
  if (!pending) return navigator.serviceWorker.ready;

  await new Promise<void>((resolve) => {
    const onStateChange = () => {
      if (pending.state === 'activated' || pending.state === 'redundant') {
        pending.removeEventListener('statechange', onStateChange);
        resolve();
      }
    };
    pending.addEventListener('statechange', onStateChange);
  });

  return registration;
}

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

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await waitForActiveServiceWorker(
    await navigator.serviceWorker.register(resolveMessagingSwUrl()),
  );
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  return token || null;
}
