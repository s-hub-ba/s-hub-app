import admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase Admin
// Note: In a real production environment, you should use a service account key.
// Here we attempt to initialize with the project ID.
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
