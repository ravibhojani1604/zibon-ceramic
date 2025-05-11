
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

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
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
      try {
        // Ensure Firebase is initialized before trying to get auth instance
        const { auth } = await ensureFirebaseInitialized();
        if (!auth) {
          console.error("Firebase Auth is not initialized after ensureFirebaseInitialized.");
          toast({
            title: t('authForm.authErrorTitle') || "Authentication Error",
            description: t('authForm.authInitError') || "Could not initialize authentication. Please try again later.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error("Error initializing Firebase Auth for AuthContext:", error);
        toast({
          title: t('authForm.authErrorTitle') || "Authentication Error",
          description: t('authForm.authInitError') || "Could not initialize authentication. Please try again later.",
          variant: "destructive",
        });
        setLoading(false); // Stop loading even if there's an error
      }
    };

    initializeAuth();
  }, [toast, t]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) throw new Error("Auth not initialized");
      await signInWithEmailAndPassword(auth, email, pass);
      router.push('/inventory');
      toast({ title: t('authForm.loginSuccessTitle'), description: t('authForm.loginSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError);
      toast({ title: t('authForm.loginFailedTitle'), description: authError.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) throw new Error("Auth not initialized");
      await createUserWithEmailAndPassword(auth, email, pass);
      router.push('/inventory');
      toast({ title: t('authForm.registerSuccessTitle'), description: t('authForm.registerSuccessDescription')});
    } catch (error) {
      const authError = error as AuthError;
      console.error("Registration error:", authError);
      toast({ title: t('authForm.registerFailedTitle'), description: authError.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      if (!auth) throw new Error("Auth not initialized");
      await signOut(auth);
      setUser(null); // Explicitly set user to null
      router.push('/login');
      toast({ title: t('authForm.logoutSuccessTitle'), description: t('authForm.logoutSuccessDescription') });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError);
      toast({ title: t('authForm.logoutFailedTitle'), description: authError.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // If auth state is still loading, display a consistent full-page loader.
  // This ensures server-rendered HTML matches client-rendered HTML during initial load, preventing hydration errors.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <Skeleton className="h-10 w-full mt-4" />
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
