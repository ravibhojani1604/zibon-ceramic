
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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { auth } = await ensureFirebaseInitialized();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error("Error initializing Firebase Auth for AuthContext:", error);
        toast({
          title: "Authentication Error",
          description: "Could not initialize authentication. Please try again later.",
          variant: "destructive",
        });
        setLoading(false); // Stop loading even if there's an error
      }
    };

    initializeAuth();
  }, [toast]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      await signInWithEmailAndPassword(auth, email, pass);
      router.push('/inventory'); 
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError);
      toast({ title: "Login Failed", description: authError.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      await createUserWithEmailAndPassword(auth, email, pass);
      router.push('/inventory');
      toast({ title: "Registration Successful", description: "Welcome!" });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Registration error:", authError);
      toast({ title: "Registration Failed", description: authError.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { auth } = await getFirebaseInstances();
      await signOut(auth);
      router.push('/login');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError);
      toast({ title: "Logout Failed", description: authError.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading && typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/')) {
     // For auth pages or root, show children immediately or a minimal loader if preferred
  } else if (loading) {
    // For protected routes, show a full page loader
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
