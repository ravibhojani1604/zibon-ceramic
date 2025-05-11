
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
import { useTranslation }
from '@/context/i18n';
import type { AuthFormData } from '@/components/AuthForm';


interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (data: AuthFormData) => Promise<void>;
  register: (data: AuthFormData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true); // Ensure loading is true at the start of initialization
      try {
        const { auth } = await ensureFirebaseInitialized(); // This now returns instances or throws
        
        // If ensureFirebaseInitialized didn't throw, auth should be initialized.
        // The onAuthStateChanged listener is the primary way to manage user state.
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return () => unsubscribe();

      } catch (error: any) {
        console.error("Error during Firebase Auth initialization:", error.message);
        // If firebase.ts already console.error-ed, this might be redundant but good for clarity
        if (!toastTimeouts.has('authInitError')) { // Prevent duplicate toasts if firebase.ts also toasts
          toast({
            id: 'authInitError',
            title: t('authForm.authErrorTitle') || "Authentication Error",
            description: error.message.includes("Firebase configuration is incomplete") 
              ? error.message // Show specific config error
              : (t('authForm.authInitError') || "Could not initialize authentication. Please try again later."),
            variant: "destructive",
          });
        }
        setUser(null); // Ensure user is null on error
        setLoading(false); 
      }
    };

    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]); // Removed toast from dependencies as it can cause loops if not careful

  const login = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); // Will throw if config is bad
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged will update user state and loading state
      router.push('/inventory'); // Redirect handled by useEffect in login/register pages now
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError);
      toast({ title: t('authForm.loginFailedTitle'), description: authError.message, variant: "destructive" });
      setLoading(false); // Explicitly set loading false on error
    }
    // setLoading(false) is managed by onAuthStateChanged or error catch
  };

  const register = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); // Will throw if config is bad
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged will handle user state. We don't set user directly.
      router.push('/login'); // Redirect to login page after registration
      toast({ 
        title: t('authForm.registerSuccessTitle'), 
        description: t('authForm.registerSuccessRedirectLoginDescription') || "Registration successful! Please log in."
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Registration error:", authError);
      toast({ title: t('authForm.registerFailedTitle'), description: authError.message, variant: "destructive" });
    } finally {
      setLoading(false); // Ensure loading is false after registration attempt
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      await signOut(auth);
      // onAuthStateChanged will set user to null and update loading state.
      router.push('/login');
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError);
      toast({ title: t('authForm.logoutFailedTitle'), description: authError.message, variant: "destructive" });
      setLoading(false); // Explicitly set loading false on error
    }
     // setLoading(false) is managed by onAuthStateChanged or error catch
  };
  
  // This loading state is for the initial auth check.
  // It should show a loader until onAuthStateChanged fires for the first time.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          <Skeleton className="h-16 w-16 text-primary mx-auto animate-spin" data-ai-hint="ceramic tile"/>
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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

// Helper to prevent duplicate toasts, could be moved to a utils file
const toastTimeouts = new Map<string, NodeJS.Timeout>();
const showToastOnce = (id: string, toastFn: () => void, delay = 300) => {
  if (toastTimeouts.has(id)) {
    clearTimeout(toastTimeouts.get(id));
  }
  const timeout = setTimeout(() => {
    toastFn();
    toastTimeouts.delete(id);
  }, delay);
  toastTimeouts.set(id, timeout);
};
