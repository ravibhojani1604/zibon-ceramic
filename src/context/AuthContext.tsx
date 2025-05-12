
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
import { cn } from '@/lib/utils'; // Import cn

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isInitializing: boolean;
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authStateUnsubscribeGlobal: (() => void) | null = null;
let firestoreUnsubscribeGlobal: (() => void) | null = null;

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // authOperationLoading
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleAuthError = useCallback(
    (error: AuthError, actionType: 'login' | 'register' | 'logout') => {
      console.error(`${actionType} error code: ${error.code}, message: ${error.message}`);

      let errorDescriptionKeySuffix: string;
      let defaultMessage = t(`authForm.${actionType}FailedDefaultError`, { code: error.code });

      switch (error.code) {
        case 'auth/invalid-credential':
          errorDescriptionKeySuffix = 'InvalidCredential';
          break;
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
          errorDescriptionKeySuffix = 'RequiresRecentLogin';
          defaultMessage = t('authForm.errorRequiresRecentLogin');
          break;
        case 'auth/configuration-not-found':
          errorDescriptionKeySuffix = 'ConfigurationNotFound';
          defaultMessage = t('authForm.errorConfigurationNotFound');
          break;
        default:
          errorDescriptionKeySuffix = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Failed`;
      }

      const errorDescription = t(`authForm.error${errorDescriptionKeySuffix}`, { default: defaultMessage });

      toast({
        title: t(`authForm.${actionType}FailedTitle`),
        description: errorDescription,
        variant: 'destructive',
      });
    },
    [t, toast]
  );

  useEffect(() => {
    if (!isMounted) return;

    setIsInitializing(true);
    const initializeAuth = async () => {
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
          console.error('Auth service is not available for listener setup.');
          setIsInitializing(false);
          if (isMounted) { // only show toast if component is mounted
             toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          }
          return;
        }

        if (authStateUnsubscribeGlobal) {
          authStateUnsubscribeGlobal();
          authStateUnsubscribeGlobal = null;
        }

        authStateUnsubscribeGlobal = onAuthStateChanged(
          auth,
          (currentUser) => {
            setUser(currentUser);
            setIsInitializing(false);

            if (currentUser) {
              if (pathname === '/login' || pathname === '/register' || pathname === '/') {
                router.replace('/inventory');
              }
            } else {
              const publicPaths = ['/login', '/register'];
              if (pathname === '/') {
                router.replace('/login');
              } else if (!publicPaths.includes(pathname) && !pathname.startsWith('/inventory')) { 
                router.replace('/login');
              }
            }
          },
          (error: AuthError) => {
            console.error('Auth state listener error:', error);
            setUser(null);
            setIsInitializing(false);
            if (isMounted) {
                handleAuthError(error, 'logout'); // Treat as a general auth issue
            }
          }
        );
      } catch (error) {
        console.error('Error initializing Firebase or Auth listener:', error);
        setUser(null);
        setIsInitializing(false);
        if (isMounted) {
            toast({ title: t('authForm.authErrorTitle'), description: (error as Error).message, variant: 'destructive' });
        }
      }
    };

    initializeAuth();

    return () => {
      if (authStateUnsubscribeGlobal) {
        authStateUnsubscribeGlobal();
        authStateUnsubscribeGlobal = null;
      }
      if (firestoreUnsubscribeGlobal) {
        firestoreUnsubscribeGlobal();
        firestoreUnsubscribeGlobal = null;
      }
    };
  }, [isMounted, router, pathname, t, toast, handleAuthError]);

  const login = useCallback(
    async (data: AuthFormData) => {
      setLoading(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
          console.error("Auth not initialized for login");
          if (isMounted) {
             toast({ title: t('authForm.loginFailedTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          }
          setLoading(false);
          return;
        }
        await signInWithEmailAndPassword(auth, data.email, data.password);
        if (isMounted) {
            toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
        }
      } catch (error) {
        if (isMounted) {
            handleAuthError(error as AuthError, 'login');
        }
      } finally {
        if (isMounted) {
            setLoading(false);
        }
      }
    },
    [isMounted, handleAuthError, t, toast] 
  );

  const register = useCallback(
    async (data: AuthFormData) => {
      setLoading(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
           console.error("Auth not initialized for register");
           if (isMounted) {
            toast({ title: t('authForm.registerFailedTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
           }
           setLoading(false);
           return;
        }
        await createUserWithEmailAndPassword(auth, data.email, data.password);
        if (isMounted) {
            toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessRedirectLoginDescription') });
        }
        router.replace('/login'); 
      } catch (error) {
        if (isMounted) {
            handleAuthError(error as AuthError, 'register');
        }
      } finally {
        if (isMounted) {
            setLoading(false);
        }
      }
    },
    [isMounted, handleAuthError, router, t, toast]
  );

  const logout = useCallback(async () => {
    if (!isMounted) return; 

    setLoading(true);

    if (firestoreUnsubscribeGlobal) {
      firestoreUnsubscribeGlobal();
      firestoreUnsubscribeGlobal = null;
      console.log('AuthContext: Firestore listener unsubscribed during logout.');
    }
    
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        toast({ title: t('authForm.logoutFailedTitle'), description: t('authForm.authInitErrorLogout'), variant: 'warning' });
        setUser(null); 
        setIsInitializing(false); 
        router.replace('/login'); 
        setLoading(false);
        return;
      }

      if (auth.currentUser) {
        await signOut(auth);
        // setUser(null) and redirection will be handled by onAuthStateChanged
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
      } else {
        // If no currentUser, effectively already logged out from Firebase's perspective.
        setUser(null);
        setIsInitializing(false); 
        router.replace('/login');
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.alreadyLoggedOut'), variant: 'info' });
      }
    } catch (error) {
      handleAuthError(error as AuthError, 'logout');
      setUser(null); 
      setIsInitializing(false); 
      router.replace('/login'); 
    } finally {
      setLoading(false);
    }
  }, [isMounted, handleAuthError, router, t, toast]);

  const showAnimatedLoader = isMounted && isInitializing;

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          <svg
            className={cn(
              "h-16 w-16 text-primary mx-auto",
              { 'animate-spin': showAnimatedLoader }
            )}
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
          <div className={cn("h-8 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
          <div className={cn("h-6 w-1/2 mx-auto bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
          <div className={cn("h-10 w-full mt-4 bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, isInitializing, login, register, logout }}>
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
  if (firestoreUnsubscribeGlobal === unsubscriber) return;

  if (firestoreUnsubscribeGlobal) {
    console.log("AuthContext: Clearing previous global Firestore unsubscriber.");
    firestoreUnsubscribeGlobal();
  }
  firestoreUnsubscribeGlobal = unsubscriber;
  if (unsubscriber) {
    console.log("AuthContext: Registered new global Firestore unsubscriber.");
  } else {
    console.log("AuthContext: Cleared global Firestore unsubscriber (set to null).");
  }
};

    