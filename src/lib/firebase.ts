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
  appId: "1:758308365599:web:ea5eee0961d260002a3c2a",
  measurementId: "G-5SG9ZV3YRY"
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined; // Kept for potential full initialization scope
let dbInstance: Firestore | undefined;

let initializationPromise: Promise<void> = Promise.resolve(); // Default to resolved

if (typeof window !== 'undefined') { // Ensure Firebase is initialized only on the client-side
  if (!getApps().length) {
    try {
      appInstance = initializeApp(firebaseConfig);
      // Initialize Auth and Firestore only if app initialized successfully
      authInstance = getAuth(appInstance); 
      dbInstance = getFirestore(appInstance);
      initializationPromise = Promise.resolve();
      console.log("Firebase initialized successfully.");
    } catch (error: any) {
      console.error("Firebase initialization error:", error.message, error.code);
      initializationPromise = Promise.reject(error);
      // Instances will remain undefined
    }
  } else {
    try {
      appInstance = getApp();
      authInstance = getAuth(appInstance); 
      dbInstance = getFirestore(appInstance);
      initializationPromise = Promise.resolve();
      console.log("Firebase app already initialized.");
    } catch (error: any) {
        console.error("Error getting existing Firebase app/services:", error.message);
        initializationPromise = Promise.reject(error);
    }
  }
} else {
  // On the server, these instances will be undefined.
  // Resolve the promise, but instances will be undefined until client-side init.
  initializationPromise = Promise.resolve();
}

export const ensureFirebaseInitialized = (): Promise<void> => {
  return initializationPromise;
};

// Export instances that might be undefined if initialization fails or on server.
export { appInstance as app, authInstance as auth, dbInstance as db };