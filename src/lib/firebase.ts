
'use client'; 

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Hardcoded Firebase configuration as provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyCh0pbSxgcoKN4cMxlWN58JL5c-PwgHjP4",
  authDomain: "zibon-ceramic.firebaseapp.com",
  projectId: "zibon-ceramic",
  storageBucket: "zibon-ceramic.appspot.com", // Corrected from firebasestorage.app to appspot.com
  messagingSenderId: "758308365599",
  appId: "1:758308365599:web:ea5eee0961d260002a3c2a",
  measurementId: "G-5SG9ZV3YRY"
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

let initializationPromise: Promise<void>;

// Initialize Firebase
if (typeof window !== 'undefined') { // Ensure Firebase is initialized only on the client-side
  if (!getApps().length) {
    try {
      appInstance = initializeApp(firebaseConfig);
      authInstance = getAuth(appInstance);
      dbInstance = getFirestore(appInstance);
      initializationPromise = Promise.resolve();
      console.log("Firebase initialized successfully.");
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
    console.log("Firebase app already initialized.");
  }
} else {
  // On the server, these instances will be undefined unless initialized differently.
  // For this app structure, client-side initialization is primary.
  // Resolve the promise, but instances will be undefined until client-side init.
  initializationPromise = Promise.resolve();
}


export const ensureFirebaseInitialized = (): Promise<void> => {
  return initializationPromise;
};

export { appInstance as app, authInstance as auth, dbInstance as db };

