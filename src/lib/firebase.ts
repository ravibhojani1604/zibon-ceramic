
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

// Check for missing configuration keys
const missingKeys: string[] = [];
if (!firebaseConfig.apiKey) missingKeys.push("API_KEY");
if (!firebaseConfig.authDomain) missingKeys.push("AUTH_DOMAIN");
if (!firebaseConfig.projectId) missingKeys.push("PROJECT_ID");
if (!firebaseConfig.storageBucket) missingKeys.push("STORAGE_BUCKET");
if (!firebaseConfig.messagingSenderId) missingKeys.push("MESSAGING_SENDER_ID");
if (!firebaseConfig.appId) missingKeys.push("APP_ID");

if (missingKeys.length > 0) {
  console.error(
    `Firebase configuration is incomplete. The following environment variables are missing or empty: ${missingKeys.map(key => `NEXT_PUBLIC_FIREBASE_${key}`).join(", ")}. Please check your .env.local file or server environment variables.`
  );
  // appInstance, authInstance, and dbInstance will remain undefined.
} else {
  // Config keys are present and TRUTHY (but could be invalid values like placeholders)
  if (!getApps().length) { // No Firebase app has been initialized yet (applies to server or client first run)
    try {
      // console.log(`Initializing Firebase app (env: ${typeof window === 'undefined' ? 'server' : 'client'})...`);
      appInstance = initializeApp(firebaseConfig);
    } catch (error) {
      console.error(`Firebase initializeApp error (env: ${typeof window === 'undefined' ? 'server' : 'client'}):`, error);
      // appInstance remains undefined
    }
  } else { // Firebase app already exists
    // console.log(`Using existing Firebase app (env: ${typeof window === 'undefined' ? 'server' : 'client'})...`);
    appInstance = getApps()[0];
  }

  // If appInstance was successfully initialized or retrieved
  if (appInstance) {
    try {
      authInstance = getAuth(appInstance);
      dbInstance = getFirestore(appInstance);
    } catch (error) {
      console.error(`Firebase getAuth/getFirestore error (env: ${typeof window === 'undefined' ? 'server' : 'client'}):`, error);
      // Ensure these are undefined if services can't be obtained, even if appInstance exists.
      // This can happen if appInstance was initialized with an invalid config leading to errors here.
      authInstance = undefined;
      dbInstance = undefined;
    }
  }
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;

// Helper function to ensure Firebase is initialized before use
export const ensureFirebaseInitialized = async (): Promise<{ app: FirebaseApp, auth: Auth, db: Firestore }> => {
  // Check if instances are already valid from the initial module load attempt
  if (appInstance && authInstance && dbInstance) {
    return { app: appInstance, auth: authInstance, db: dbInstance };
  }

  // If instances are not set, it means initial setup failed (e.g. config missing, or init error caught above).
  // A short delay might help if there was a race condition, though less likely with the new structure.
  await new Promise(resolve => setTimeout(resolve, 50)); 

  if (!appInstance || !authInstance || !dbInstance) {
     // Errors during the initial (module-level) attempt should have already been logged.
     // This error indicates that those attempts failed and instances are still not available.
     console.error("Firebase is not initialized (ensureFirebaseInitialized). Critical instances missing. Check previous logs for configuration or initialization errors.");
     throw new Error("Firebase not initialized. Firebase app, auth, or firestore instances are missing.");
  }
  
  // Should be unreachable if the above condition is met and throws, but as a safeguard:
  return { app: appInstance!, auth: authInstance!, db: dbInstance! };
};
