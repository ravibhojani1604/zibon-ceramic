'use client';

import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/context/i18n';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function RegisterPage() {
  const { register, user, loading: authOperationLoading, isInitializing } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [canShowForm, setCanShowForm] = useState(false);

  useEffect(() => {
    if (!isInitializing) { // Auth state is resolved
      if (user) {
        // If user is somehow already logged in (e.g., navigated here manually)
        router.replace('/inventory');
      } else {
        setCanShowForm(true); // Safe to show form
      }
    }
  }, [user, isInitializing, router]);

  if (isInitializing || (!canShowForm && !user)) {
    // If AuthProvider is initializing, it shows its own loader (handled by AuthProvider).
    // This condition also covers:
    // 1. Auth is resolved, no user, but useEffect hasn't run yet to set canShowForm (client initial render).
    // 2. Auth is resolved, user exists (so redirecting), canShowForm is false.
    // In these cases, show a loading message. Server will render this too, ensuring consistency.
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <p>{t(user ? 'authForm.loadingRedirect' : 'authForm.loadingPage')}</p>
      </div>
    );
  }

  if (user && !isInitializing) {
    // Fallback: if user exists and auth is done, render nothing while redirecting.
    return null;
  }

  // Render the register form only if:
  // - Auth is initialized (isInitializing is false)
  // - No user is present (user is null)
  // - Client-side effect has confirmed it's okay to show the form (canShowForm is true)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
       <div className="absolute top-4 right-4 flex gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
           <div className="flex items-center justify-center mb-4">
            <svg
              className="h-12 w-12 text-primary"
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
          <CardTitle className="text-2xl font-bold">{t('authForm.registerTitle')}</CardTitle>
          <CardDescription>{t('authForm.registerDescription')}</CardDescription>
        </CardHeader>
        <AuthForm isRegister={true} onSubmit={register} loading={authOperationLoading} />
      </Card>
      <footer className="py-6 mt-8 text-center text-sm text-muted-foreground">
         <p>{t('footerCopyright', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}
