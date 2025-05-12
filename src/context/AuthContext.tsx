
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

  const handleAuthError = useCallback((error: AuthError, actionType: 'login' | 'register') => {
    console.error(`${actionType} error:`, error.code, error.message);
    
    let errorDescriptionKeySuffix: string;
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
        // Removed specific case for 'auth/requires-recent-login' as it's unlikely for login/register
        // and logout has custom handling. If it occurs, it will use the default message.
        default:
            // A generic fallback message based on action type
            errorDescriptionKeySuffix = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Failed`;
    }
    
    const defaultMessage = `An unexpected error occurred during ${actionType}. Code: ${error.code}`;
    const errorDescription = t(`authForm.error${errorDescriptionKeySuffix}`, { default: defaultMessage });

    toast({
      title: t(`authForm.${actionType}FailedTitle`),
      description: errorDescription,
      variant: 'destructive',
    });
  }, [t, toast]);


  useEffect(() => {
    if (!isMounted) return; 

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
    };
  }, [isMounted, router, t, toast, pathname]);


  const login = async (data: AuthFormData) => {
    setAuthOperationLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
      // router.replace('/inventory'); // This is handled by onAuthStateChanged effect
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
    if (firestoreUnsubscribeGlobal) {
      firestoreUnsubscribeGlobal();
      firestoreUnsubscribeGlobal = null;
      console.log("Firestore listener unsubscribed during logout.");
    }

    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        setUser(null);
        router.replace('/login');
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.authInitErrorLogout'), variant: "warning" });
        setAuthOperationLoading(false);
        return;
      }
      await signOut(auth);
      setUser(null);
      router.replace('/login');
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.warn("Logout error:", authError.message, "Proceeding with client-side clear.");
      setUser(null);
      router.replace('/login');
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutCompletedClientSide') });
    } finally {
      setAuthOperationLoading(false);
    }
  };
  
  if (!isMounted || isInitializing) {
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
            <div className="h-16 w-16 mx-auto bg-muted rounded-md animate-pulse" data-ai-hint="ceramic tile placeholder"></div>
          )}
          <h1 className="text-2xl font-bold text-primary">{t('appTitle')}</h1>
          <p className="text-muted-foreground">{t('authForm.loadingPage')}</p>
          <div className={`h-8 w-3/4 mx-auto bg-muted rounded-md ${showAnimatedLoader ? 'animate-pulse' : ''}`} />
          <div className={`h-6 w-1/2 mx-auto bg-muted rounded-md ${showAnimatedLoader ? 'animate-pulse' : ''}`} />
          <div className={`h-10 w-full mt-4 bg-muted rounded-md ${showAnimatedLoader ? 'animate-pulse' : ''}`} />
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
  firestoreUnsubscribeGlobal = unsubscriber;
};
