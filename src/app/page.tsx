
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/context/i18n';


export default function HomePage() {
  const { user, isInitializing } = useAuth(); // Use isInitializing for the check
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Wait for auth state to be fully initialized
    if (!isInitializing) {
      if (user) {
        router.replace('/inventory');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isInitializing, router]);

  // This loading UI is shown while waiting for isInitializing to become false,
  // or while the redirect is in progress.
  // AuthProvider also shows a loader, so this might be brief or only for the redirect itself.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
       <div className="flex items-center justify-center mb-6">
         <svg
            className="h-16 w-16 text-primary animate-spin"
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
        <div className="w-full max-w-xs space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
        </div>
    </div>
  );
}
