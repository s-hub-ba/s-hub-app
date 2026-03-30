import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.project_id !== 'string'
      || typeof parsed?.client_email !== 'string'
      || typeof parsed?.private_key !== 'string'
    ) {
      console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY is missing required fields');
      return null;
    }

    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (error) {
    console.error('[firebase-admin] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON');
    return null;
  }
}

if (!admin.apps.length) {
  const serviceAccount = parseServiceAccountFromEnv();
  const initOptions: admin.AppOptions = {
    projectId: firebaseConfig.projectId,
  };

  if (serviceAccount) {
    initOptions.credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp(initOptions);
}

const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const db = getFirestore(admin.app(), dbId);
export const auth = admin.auth();
export const messaging = admin.messaging();