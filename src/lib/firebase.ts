
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
  if (typeof window !== "undefined" && !getApps().length) {
    try {
      appInstance = initializeApp(firebaseConfig);
      authInstance = getAuth(appInstance);
      dbInstance = getFirestore(appInstance);
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // Prevent further execution if Firebase fails to initialize
      appInstance = undefined;
      authInstance = undefined;
      dbInstance = undefined;
    }
  } else if (getApps().length > 0) {
    // For Next.js server-side rendering or if already initialized
    appInstance = getApps()[0];
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
  }
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;

// Helper function to ensure Firebase is initialized before use
export const ensureFirebaseInitialized = async (): Promise<{ app: FirebaseApp, auth: Auth, db: Firestore }> => {
  if (!appInstance || !authInstance || !dbInstance) {
    // This typically means the config was missing or initialization failed.
    // Wait a short period for async initialization if it's just a timing issue on client
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!appInstance || !authInstance || !dbInstance) {
       console.error("Firebase is not initialized. Please check your configuration and ensure .env.local is set up correctly.");
       throw new Error("Firebase not initialized");
    }
  }
  return { app: appInstance!, auth: authInstance!, db: dbInstance! };
};
