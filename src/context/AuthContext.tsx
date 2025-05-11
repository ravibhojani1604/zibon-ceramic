
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
import { Skeleton } from '@/components/ui/skeleton'; 
import { z } from 'zod';

// Define the AuthForm data structure based on AuthForm.tsx
// This needs to be consistent with the actual AuthForm component's schema
const getAuthFormSchema = (t: (key: string, options?: Record<string, string | number>) => string, isRegister: boolean) => {
  const schema = z.object({
    email: z.string().email({ message: t('authForm.emailInvalidError') }),
    password: z.string().min(6, { message: t('authForm.passwordMinLengthError') }),
  });
  if (isRegister) {
    return schema.extend({
      confirmPassword: z.string().min(6, { message: t('authForm.confirmPasswordMinLengthError') }),
    }).refine(data => data.password === data.confirmPassword, {
      message: t('authForm.passwordsDoNotMatchError'),
      path: ['confirmPassword'],
    });
  }
  return schema;
};
export type AuthFormData = z.infer<ReturnType<typeof getAuthFormSchema>>;


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

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // For specific actions like login/register
  const [isInitializing, setIsInitializing] = useState(true); // For initial auth check
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useTranslation();

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
             errorDescriptionKeySuffix = 'LogoutPermission'; // Or a more specific one
             break;
        default:
            errorDescriptionKeySuffix = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Failed`; // Fallback to generic e.g. LoginFailed
    }
    const errorDescription = t(`authForm.error${errorDescriptionKeySuffix}`, { default: error.message });

    toast({
      title: t(`authForm.${actionType}FailedTitle`),
      description: errorDescription,
      variant: 'destructive',
    });
  }, [t, toast]);


  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuthListener = async () => {
      setIsInitializing(true); // Explicitly set initializing to true at the start
      try {
        const { auth } = await getFirebaseInstances();
        if (!auth) {
          console.error("Auth service is not available. Firebase might not be initialized correctly.");
          setIsInitializing(false); 
          setLoading(false); // Also set general loading to false
          toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
          return;
        }
        
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setIsInitializing(false); // Firebase init and auth check done
          setLoading(false); // General loading also false

          if (currentUser && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
            router.push('/inventory');
          } else if (!currentUser && pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
             // Only redirect if not already on a public auth page or the root (which redirects)
            if (pathname !== "/" ) router.push('/login');
          }
        }, (error) => {
            console.error("Auth state listener error:", error);
            setUser(null);
            setIsInitializing(false);
            setLoading(false);
            toast({ title: t('authForm.authErrorTitle'), description: error.message, variant: 'destructive' });
        });
        authStateUnsubscribeGlobal = unsubscribe;

      } catch (error) {
        console.error("Error initializing Firebase or Auth listener:", error);
        setUser(null);
        setIsInitializing(false);
        setLoading(false);
        toast({ title: t('authForm.authErrorTitle'), description: t('authForm.authInitError'), variant: 'destructive' });
      }
    };

    initializeAuthListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
        authStateUnsubscribeGlobal = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, t, toast]); // Pathname removed as it caused too many re-runs potentially


  const login = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged will update user state and loading state
      // router.push('/inventory'); // onAuthStateChanged handles redirection
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
      router.push('/login');
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
        console.log("Unsubscribing from onAuthStateChanged before logout.");
        authStateUnsubscribeGlobal();
        authStateUnsubscribeGlobal = null; 
    }

    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        console.warn("Auth service not fully available for logout. Attempting local clear.");
        setUser(null); 
        router.push('/login');
        toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.authInitErrorLogout'), variant: "warning" });
        return;
      }
      await signOut(auth);
      setUser(null); // Explicitly set user to null
      router.push('/login'); // Explicitly redirect
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      handleAuthError(error as AuthError, 'logout');
      setUser(null); 
      router.push('/login'); 
    } finally {
      setLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
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
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <Skeleton className="h-10 w-full mt-4" />
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

export { AuthContext as RawAuthContext };

    