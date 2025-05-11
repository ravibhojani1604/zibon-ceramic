
'use client'; // Firebase should ideally be initialized on the client

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Check if all required environment variables are present
const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional, for Analytics
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

let initializationPromise: Promise<void>;

const missingEnvVars: string[] = [];
if (!firebaseClientConfig.apiKey) missingEnvVars.push('NEXT_PUBLIC_FIREBASE_API_KEY');
if (!firebaseClientConfig.authDomain) missingEnvVars.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
if (!firebaseClientConfig.projectId) missingEnvVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseClientConfig.storageBucket) missingEnvVars.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
if (!firebaseClientConfig.messagingSenderId) missingEnvVars.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
if (!firebaseClientConfig.appId) missingEnvVars.push('NEXT_PUBLIC_FIREBASE_APP_ID');
// measurementId is optional for core functionality, so not strictly checked here unless needed.

if (missingEnvVars.length > 0) {
  const errorMessage = `Firebase configuration is incomplete. The following environment variables are missing or empty: ${missingEnvVars.join(", ")}. Please check your .env.local file or server environment variables.`;
  console.error(errorMessage);
  initializationPromise = Promise.reject(new Error(errorMessage));
  // To prevent "auth is not defined" or "db is not defined" errors later,
  // we ensure they are undefined if initialization fails.
  appInstance = undefined;
  authInstance = undefined;
  dbInstance = undefined;
} else {
   // Initialize Firebase
  if (typeof window !== 'undefined') { // Ensure Firebase is initialized only on the client-side
    if (!getApps().length) {
      try {
        appInstance = initializeApp(firebaseClientConfig);
        authInstance = getAuth(appInstance);
        dbInstance = getFirestore(appInstance);
        initializationPromise = Promise.resolve();
      } catch (error: any) {
        console.error("Firebase initialization error:", error.message);
        initializationPromise = Promise.reject(error);
        appInstance = undefined;
        authInstance = undefined;
        dbInstance = undefined;
      }
    } else {
      appInstance = getApp();
      authInstance = getAuth(appInstance);
      dbInstance = getFirestore(appInstance);
      initializationPromise = Promise.resolve();
    }
  } else {
    // On the server, these instances will be undefined unless initialized differently.
    // For this app structure, client-side initialization is primary.
    // Resolve the promise, but instances will be undefined until client-side init.
    initializationPromise = Promise.resolve();
  }
}

export const ensureFirebaseInitialized = (): Promise<void> => {
  return initializationPromise;
};

export { appInstance as app, authInstance as auth, dbInstance as db };
