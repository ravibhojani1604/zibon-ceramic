
'use client';

import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/context/i18n';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
// No need for useEffect or useState here if AuthContext handles all main logic

export default function LoginPage() {
  // When LoginPage renders, AuthContext.isInitializing should be false because
  // AuthProvider shows its own loader and only renders children after initialization.
  const { login, user, loading: authOperationLoading } = useAuth();
  const { t } = useTranslation();

  if (user) {
    // User is logged in. AuthContext's onAuthStateChanged should have redirected or is redirecting.
    // This UI serves as a placeholder during that redirect.
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
        <p>{t('authForm.loadingRedirect')}</p>
      </div>
    );
  }

  // If no user, show the login form.
  // authOperationLoading is for the submit button's loading state.
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
