'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/i18n';
import { cn } from '@/lib/utils'; // For conditional class names

export default function HomePage() {
  const { user, isInitializing, isMounted } = useAuth(); // isMounted might not be directly from AuthContext, ensure it's available or derive
  const router = useRouter();
  const { t } = useTranslation();
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      if (user) {
        router.replace('/inventory');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isInitializing, router]);

  // Render a minimal loading state or rely on AuthProvider's loader.
  // If AuthProvider shows a full-screen loader when isInitializing,
  // HomePage might not even need to render its own complex loader.
  // This version matches the structure AuthProvider will now use for its loader.
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="flex items-center justify-center mb-6">
          <svg
            className={cn(
              "h-16 w-16 text-primary",
              // Only animate if client has mounted to avoid hydration issues with animation classes
              { 'animate-spin': clientMounted } 
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
          <div className={cn("h-10 w-full bg-muted rounded-md", { 'animate-pulse': clientMounted })} />
          <div className={cn("h-6 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': clientMounted })} />
        </div>
      </div>
    );
  }

  // Fallback or null if redirection is expected to be immediate once isInitializing is false.
  return null; 
}

// Need to import useState if it's not already
import { useState } from 'react';