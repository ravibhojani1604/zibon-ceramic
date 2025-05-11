
'use client';
import { useTranslation } from '@/context/i18n';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <Button variant="outline" size="icon">
         <Globe className="h-[1.2rem] w-[1.2rem]" />
         <span className="sr-only">{t('changeLanguage')}</span>
       </Button>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end">
       <DropdownMenuItem onClick={() => setLocale('en')} disabled={locale === 'en'}>
         English
       </DropdownMenuItem>
       <DropdownMenuItem onClick={() => setLocale('gu')} disabled={locale === 'gu'}>
         ગુજરાતી (Gujarati)
       </DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
  );
}
