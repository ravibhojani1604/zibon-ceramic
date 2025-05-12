
'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from '@/context/i18n';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  const { user, logout, loading: authLoading, isInitializing } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    if (!isInitializing && !user) {
      router.replace('/login');
    }
  }, [user, isInitializing, router]);

  if (isInitializing && clientMounted) {
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
        <p className="text-muted-foreground mb-6">{t('authForm.loadingPage')}</p>
         <div className="w-full max-w-xs space-y-3 mx-auto">
          <div className={cn("h-10 w-full bg-muted rounded-md", { 'animate-pulse': clientMounted && isInitializing })} />
          <div className={cn("h-6 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': clientMounted && isInitializing })} />
        </div>
      </div>
    );
  }

  if (!user && !isInitializing) { // Only try to redirect if not initializing and no user
    // This case should ideally be handled by the useEffect redirecting to /login
    // If reached, it means user is null and not initializing, so should be on login page
    // To prevent rendering content meant for authenticated users before redirect happens:
    return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
            <p>{t('authForm.loadingRedirect')}</p> {/* Or a more specific "Redirecting to login..." */}
         </div>
    );
  }
  
  // If still initializing but not clientMounted yet, or user is null during initialization (before redirect logic kicks in hard)
  // render minimal loader or null to avoid showing layout meant for logged-in users
  if (isInitializing || !user) {
      return ( // Fallback loader, though AuthContext might show its own
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
            <div className="flex items-center justify-center mb-6">
              <svg
                className={cn("h-16 w-16 text-primary", { 'animate-spin': clientMounted })}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-ai-hint="ceramic tile">
                <path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M3 14h7v7H3z" /><path d="M14 14h7v7h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">{t('appTitle')}</h1>
            <p className="text-muted-foreground mb-6">{t('authForm.loadingPage')}</p>
          </div>
      );
  }


  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 shrink-0">
             <svg
                className="h-7 w-7 sm:h-8 sm:w-8 text-primary" // Decreased logo size
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
            <h1 className="text-md sm:text-lg font-bold text-primary truncate min-w-0">{t('headerTitle')}</h1> {/* Decreased text size */}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <Button variant="outline" size="sm" onClick={logout} disabled={authLoading}>
              <LogOut className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{t('logoutButton')}</span>
              <span className="sm:hidden sr-only">{t('logoutButton')}</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
       <footer className="py-6 text-center text-sm text-muted-foreground border-t">
         <p>{t('footerCopyright', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}

