
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/i18n';
import { cn } from '@/lib/utils'; 

export default function HomePage() {
  const { user, isInitializing } = useAuth(); 
  const router = useRouter();
  const { t } = useTranslation();
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    if (!isInitializing && clientMounted) { // Ensure client is mounted before redirecting
      if (user) {
        router.replace('/inventory');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isInitializing, router, clientMounted]);

 
  if (isInitializing || !clientMounted) { // Show loader if initializing OR if client hasn't mounted yet
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="flex items-center justify-center mb-6">
          <svg
            className={cn(
              "h-12 w-12 sm:h-16 sm:w-16 text-primary", // Adjusted size
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
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">{t('appTitle')}</h1> {/* Adjusted size */}
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
