
'use client';

import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/context/i18n';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RegisterPage() {
  const { register, user, loading: authOperationLoading, isInitializing } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!isInitializing && user) {
      router.replace('/inventory');
    }
  }, [user, isInitializing, router]);

  if (isInitializing || (!isInitializing && user)) {
    // Show loading or placeholder while checking auth or redirecting
     return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
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
        <p>{isInitializing ? t('authForm.loadingPage') : t('authForm.loadingRedirect')}</p>
      </div>
    );
  }

  // If not initializing and no user, show the register form.
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
