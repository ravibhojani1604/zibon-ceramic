'use client';

import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/context/i18n';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login, user, loading: authOperationLoading, isInitializing } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    if (!isInitializing && user) {
      router.replace('/inventory');
    }
  }, [user, isInitializing, router]);

  if (isInitializing || (!isInitializing && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
         <div className="flex items-center justify-center mb-6">
           <svg
            className={cn(
              "h-16 w-16 text-primary",
              { 'animate-spin': clientMounted && isInitializing }
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
        <p className="text-muted-foreground mb-6">{isInitializing ? t('authForm.loadingPage') : t('authForm.loadingRedirect')}</p>
        <div className="w-full max-w-xs space-y-3 mx-auto">
          <div className={cn("h-10 w-full bg-muted rounded-md", { 'animate-pulse': clientMounted && isInitializing })} />
          <div className={cn("h-6 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': clientMounted && isInitializing })} />
        </div>
      </div>
    );
  }
  
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
          <CardTitle className="text-2xl font-bold">{t('authForm.loginTitle')}</CardTitle>
          <CardDescription>{t('authForm.loginDescription')}</CardDescription>
        </CardHeader>
        <AuthForm isRegister={false} onSubmit={login} loading={authOperationLoading} />
      </Card>
       <footer className="py-6 mt-8 text-center text-sm text-muted-foreground">
         <p>{t('footerCopyright', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}
