
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

// Function to safely call Firestore unsubscriber
const safeUnsubscribeFirestore = () => {
  if (firestoreUnsubscribeGlobal) {
    try {
      firestoreUnsubscribeGlobal();
      console.log('AuthContext: Global Firestore listener unsubscribed.');
    } catch (e) {
      console.error('AuthContext: Error unsubscribing Firestore listener:', e);
    }
    firestoreUnsubscribeGlobal = null;
  }
};


export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authOperationLoading, setAuthOperationLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [clientMounted, setClientMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setClientMounted(true);
  }, []);

  const handleAuthError = useCallback(
    (error: AuthError | Error, actionType: 'login' | 'register' | 'logout') => {
      let errorCode: string | undefined;
      let errorMessage: string;
      const currentActionType = actionType;

      if ('code' in error && typeof error.code === 'string') { // Firebase AuthError
        errorCode = error.code;
        errorMessage = error.message;
      } else { // Generic Error
        errorMessage = error.message;
      }

      console.error(`${currentActionType} error:`, errorCode ? `Code: ${errorCode},` : '', `Message: ${errorMessage}`);

      let errorDescriptionKeySuffix: string;
      let defaultMessage = t(`authForm.${currentActionType}FailedDefaultError`, { code: errorCode || 'UNKNOWN' });

      if (errorCode) {
        switch (errorCode) {
          case 'auth/invalid-credential':
            errorDescriptionKeySuffix = 'InvalidCredential';
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorDescriptionKeySuffix = 'InvalidCredential'; // Consolidate for security
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
          case 'auth/invalid-api-key':
            errorDescriptionKeySuffix = 'ConfigurationNotFound'; // Group API key issues with config
            defaultMessage = t('authForm.errorConfigurationNotFound');
            break;
          default:
            errorDescriptionKeySuffix = `${currentActionType.charAt(0).toUpperCase() + currentActionType.slice(1)}Failed`;
        }
      } else {
        errorDescriptionKeySuffix = `${currentActionType.charAt(0).toUpperCase() + currentActionType.slice(1)}Failed`;
      }
      
      const finalErrorDescription = t(`authForm.error${errorDescriptionKeySuffix}`, { default: defaultMessage, message: errorMessage });

      toast({
        title: t(`authForm.${currentActionType}FailedTitle`),
        description: finalErrorDescription,
        variant: 'destructive',
      });
    },
    [t, toast]
  );


  useEffect(() => {
    if (!clientMounted) return;

    setIsInitializing(true);
    let localAuthUnsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
          console.error('Auth service is not available for listener setup.');
          setIsInitializing(false);
          // Do not call handleAuthError here as it might trigger toasts too early or based on incomplete i18n
          toast({ title: "Initialization Error", description: "Authentication service could not be initialized.", variant: "destructive"});
          return;
        }

        if (authStateUnsubscribeGlobal) {
          console.log("AuthContext: Clearing previous global auth state listener.");
          authStateUnsubscribeGlobal();
          authStateUnsubscribeGlobal = null;
        }
        
        console.log("AuthContext: Setting up new global auth state listener.");
        localAuthUnsubscribe = onAuthStateChanged(
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
              safeUnsubscribeFirestore(); 
              const publicPaths = ['/login', '/register'];
              if (pathname === '/') {
                 router.replace('/login');
              } else if (!publicPaths.includes(pathname) && !pathname.startsWith('/_next')) { // Avoid _next paths
                  router.replace('/login');
              }
            }
          },
          (error: AuthError) => {
            console.error('AuthContext: Auth state listener error:', error);
            setUser(null);
            setIsInitializing(false);
            safeUnsubscribeFirestore();
            handleAuthError(error, 'logout'); 
          }
        );
        authStateUnsubscribeGlobal = localAuthUnsubscribe;
      } catch (error) {
        console.error('AuthContext: Error initializing Firebase or Auth listener:', error);
        setUser(null);
        setIsInitializing(false);
        safeUnsubscribeFirestore();
        if(error instanceof Error) {
          handleAuthError(error as Error, 'logout');
        } else {
          handleAuthError(new Error("Unknown error during auth initialization"), 'logout');
        }
      }
    };

    initializeAuth();

    return () => {
      if (localAuthUnsubscribe) {
        console.log("AuthContext: Unsubscribing local auth state listener on cleanup.");
        localAuthUnsubscribe();
      }
      if (authStateUnsubscribeGlobal === localAuthUnsubscribe) {
        authStateUnsubscribeGlobal = null; 
      }
    };
  }, [clientMounted, router, pathname, t, handleAuthError]);

  const login = useCallback(
    async (data: AuthFormData) => {
      if (!clientMounted) return;
      setAuthOperationLoading(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
           throw new Error(t('authForm.authInitError'));
        }
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
      } catch (error) {
        handleAuthError(error as AuthError, 'login');
      } finally {
        setAuthOperationLoading(false);
      }
    },
    [clientMounted, handleAuthError, t, toast] 
  );

  const register = useCallback(
    async (data: AuthFormData) => {
      if (!clientMounted) return;
      setAuthOperationLoading(true);
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
           throw new Error(t('authForm.authInitError'));
        }
        await createUserWithEmailAndPassword(auth, data.email, data.password);
        await signOut(auth); 

        toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessRedirectLoginDescription') });
        router.replace('/login'); 
      } catch (error) {
        handleAuthError(error as AuthError, 'register');
      } finally {
        setAuthOperationLoading(false);
      }
    },
    [clientMounted, handleAuthError, router, t, toast]
  );

  const logout = useCallback(async () => {
    if (!clientMounted) return;
    setAuthOperationLoading(true);
    
    safeUnsubscribeFirestore(); 
    
    try {
      const { auth } = await getFirebaseInstances(); 
      if (auth && auth.currentUser) { 
        await signOut(auth); 
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
      } else {
        setUser(null); 
        if (pathname !== '/login' && !pathname.startsWith('/_next')) router.replace('/login'); 
        console.log('AuthContext: No current user to sign out or auth not available, cleared local state.');
      }
    } catch (error) {
      console.error('AuthContext: Error during logout process:', error);
      handleAuthError(error as AuthError, 'logout');
      setUser(null); 
      if (pathname !== '/login' && !pathname.startsWith('/_next')) router.replace('/login'); 
    } finally {
      setAuthOperationLoading(false);
    }
  }, [clientMounted, handleAuthError, router, t, toast, pathname]);
  
  const showAnimatedLoader = isInitializing && clientMounted;

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="flex items-center justify-center mb-6">
          <svg
            className={cn(
              "h-16 w-16 text-primary",
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
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">{t('appTitle')}</h1>
        <p className="text-muted-foreground mb-6">{t('authForm.loadingPage')}</p>
         <div className="w-full max-w-xs space-y-3 mx-auto">
          <div className={cn("h-10 w-full bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
          <div className={cn("h-6 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': showAnimatedLoader })} />
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

export const registerFirestoreUnsubscriber = (unsubscriber: (() => void) | null) => {
  if (firestoreUnsubscribeGlobal === unsubscriber && unsubscriber !== null) return;

  safeUnsubscribeFirestore(); 
  
  firestoreUnsubscribeGlobal = unsubscriber;
  if (unsubscriber) {
    console.log("AuthContext: Registered new global Firestore unsubscriber.");
  } else {
    console.log("AuthContext: Cleared global Firestore unsubscriber (set to null).");
  }
};
