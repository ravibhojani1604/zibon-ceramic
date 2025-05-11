'use client';

import type { User as FirebaseUser, AuthError } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirebaseInstances, ensureFirebaseInitialized } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import type { AuthFormData } from '@/components/AuthForm';


interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isLoggingOut: boolean;
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toastTimeouts = new Map<string, NodeJS.Timeout>();
const showToastOnce = (id: string, toastFn: () => void, delay = 300) => {
  if (toastTimeouts.has(id)) {
    clearTimeout(toastTimeouts.get(id)!);
  }
  const timeout = setTimeout(() => {
    toastFn();
    toastTimeouts.delete(id);
  }, delay);
  toastTimeouts.set(id, timeout);
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true); // True until Firebase auth state is determined
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();


  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuthListener = async () => {
      try {
        const { auth } = await ensureFirebaseInitialized();
        
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false); // Auth state determined, no longer loading initial auth status
          if (!currentUser) {
            console.log("AuthContext: User signed out or no user found, user state updated to null.");
          }
        });
      } catch (error: any) {
        console.error("Error during Firebase Auth initialization in AuthProvider:", error.message);
        const errorId = 'authInitErrorContext';
          showToastOnce(errorId, () => {
            toast({
              id: errorId,
              title: t('authForm.authErrorTitle') || "Authentication Error",
              description: error.message.includes("Firebase configuration is incomplete") 
                ? error.message 
                : (t('authForm.authInitError') || "Could not initialize authentication. Please try again later."),
              variant: "destructive",
            });
          }, 500); 
        setUser(null);
        setLoading(false); // Stop loading even if there's an error
      }
    };

    initializeAuthListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Clear any pending toasts from this utility if AuthProvider unmounts
      toastTimeouts.forEach(clearTimeout);
      toastTimeouts.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  const login = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for login");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged will update user state and loading state
      router.push('/inventory'); 
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError.code, authError.message);

      let errorMessage = authError.message; 
      switch (authError.code) {
        case 'auth/invalid-credential':
          errorMessage = t('authForm.errorInvalidCredential') || 'Invalid email or password. Please try again.';
          break;
        case 'auth/user-disabled':
          errorMessage = t('authForm.errorUserDisabled') || 'This account has been disabled. Please contact support.';
          break;
        case 'auth/invalid-email':
          errorMessage = t('authForm.errorInvalidEmail') || 'The email address is not valid. Please check and try again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = t('authForm.errorNetworkRequestFailed') || "Network error. Please check your connection and try again.";
          break;
        default: 
          errorMessage = authError.message || (t('authForm.loginFailedTitle') || "Login failed. Please try again.");
          break;
      }
      toast({ title: t('authForm.loginFailedTitle'), description: errorMessage, variant: "destructive" });
      setLoading(false); // Explicitly set loading to false on login failure
    }
  };

  const register = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for register");
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      router.push('/login'); 
      toast({ 
        title: t('authForm.registerSuccessTitle'), 
        description: t('authForm.registerSuccessRedirectLoginDescription')
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Registration error:", authError.code, authError.message);
      let errorMessage = authError.message;
       switch (authError.code) {
        case 'auth/email-already-in-use':
          errorMessage = t('authForm.errorEmailInUse') || 'This email is already registered. Please login or use a different email.';
          break;
        case 'auth/weak-password':
          errorMessage = t('authForm.errorWeakPassword') || 'The password is too weak. Please choose a stronger password.';
          break;
        case 'auth/invalid-email':
            errorMessage = t('authForm.errorInvalidEmail') || 'The email address is not valid. Please check and try again.';
            break;
        case 'auth/network-request-failed':
            errorMessage = t('authForm.errorNetworkRequestFailed') || "Network error. Please check your connection and try again.";
            break;
        default:
            errorMessage = authError.message || (t('authForm.registerFailedTitle') || "Registration failed. Please try again.");
            break;
      }
      toast({ title: t('authForm.registerFailedTitle'), description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false); // Explicitly set loading to false after registration attempt
    }
  };

  const logout = async () => {
    if (isLoggingOut) return; // Prevent multiple logout calls

    setIsLoggingOut(true);
    setLoading(true); 

    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) {
        throw new Error(t('authForm.authInitErrorLogout') || "Authentication service is not available for logout. Please try again.");
      }
      await signOut(auth); 
      // onAuthStateChanged will set user to null and setLoading to false.
      router.push('/login'); 
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError.code, authError.message);
      let errorMessage = authError.message;
      if (authError.code === 'auth/network-request-failed') {
        errorMessage = t('authForm.errorNetworkRequestFailed') || "Network error during logout. Please check your connection and try again.";
      } else if (authError.message.includes("permission") || authError.code === 'auth/permission-denied') {
        errorMessage = t('authForm.errorLogoutPermission') || "Could not log out due to a permission issue. Please try again or contact support.";
      } else if (authError.message.includes("Auth not initialized")) {
        errorMessage = t('authForm.authInitErrorLogout');
      } else {
        errorMessage = authError.message || (t('authForm.logoutFailedTitle') || "Logout failed. Please try again.");
      }
      
      toast({ 
        title: t('authForm.logoutFailedTitle'), 
        description: errorMessage, 
        variant: "destructive" 
      });
      setLoading(false); // Ensure loading is false if signOut fails
    } finally {
        setIsLoggingOut(false);
    }
  };
  
  // This loading UI is shown:
  // 1. On the server (because `loading` is initially true).
  // 2. On the client, initially (because `loading` is initially true).
  // 3. On the client, until `onAuthStateChanged` callback sets `loading` to false.
  if (loading) {
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
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
        </div>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, loading, isLoggingOut, login, register, logout }}>
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

