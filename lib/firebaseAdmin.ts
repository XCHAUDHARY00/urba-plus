import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import defaultConfig from '../firebase-applet-config.json';

/**
 * Returns a Firebase Admin Firestore instance.
 * Initialises the app on first call using the project ID from env / config.
 * Safe to call multiple times — reuses the existing app after the first init.
 */
export function getAdminDb() {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultConfig.projectId;
  const databaseId =
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ||
    defaultConfig.firestoreDatabaseId;

  const adminApp = !getApps().length ? initializeApp({ projectId }) : getApp();
  return getFirestore(adminApp, databaseId);
}
