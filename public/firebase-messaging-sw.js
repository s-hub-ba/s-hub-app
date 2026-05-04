/* global importScripts, firebase */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

let messaging = null;

async function loadFirebaseConfig() {
  const scopeUrl = new URL(self.registration.scope);
  const scopePath = scopeUrl.pathname.replace(/\/$/, '');
  const candidates = [
    new URL('firebase-applet-config.json', self.registration.scope).toString(),
    `${scopeUrl.origin}/firebase-applet-config.json`,
    `${scopeUrl.origin}${scopePath}/firebase-applet-config.json`,
  ];

  let lastError = null;
  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} from ${url}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Failed to load Firebase config. ${String(lastError || 'No config URL resolved')}`);
}

async function initMessaging() {
  if (messaging) return messaging;

  const config = await loadFirebaseConfig();
  const app = firebase.initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  messaging = firebase.messaging(app);
  return messaging;
}

initMessaging()
  .then((instance) => {
    instance.onBackgroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || 'Shift Me Up';
      const body = payload?.notification?.body || payload?.data?.body || 'You have a new update.';
      const link = payload?.data?.link || '/';
      const iconUrl = new URL('favicon.ico', self.registration.scope).toString();

      self.registration.showNotification(title, {
        body,
        icon: iconUrl,
        badge: iconUrl,
        data: { link },
      });
    });
  })
  .catch((error) => {
    // Keep SW active even if messaging setup fails; this avoids breaking installability.
    console.warn('[firebase-messaging-sw] init failed:', error);
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetLink = event.notification?.data?.link || '/';
  const destination = new URL(targetLink, self.registration.scope).toString();

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url === destination && 'focus' in client) {
        await client.focus();
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(destination);
    }
  })());
});
