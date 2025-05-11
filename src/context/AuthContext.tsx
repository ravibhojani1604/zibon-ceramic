
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
import type { AuthFormData } from '@/components/AuthForm'; // Assuming AuthForm exports this
import { Skeleton } from '@/components/ui/skeleton';


interface AuthContextType {
  user: User | null;
  loading: boolean; // General loading for async operations like login/register
  isInitializing: boolean; // Specifically for the initial Firebase auth state check
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
  unsubscribeAuthState?: () => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authStateUnsubscribeGlobal: (() => void) | null = null;
let firestoreUnsubscribeGlobal: (() => void) | null = null; // For inventory listener

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // For hydration fix

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleAuthError = useCallback((error: AuthError, actionType: 'login' | 'register' | 'logout') => {
    console.error(`${actionType} error:`, error.code, error.message);
    
    let errorDescriptionKeySuffix: string;
    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found': // Added for completeness
        case 'auth/wrong-password': // Added for completeness
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
        case 'auth/requires-recent-login':
             errorDescriptionKeySuffix = 'LogoutPermission';
             break;
        default:
            errorDescriptionKeySuffix = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Failed`;
    }
    const errorDescription = t(`authForm.error${errorDescriptionKeySuffix}`, { default: error.message });

    toast({
      title: t(`authForm.${actionType}FailedTitle`),
      description: errorDescription,
      variant: 'destructive',
    });
  }, [t, toast]);


  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const initializeAuthListener = async () => {
      setIsInitializing(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
          console.error("Auth service is not available.");
          setIsInitializing(false); 
          setLoading(false);
          if (isMounted) { // Avoid toast on server
            toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          }
          return;
        }
        
        unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setIsInitializing(false);
          setLoading(false);

          if (currentUser && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
            router.push('/inventory');
          } else if (!currentUser && pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
            if (pathname !== "/" ) router.push('/login');
          }
        }, (error) => {
            console.error("Auth state listener error:", error);
            setUser(null);
            setIsInitializing(false);
            setLoading(false);
            if (isMounted) {
              toast({ title: t('authForm.authErrorTitle'), description: error.message, variant: 'destructive' });
            }
        });
        authStateUnsubscribeGlobal = unsubscribeAuth;

      } catch (error) {
        console.error("Error initializing Firebase or Auth listener:", error);
        setUser(null);
        setIsInitializing(false);
        setLoading(false);
        if (isMounted) {
         toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
        }
      }
    };

    if (isMounted) { // Ensure Firebase init only runs on client
        initializeAuthListener();
    } else {
        // For SSR, we assume no user and not initializing to prevent hydration issues with redirects
        // This part will be quickly overridden by the client-side effect
        setUser(null);
        setIsInitializing(false); // Set to false to allow rendering children
    }


    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
        authStateUnsubscribeGlobal = null;
      }
      // Ensure any other global unsubscribers are also cleaned up if they exist
      if (firestoreUnsubscribeGlobal) {
        firestoreUnsubscribeGlobal();
        firestoreUnsubscribeGlobal = null;
      }
    };
  }, [router, t, toast, pathname, isMounted]);


  const login = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged handles redirection
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
    } catch (error) {
      handleAuthError(error as AuthError, 'login');
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) throw new Error("Auth not initialized for register");
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      router.push('/login'); // Redirect to login after successful registration
      toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessRedirectLoginDescription')});
    } catch (error) {
      handleAuthError(error as AuthError, 'register');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    if (authStateUnsubscribeGlobal) {
        authStateUnsubscribeGlobal();
        authStateUnsubscribeGlobal = null; 
    }
    if (firestoreUnsubscribeGlobal) { // Also unsubscribe from Firestore if listener exists
        firestoreUnsubscribeGlobal();
        firestoreUnsubscribeGlobal = null;
    }

    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        setUser(null); 
        router.push('/login');
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.authInitErrorLogout'), variant: "warning" });
        return;
      }
      await signOut(auth);
      setUser(null); 
      router.push('/login'); 
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      // For logout, don't use handleAuthError if it's a permission issue, just log locally and proceed
      const authError = error as AuthError;
      if (authError.code === 'auth/no-current-user' || authError.code === 'auth/requires-recent-login') {
        console.warn("Logout issue (already logged out or needs re-auth, proceeding with client-side clear):", authError.message);
      } else {
        handleAuthError(authError, 'logout');
      }
      setUser(null); 
      router.push('/login'); 
    } finally {
      setLoading(false);
    }
  };
  
  // This function can be passed to page.tsx for inventory to set its listener
  const setFirestoreListenerGlobal = (listener: (() => void) | null) => {
    firestoreUnsubscribeGlobal = listener;
  };


  if (isInitializing && isMounted) { // Show loading spinner only if mounted and still initializing
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          {/* SVG spinner - only rendered on client after mount */}
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
          
          <h1 className="text-2xl font-bold text-primary">{t('appTitle')}</h1>
          <p className="text-muted-foreground">{t('authForm.loadingPage')}</p>
          
          {/* Skeletons - Render actual Skeleton components if mounted */}
            <>
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-6 w-1/2 mx-auto" />
              <Skeleton className="h-10 w-full mt-4" />
            </>
        </div>
      </div>
    );
  }
  if (!isMounted && isInitializing) { // SSR or initial client render before isMounted is true
     return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
            {/* Placeholder for SVG */}
            <div className="h-16 w-16 mx-auto" /> 
          
            <h1 className="text-2xl font-bold text-primary">{t('appTitle')}</h1>
            <p className="text-muted-foreground">{t('authForm.loadingPage')}</p>
          
            {/* Placeholders for Skeletons - simple divs with matching styles */}
            <div className="animate-pulse rounded-md bg-muted h-8 w-3/4 mx-auto" />
            <div className="animate-pulse rounded-md bg-muted h-6 w-1/2 mx-auto" />
            <div className="animate-pulse rounded-md bg-muted h-10 w-full mt-4" />
        </div>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, loading, isInitializing, login, register, logout, unsubscribeAuthState: authStateUnsubscribeGlobal || undefined }}>
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

// Export a function to allow other parts of the app to register their Firestore listeners for cleanup
// This is a bit of a workaround for centralized listener management.
export const registerFirestoreUnsubscriber = (unsubscriber: (() => void) | null) => {
  firestoreUnsubscribeGlobal = unsubscriber;
};
    
    