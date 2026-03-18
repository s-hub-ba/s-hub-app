import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const db = getFirestore(admin.app(), dbId);
export const auth = admin.auth();