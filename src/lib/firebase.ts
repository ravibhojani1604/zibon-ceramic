'use client'; 

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
// Auth is not used directly in this file anymore after login removal, but ensureFirebaseInitialized might be called by other parts.
// For simplicity, we'll keep getAuth here if ensureFirebaseInitialized is meant to be a complete setup,
// but it's not strictly necessary if auth features are entirely removed from the app.
import { getAuth, type Auth } from 'firebase/auth'; 
import { getFirestore, type Firestore } from 'firebase/firestore';

// Hardcoded Firebase configuration as provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyCh0pbSxgcoKN4cMxlWN58JL5c-PwgHjP4",
  authDomain: "zibon-ceramic.firebaseapp.com",
  projectId: "zibon-ceramic",
  storageBucket: "zibon-ceramic.appspot.com", // Corrected format
  messagingSenderId: "758308365599",
 // Removed authDomain: "zibon-ceramic.firebaseapp.com",
  appId: "1:758308365599:web:ea5eee0961d260002a3c2a",
  measurementId: "G-5SG9ZV3YRY"
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined; // Kept for potential full initialization scope
let dbInstance: Firestore | undefined;

const initializationPromise: Promise<{ app: FirebaseApp | undefined, auth: Auth | undefined, db: Firestore | undefined }> = (async () => {
  if (typeof window === 'undefined') {
    // On the server, instances will be undefined
    return { app: undefined, auth: undefined, db: undefined };
  }

  try {
    let app: FirebaseApp;
    console.log("Attempting to initialize Firebase...");
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully.");
    } else {
      app = getApp();
      console.log("Firebase app already initialized.");
    }    
    console.log("Getting Auth instance...");
    const auth = getAuth(app);
    console.log("Auth instance obtained.");

    console.log("Getting Firestore instance...");
    const db = getFirestore(app, {
      experimentalForceLongPolling: true,
    });
    console.log("Firestore instance obtained.");

    return { app, auth, db };

  } catch (error: any) {
    console.error("Firebase initialization error:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    // Return undefined instances on error
    return { app: undefined, auth: undefined, db: undefined };
  }
})();

export const getFirebaseInstances = (): Promise<{ app: FirebaseApp | undefined, auth: Auth | undefined, db: Firestore | undefined }> => {
  return initializationPromise;
};