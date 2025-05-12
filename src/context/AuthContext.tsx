
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
import { cn } from '@/lib/utils';

interface AuthContextType {
  user: User | null;
  loading: boolean; // For auth operations like login, register, logout
  isInitializing: boolean; // For initial auth state check
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authStateUnsubscribeGlobal: (() => void) | null = null;
let firestoreUnsubscribeGlobal: (() => void) | null = null;

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // loading for auth operations
  const [isInitializing, setIsInitializing] = useState(true); // loading for initial auth state check
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
          // Only toast if component is still mounted, to avoid memory leaks or errors
          // if (isMounted) removed as isMounted will be true here.
          toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          return;
        }

        if (authStateUnsubscribeGlobal) {
          console.log("AuthContext: Clearing previous global auth state listener.");
          authStateUnsubscribeGlobal();
          authStateUnsubscribeGlobal = null;
        }
        
        console.log("AuthContext: Setting up new global auth state listener.");
        authStateUnsubscribeGlobal = onAuthStateChanged(
          auth,
          (currentUser) => {
            setUser(currentUser);
            setIsInitializing(false);
            console.log("AuthContext: Auth state changed. User:", currentUser ? currentUser.uid : null, "Initializing:", false);

            if (currentUser) {
              if (pathname === '/login' || pathname === '/register' || pathname === '/') {
                router.replace('/inventory');
              }
            } else {
              const publicPaths = ['/login', '/register'];
               // if current path is root, redirect to login
              if (pathname === '/') {
                 router.replace('/login');
              }
              // If not a public path and not already on a public path, redirect to login
              // This check helps prevent redirect loops if already on login/register
              else if (!publicPaths.includes(pathname) && pathname.startsWith('/inventory')) {
                  router.replace('/login');
              }
            }
          },
          (error: AuthError) => {
            console.error('AuthContext: Auth state listener error:', error);
            setUser(null);
            setIsInitializing(false);
            // if (isMounted) removed
            handleAuthError(error, 'logout'); 
          }
        );
      } catch (error) {
        console.error('AuthContext: Error initializing Firebase or Auth listener:', error);
        setUser(null);
        setIsInitializing(false);
        // if (isMounted) removed
        toast({ title: t('authForm.authErrorTitle'), description: (error as Error).message, variant: 'destructive' });
      }
    };

    initializeAuth();

    return () => {
      if (authStateUnsubscribeGlobal) {
        console.log("AuthContext: Unsubscribing global auth state listener on cleanup.");
        authStateUnsubscribeGlobal();
        authStateUnsubscribeGlobal = null;
      }
      // Firestore listener is managed separately by its owner component via registerFirestoreUnsubscriber
      // but ensure it's cleared if AuthProvider itself unmounts (though less likely for a root provider)
      if (firestoreUnsubscribeGlobal) {
        console.log("AuthContext: Unsubscribing global Firestore listener on AuthProvider cleanup.");
        firestoreUnsubscribeGlobal();
        firestoreUnsubscribeGlobal = null;
      }
    };
  }, [isMounted, router, pathname, t, toast, handleAuthError]);

  const login = useCallback(
    async (data: AuthFormData) => {
      if (!isMounted) return; // Should not happen if user can interact
      setLoading(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
           console.error("Auth not initialized for login");
           toast({ title: t('authForm.loginFailedTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
           setLoading(false);
           return;
        }
        await signInWithEmailAndPassword(auth, data.email, data.password);
        // onAuthStateChanged will handle user state update and redirection.
        toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
      } catch (error) {
        handleAuthError(error as AuthError, 'login');
      } finally {
        setLoading(false);
      }
    },
    [isMounted, handleAuthError, t, toast] 
  );

  const register = useCallback(
    async (data: AuthFormData) => {
      if (!isMounted) return;
      setLoading(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
           console.error("Auth not initialized for register");
           toast({ title: t('authForm.registerFailedTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
           setLoading(false);
           return;
        }
        await createUserWithEmailAndPassword(auth, data.email, data.password);
        // Sign out the newly created user immediately to force manual login
        await signOut(auth); 
        
        toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessRedirectLoginDescription') });
        router.replace('/login'); 
      } catch (error) {
        handleAuthError(error as AuthError, 'register');
      } finally {
        setLoading(false);
      }
    },
    [isMounted, handleAuthError, router, t, toast]
  );

  const logout = useCallback(async () => {
    if (!isMounted) return;
    setLoading(true);

    // Unsubscribe from Firestore listener if it exists
    if (firestoreUnsubscribeGlobal) {
      console.log('AuthContext: Unsubscribing Firestore listener during logout.');
      firestoreUnsubscribeGlobal();
      firestoreUnsubscribeGlobal = null;
    }
    
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        console.warn("Auth service not available for logout. Clearing local state and redirecting.");
        setUser(null); // Clear local user state
        // No need to setIsInitializing to false here, onAuthStateChanged will handle it if auth re-initializes
        router.replace('/login');
        toast({ title: t('authForm.logoutFailedTitle'), description: t('authForm.authInitErrorLogout'), variant: 'warning' });
        setLoading(false);
        return;
      }

      if (auth.currentUser) {
        await signOut(auth);
        // setUser(null) and redirection will be handled by onAuthStateChanged
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
      } else {
        // If no user, effectively logged out. Ensure local state and UI reflect this.
        setUser(null);
        router.replace('/login'); // Ensure redirect if somehow on a protected page
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.alreadyLoggedOut'), variant: 'info' });
      }
    } catch (error) {
      handleAuthError(error as AuthError, 'logout');
      // Ensure state is cleared even if signOut fails
      setUser(null);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [isMounted, handleAuthError, router, t, toast]);
  
  const showAnimatedLoader = isInitializing;

  if (isInitializing && isMounted) { // Show loader only if initializing AND mounted to avoid SSR hydration issues with animation classes.
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          {/* SVG structure for loader */}
          <svg
            className={cn(
              "h-16 w-16 text-primary mx-auto",
              { 'animate-spin': showAnimatedLoader } // Rely on showAnimatedLoader which is now just isInitializing
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
          {/* Placeholder divs for animation */}
          <div className={cn("h-8 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
          <div className={cn("h-6 w-1/2 mx-auto bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
          <div className={cn("h-10 w-full mt-4 bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
        </div>
      </div>
    );
  }
  // Fallback for SSR or if not mounted yet but still initializing (less ideal, but avoids hydration diff)
  if (isInitializing && !isMounted) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
            {/* Non-animated placeholder for SSR/pre-mount */}
            <div className="h-16 w-16 mx-auto bg-muted rounded-md" data-ai-hint="ceramic tile placeholder"></div>
            <h1 className="text-2xl font-bold text-primary">{t('appTitle')}</h1>
            <p className="text-muted-foreground">{t('authForm.loadingPage')}</p>
            <div className="h-8 w-3/4 mx-auto bg-muted rounded-md" />
            <div className="h-6 w-1/2 mx-auto bg-muted rounded-md" />
            <div className="h-10 w-full mt-4 bg-muted rounded-md" />
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
    console.log("AuthContext: Clearing previous global Firestore unsubscriber via registerFirestoreUnsubscriber.");
    firestoreUnsubscribeGlobal();
  }
  
  firestoreUnsubscribeGlobal = unsubscriber;
  if (unsubscriber) {
    console.log("AuthContext: Registered new global Firestore unsubscriber via registerFirestoreUnsubscriber.");
  } else {
    console.log("AuthContext: Cleared global Firestore unsubscriber (set to null) via registerFirestoreUnsubscriber.");
  }
};
