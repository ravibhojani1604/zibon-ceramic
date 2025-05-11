
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
      // setLoading(true); // setLoading true is already the initial state
      try {
        const { auth } = await ensureFirebaseInitialized(); 
        
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return () => unsubscribe();

      } catch (error: any) {
        console.error("Error during Firebase Auth initialization:", error.message);
        
        const errorId = 'authInitError';
        if (!toastTimeouts.has(errorId)) {
          showToastOnce(errorId, () => {
            toast({
              id: errorId,
              title: t('authForm.authErrorTitle') || "Authentication Error",
              description: error.message.includes("Firebase configuration is incomplete") 
                ? error.message 
                : (t('authForm.authInitError') || "Could not initialize authentication. Please try again later."),
              variant: "destructive",
            });
          });
        }
        setUser(null); 
        setLoading(false); 
      }
    };

    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Changed dependency array from [t] to []

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
      console.error("Login error:", authError);
      toast({ title: t('authForm.loginFailedTitle'), description: authError.message, variant: "destructive" });
      setLoading(false); 
    }
  };

  const register = async (data: AuthFormData) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances(); 
      if (!auth) throw new Error("Auth not initialized for register");
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      // onAuthStateChanged will handle user state.
      router.push('/login'); 
      toast({ 
        title: t('authForm.registerSuccessTitle'), 
        description: t('authForm.registerSuccessRedirectLoginDescription') || "Registration successful! Please log in."
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Registration error:", authError);
      toast({ title: t('authForm.registerFailedTitle'), description: authError.message, variant: "destructive" });
    } finally {
      setLoading(false); 
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) throw new Error("Auth not initialized for logout");
      await signOut(auth);
      // onAuthStateChanged will set user to null.
      router.push('/login'); 
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError);
      toast({ title: t('authForm.logoutFailedTitle'), description: authError.message, variant: "destructive" });
      setLoading(false); 
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          {/* Ensure these Skeletons match exactly what server would render initially */}
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
