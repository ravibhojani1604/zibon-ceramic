
'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

// This is the hardcoded Firebase configuration.
const firebaseConfig = {
  apiKey: "AIzaSyCh0pbSxgcoKN4cMxlWN58JL5c-PwgHjP4",
  authDomain: "zibon-ceramic.firebaseapp.com",
  projectId: "zibon-ceramic",
  storageBucket: "zibon-ceramic.firebasestorage.app", // Updated to match user's last provided config
  messagingSenderId: "758308365599",
  appId: "1:758308365599:web:ea5eee0961d260002a3c2a",
  measurementId: "G-5SG9ZV3YRY",
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let initializationPromise: Promise<{ app: FirebaseApp, auth: Auth, db: Firestore }> | null = null;

const initializeFirebase = (): Promise<{ app: FirebaseApp, auth: Auth, db: Firestore }> => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise(async (resolve, reject) => {
    if (typeof window === 'undefined') {
      // Should not happen in client components, but as a safeguard
      console.warn("Firebase initialization attempted on the server. This should be client-side.");
      // @ts-ignore
      return reject(new Error("Firebase can only be initialized on the client."));
    }

    try {
      if (!getApps().length) {
        appInstance = initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully.");
      } else {
        appInstance = getApp();
        console.log("Firebase app already initialized.");
      }

      authInstance = getAuth(appInstance);
      console.log("Auth instance obtained.");
      
      dbInstance = initializeFirestore(appInstance, {
        experimentalForceLongPolling: true,
        // Adding other settings as needed, for example:
        // useFetchStreams: false, // if you encounter issues with streams in some environments
      });
      console.log("Firestore instance obtained.");

      resolve({ app: appInstance, auth: authInstance, db: dbInstance });
    } catch (error: any) {
      console.error("Firebase initialization error:", error);
      // Ensure instances are undefined on error
      appInstance = undefined;
      authInstance = undefined;
      dbInstance = undefined;
      initializationPromise = null; // Reset promise so it can be retried if necessary
      reject(error);
    }
  });
  return initializationPromise;
};


export const getFirebaseInstances = async (): Promise<{ app: FirebaseApp, auth: Auth, db: Firestore }> => {
  if (!appInstance || !authInstance || !dbInstance) {
    return initializeFirebase();
  }
  return { app: appInstance, auth: authInstance, db: dbInstance };
};

// Optional: A helper to ensure Firebase is initialized before specific operations
// This can be useful if some parts of your app might try to use Firebase before AuthProvider has fully run.
export const ensureFirebaseInitialized = async (): Promise<{ app: FirebaseApp, auth: Auth, db: Firestore }> => {
    return getFirebaseInstances();
};

