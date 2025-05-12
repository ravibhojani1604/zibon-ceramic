
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

  const handleAuthError = useCallback((error: AuthError, actionType: 'login' | 'register' | 'logout') => {
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
          return;
        }

        if (authStateUnsubscribeGlobal) {
            authStateUnsubscribeGlobal(); 
            authStateUnsubscribeGlobal = null;
        }

        authStateUnsubscribeGlobal = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setIsInitializing(false); // Moved here to ensure it's set after user state
          
          if (currentUser) {
            if (pathname === '/login' || pathname === '/register' || pathname === '/') {
              router.replace('/inventory');
            }
          } else {
            const publicPaths = ['/login', '/register'];
             if (pathname === '/'){ // Special handling for root path if needed
                 router.replace('/login');
             } else if (!publicPaths.includes(pathname)) {
               router.replace('/login');
            }
          }
        }, (error) => {
            console.error("Auth state listener error:", error);
            setUser(null);
            setIsInitializing(false);
            // Don't call handleAuthError here as it might be a generic network issue not tied to an action
            // If specific handling is needed for listener errors, add it.
            toast({ title: t('authForm.authErrorTitle'), description: (error as AuthError).message, variant: "destructive"});
        });
      } catch (error) {
        console.error("Error initializing Firebase or Auth listener:", error);
        setUser(null); 
        setIsInitializing(false);
        // Avoid toast spam on initial load errors; user will see loading screen or login form
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
  // Removed handleAuthError from dependencies as it's stable due to useCallback with t, toast
  }, [isMounted, router, pathname, t, toast]);


  const login = async (data: AuthFormData) => {
    setAuthOperationLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged will update user state and redirect
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
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
      console.log("AuthContext: Firestore listener unsubscribed during logout.");
    }
    
    // We will let onAuthStateChanged handle user=null and redirection.
    // The authStateUnsubscribeGlobal should remain active until component unmounts or re-initializes.
    // Temporarily detaching it here and re-attaching might cause race conditions or missed state updates.

    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
         toast({ title: t('authForm.logoutFailedTitle'), description: t('authForm.authInitErrorLogout'), variant: "warning" });
         setUser(null); // Manually update client state
         setIsInitializing(false); // Ensure loading is false
         router.replace('/login'); // Force redirect
         setAuthOperationLoading(false);
         return; 
      }
      
      if (auth.currentUser) {
        await signOut(auth);
        // setUser(null) will be handled by onAuthStateChanged
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
      } else {
        // If no currentUser, effectively already logged out from Firebase's perspective.
        // Ensure client state reflects this.
        setUser(null);
        setIsInitializing(false); // If it was stuck, unstick it.
        router.replace('/login'); // Ensure redirection
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.alreadyLoggedOut'), variant: 'info' });
      }
    } catch (error) {
      // It's crucial to handle errors gracefully. Some errors (like network issues)
      // might prevent signOut from completing, but we should still try to update client state.
      handleAuthError(error as AuthError, 'logout');
      setUser(null); // Force client-side state update as a fallback
      setIsInitializing(false); // Ensure loading is false
      router.replace('/login'); // Ensure redirection even if onAuthStateChanged is delayed or fails
    } finally {
      setAuthOperationLoading(false);
      // onAuthStateChanged should set user to null, which will trigger redirection via the useEffect hook.
    }
  };
  
  const showAnimatedLoader = isMounted && isInitializing;

  if (isInitializing) { // Simplified condition for showing loader.
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          {/* Always render SVG structure. Animation controlled by client-side state. */}
          <svg
            className={`h-16 w-16 text-primary mx-auto ${showAnimatedLoader ? 'animate-spin' : ''}`}
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
          {/* Placeholder divs with conditional pulse animation */}
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
  if (firestoreUnsubscribeGlobal === unsubscriber) return; // Avoid redundant assignment or clearing

  if (firestoreUnsubscribeGlobal) {
    console.log("AuthContext: Clearing previous global Firestore unsubscriber.");
    firestoreUnsubscribeGlobal(); // Clear any old unsubscriber
  }
  firestoreUnsubscribeGlobal = unsubscriber;
  if (unsubscriber) {
    console.log("AuthContext: Registered new global Firestore unsubscriber.");
  } else {
    console.log("AuthContext: Cleared global Firestore unsubscriber (set to null).");
  }
};

