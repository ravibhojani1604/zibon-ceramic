
'use client';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';
import gu from '@/locales/gu.json';

export type Locale = 'en' | 'gu';
// Assuming en.json has all keys and gu.json has a similar structure
// For simplicity, we'll cast to `any` for nested access, or use a more robust type if needed.
type Translations = typeof en; 

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translationsData: Record<Locale, any> = { en, gu };

// Helper function to get nested values from JSON
const getNestedValue = (obj: any, path: string): string | undefined => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return acc[part];
    }
    return undefined;
  }, obj);
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedLocale = localStorage.getItem('locale') as Locale | null;
    if (storedLocale && (storedLocale === 'en' || storedLocale === 'gu')) {
      setLocaleState(storedLocale);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (isClient) {
      localStorage.setItem('locale', newLocale);
    }
  }, [isClient]);

  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    if (!isClient) { // Fallback for SSR or before hydration
        const defaultText = getNestedValue(translationsData.en, key) || key;
        if (options && typeof defaultText === 'string') {
          let tempText = defaultText;
          Object.keys(options).forEach(optionKey => {
            tempText = tempText.replace(new RegExp(`{{${optionKey}}}`, 'g'), String(options[optionKey]));
          });
          return tempText;
        }
        return typeof defaultText === 'string' ? defaultText : key;
    }

    const currentTranslations = translationsData[locale] || translationsData.en;
    let text = getNestedValue(currentTranslations, key) || getNestedValue(translationsData.en, key) || key;

    if (options && typeof text === 'string') {
      Object.keys(options).forEach(optionKey => {
        text = text.replace(new RegExp(`{{${optionKey}}}`, 'g'), String(options[optionKey]));
      });
    }
    return typeof text === 'string' ? text : key; // Ensure string return
  }, [locale, isClient]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
