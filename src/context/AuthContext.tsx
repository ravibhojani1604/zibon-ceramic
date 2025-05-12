
'use client';

import type { ReactNode, FC } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signOut,
  type User,
  type AuthError,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { getFirebaseInstances } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import type { AuthFormData } from '@/components/AuthForm';
// Skeleton and SVG for loading can be here or directly in the JSX
// For simplicity, direct JSX for loading UI is used below.

interface AuthContextType {
  user: User | null;
  loading: boolean; // For login, register, logout operations (authOperationLoading)
  isInitializing: boolean; // Specifically for the initial Firebase auth state check
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authStateUnsubscribeGlobal: (() => void) | null = null;
let firestoreUnsubscribeGlobal: (() => void) | null = null;

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authOperationLoading, setAuthOperationLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setIsMounted(true);
    // Listener initialization moved to a separate effect that depends on isMounted
  }, []);

  const handleAuthError = useCallback((error: AuthError, actionType: 'login' | 'register' | 'logout') => {
    console.error(`${actionType} error:`, error.code, error.message);
    
    let errorDescriptionKeySuffix: string;
    switch (error.code) {
        case 'auth/invalid-credential':
        // For login, 'auth/invalid-credential' covers user-not-found and wrong-password
             errorDescriptionKeySuffix = 'InvalidCredential';
             break;
        case 'auth/user-not-found': // Can still occur if backend rules change or direct API use
        case 'auth/wrong-password': // Can still occur
            errorDescriptionKeySuffix = 'InvalidCredential';
            break;
        case 'auth/user-disabled':
            errorDescriptionKeySuffix = 'UserDisabled';
            break;
        case 'auth/invalid-email':
            errorDescriptionKeySuffix = 'InvalidEmail';
            break;
        case 'auth/email-already-in-use':
            errorDescriptionKeySuffix = 'EmailInUse';
            break;
        case 'auth/weak-password':
            errorDescriptionKeySuffix = 'WeakPassword';
            break;
        case 'auth/network-request-failed':
            errorDescriptionKeySuffix = 'NetworkRequestFailed';
            break;
        case 'auth/requires-recent-login': // Typically for sensitive operations, but good to handle for logout
             errorDescriptionKeySuffix = 'LogoutPermission'; // Custom or generic
             break;
        default:
            // A generic fallback message
            errorDescriptionKeySuffix = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Failed`;
    }
    // Ensure a default message if the specific key isn't found
    const defaultMessage = `An unexpected error occurred during ${actionType}. Code: ${error.code}`;
    const errorDescription = t(`authForm.error${errorDescriptionKeySuffix}`, { default: defaultMessage });

    toast({
      title: t(`authForm.${actionType}FailedTitle`),
      description: errorDescription,
      variant: 'destructive',
    });
  }, [t, toast]);


  useEffect(() => {
    if (!isMounted) return; // Only run on client after mount

    setIsInitializing(true);
    const initializeAuth = async () => {
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
          console.error("Auth service is not available for listener setup.");
          setIsInitializing(false);
          toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          return;
        }

        authStateUnsubscribeGlobal = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setIsInitializing(false);

          if (currentUser) {
            if (pathname === '/login' || pathname === '/register' || pathname === '/') {
              router.replace('/inventory');
            }
          } else {
            // Only redirect if not already on a public page and not the root (which handles its own redirect)
            if (pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
               router.replace('/login');
            }
          }
        }, (error) => {
            console.error("Auth state listener error:", error);
            setUser(null);
            setIsInitializing(false);
            toast({ title: t('authForm.authErrorTitle'), description: error.message, variant: 'destructive' });
        });
      } catch (error) {
        console.error("Error initializing Firebase or Auth listener:", error);
        setUser(null);
        setIsInitializing(false);
        toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
      }
    };

    initializeAuth();

    return () => {
      if (authStateUnsubscribeGlobal) {
        authStateUnsubscribeGlobal();
        authStateUnsubscribeGlobal = null;
      }
      // Global Firestore unsubscriber is managed by the component using it (e.g., InventoryPage)
      // but we ensure it's cleared on logout.
    };
  }, [isMounted, router, t, toast, pathname]);


  const login = async (data: AuthFormData) => {
    setAuthOperationLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged handles user state update and redirection
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
      // router.replace('/inventory'); // This is handled by onAuthStateChanged
    } catch (error) {
      handleAuthError(error as AuthError, 'login');
    } finally {
      setAuthOperationLoading(false);
    }
  };

  const register = async (data: AuthFormData) => {
    setAuthOperationLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) throw new Error("Auth not initialized for register");
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      // After successful registration, redirect to login page
      router.replace('/login'); 
      toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessRedirectLoginDescription')});
    } catch (error) {
      handleAuthError(error as AuthError, 'register');
    } finally {
      setAuthOperationLoading(false);
    }
  };

  const logout = async () => {
    setAuthOperationLoading(true);
    // Unsubscribe Firestore listener if active
    if (firestoreUnsubscribeGlobal) {
      firestoreUnsubscribeGlobal();
      firestoreUnsubscribeGlobal = null;
      console.log("Firestore listener unsubscribed during logout.");
    }
    // Auth state listener (authStateUnsubscribeGlobal) is typically managed by its own useEffect cleanup,
    // but explicitly calling it here ensures it's stopped before signOut if needed, though signOut itself triggers onAuthStateChanged.
    // However, it's safer to let its own effect handle its lifecycle.

    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        // If auth isn't available, manually clear client state and redirect.
        setUser(null); 
        router.replace('/login');
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.authInitErrorLogout'), variant: "warning" });
        return;
      }
      await signOut(auth);
      // onAuthStateChanged will set user to null and trigger redirection.
      // Explicitly setting user to null and redirecting can be redundant but ensures immediate UI update.
      setUser(null); 
      router.replace('/login'); 
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      // Even if signOut fails (e.g. network), force client-side state update.
      console.warn("Logout error:", (error as AuthError).message, "Proceeding with client-side clear.");
      setUser(null); 
      router.replace('/login'); 
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutCompletedClientSide') });
    } finally {
      setAuthOperationLoading(false);
    }
  };
  
  // This loader is shown when AuthProvider is initializing firebase auth state,
  // or when isMounted is false (SSR or initial client render before hydration effect).
  if (!isMounted || isInitializing) {
    const showAnimatedLoader = isMounted && isInitializing; // Only animate if client-side and still initializing

    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          {showAnimatedLoader ? (
            <svg
              className="h-16 w-16 text-primary mx-auto animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              data-ai-hint="ceramic tile"
            >
              <path d="M3 3h7v7H3z" />
              <path d="M14 3h7v7h-7z" />
              <path d="M3 14h7v7H3z" />
              <path d="M14 14h7v7h-7z" />
            </svg>
          ) : (
            // Static placeholder for SSR and initial client render before isMounted effect runs
            <div className="h-16 w-16 mx-auto bg-muted rounded-md" data-ai-hint="ceramic tile placeholder"></div>
          )}
          <h1 className="text-2xl font-bold text-primary">{t('appTitle')}</h1>
          <p className="text-muted-foreground">{t('authForm.loadingPage')}</p>
          {/* Consistent skeleton structure for both states */}
          <div className="w-full max-w-xs space-y-3 mx-auto">
            <div className={`h-8 w-3/4 mx-auto bg-muted rounded-md ${showAnimatedLoader ? 'animate-pulse' : ''}`} />
            <div className={`h-6 w-1/2 mx-auto bg-muted rounded-md ${showAnimatedLoader ? 'animate-pulse' : ''}`} />
            <div className={`h-10 w-full mt-4 bg-muted rounded-md ${showAnimatedLoader ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: authOperationLoading, isInitializing, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Function to allow other components (like InventoryPage) to register their Firestore listener's unsubscribe method
export const registerFirestoreUnsubscriber = (unsubscriber: (() => void) | null) => {
  firestoreUnsubscribeGlobal = unsubscriber;
};
