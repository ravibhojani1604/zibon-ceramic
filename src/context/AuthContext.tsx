
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
import { Skeleton } from '@/components/ui/skeleton';


interface AuthContextType {
  user: User | null;
  loading: boolean; // For login, register, logout operations (authOperationLoading)
  isInitializing: boolean; // Specifically for the initial Firebase auth state check
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
  unsubscribeAuthState?: () => void;
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
  }, []);

  const handleAuthError = useCallback((error: AuthError, actionType: 'login' | 'register' | 'logout') => {
    console.error(`${actionType} error:`, error.code, error.message);
    
    let errorDescriptionKeySuffix: string;
    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
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
          if (isMounted) {
            toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          }
          return;
        }
        
        unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setIsInitializing(false);

          if (currentUser && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
            router.replace('/inventory');
          } else if (!currentUser && pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
            router.replace('/login');
          }
        }, (error) => {
            console.error("Auth state listener error:", error);
            setUser(null);
            setIsInitializing(false);
            if (isMounted) {
              toast({ title: t('authForm.authErrorTitle'), description: error.message, variant: 'destructive' });
            }
        });
        authStateUnsubscribeGlobal = unsubscribeAuth;

      } catch (error) {
        console.error("Error initializing Firebase or Auth listener:", error);
        setUser(null);
        setIsInitializing(false);
        if (isMounted) {
         toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
        }
      }
    };

    if (isMounted) { // Only initialize listener on client-side after mount
        initializeAuthListener();
    } else {
        // For SSR, or client before mount, set initializing to true but don't run listener yet.
        // User will be null, isInitializing will be true.
        // No, this is not quite right. If not mounted, we should reflect the initial state and not kick off async ops.
        // The initial state for user is null, isInitializing is true.
    }


    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
        authStateUnsubscribeGlobal = null;
      }
      if (firestoreUnsubscribeGlobal) {
        firestoreUnsubscribeGlobal();
        firestoreUnsubscribeGlobal = null;
      }
    };
  }, [router, t, toast, pathname, isMounted]);


  const login = async (data: AuthFormData) => {
    setAuthOperationLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged handles user state update and potential redirection
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
      // router.push('/inventory'); // Explicit redirect can be here or rely on onAuthStateChanged
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
      router.push('/login'); // Redirect to login after successful registration
      toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessRedirectLoginDescription')});
    } catch (error) {
      handleAuthError(error as AuthError, 'register');
    } finally {
      setAuthOperationLoading(false);
    }
  };

  const logout = async () => {
    setAuthOperationLoading(true);
    if (authStateUnsubscribeGlobal) {
        authStateUnsubscribeGlobal();
        authStateUnsubscribeGlobal = null; 
    }
    if (firestoreUnsubscribeGlobal) {
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
      const authError = error as AuthError;
       // Even if there's an error (e.g. user already signed out, network issue), clear client state
      console.warn("Logout error/issue:", authError.message, "Proceeding with client-side clear.");
      setUser(null); 
      router.push('/login'); 
      // Optionally, still show a generic success or a specific warning if preferred
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutCompletedClientSide') });
    } finally {
      setAuthOperationLoading(false);
    }
  };
  
  const setFirestoreListenerGlobal = (listener: (() => void) | null) => {
    firestoreUnsubscribeGlobal = listener;
  };


  // SSR and initial client render (before isMounted is true, or if auth is still initializing)
  if (!isMounted || isInitializing) {
    // This combined condition covers:
    // 1. Server-side rendering (!isMounted is true, isInitializing is true by default)
    // 2. Client-side initial render BEFORE useEffect for setIsMounted runs (!isMounted is true)
    // 3. Client-side render AFTER useEffect for setIsMounted runs BUT BEFORE auth state is resolved (isMounted is true, isInitializing is true)
    
    // If on client and mounted, but still initializing, show the animated SVG.
    // Otherwise (SSR or client before mount), show the static placeholder.
    const showAnimatedLoader = isMounted && isInitializing;

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
            // Static placeholder for SSR and initial client render before isMounted
            <div className="h-16 w-16 mx-auto bg-muted rounded-md" data-ai-hint="ceramic tile placeholder"></div>
          )}
          <h1 className="text-2xl font-bold text-primary">{t('appTitle')}</h1>
          <p className="text-muted-foreground">{t('authForm.loadingPage')}</p>
          {showAnimatedLoader ? (
            <>
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-6 w-1/2 mx-auto" />
              <Skeleton className="h-10 w-full mt-4" />
            </>
          ) : (
            <>
              <div className="h-8 w-3/4 mx-auto bg-muted rounded-md"></div>
              <div className="h-6 w-1/2 mx-auto bg-muted rounded-md"></div>
              <div className="h-10 w-full mt-4 bg-muted rounded-md"></div>
            </>
          )}
        </div>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, loading: authOperationLoading, isInitializing, login, register, logout, unsubscribeAuthState: authStateUnsubscribeGlobal || undefined }}>
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

export const registerFirestoreUnsubscriber = (unsubscriber: (() => void) | null) => {
  firestoreUnsubscribeGlobal = unsubscriber;
};

