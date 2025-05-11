
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState }
  from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, ensureFirebaseInitialized } from '@/lib/firebase'; // Ensure firebase is initialized
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  register: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  setCurrentUser: Dispatch<SetStateAction<User | null>> // Allow manual update if needed elsewhere
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    const initializeAuthListener = async () => {
      try {
        await ensureFirebaseInitialized(); // Ensure Firebase is ready
        if (!auth) {
          console.error("Firebase Auth is not available. Cannot set up auth listener.");
          setLoading(false);
          return;
        }
        
        unsubscribe = onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error during Firebase Auth initialization or listener setup:", error);
        setLoading(false); // Stop loading even if there's an error
      }
    };

    initializeAuthListener();
    
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const login = async (email: string, pass: string) => {
    await ensureFirebaseInitialized();
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string) => {
    await ensureFirebaseInitialized();
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    return createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await ensureFirebaseInitialized();
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    return signOut(auth);
  };
  
  if (loading) {
    // Basic full-page skeleton loader
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Skeleton className="w-3/4 h-3/4 md:w-1/2 md:h-1/2 lg:w-1/3 lg:h-1/3" />
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ currentUser, loading, login, register, logout, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
