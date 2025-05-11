
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/context/ThemeContext"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/context/i18n" // Assuming you might want to translate "Light", "Dark", "System"

export default function ThemeSwitcher() {
  const { setTheme, theme } = useTheme()
  const { t } = useTranslation(); // Optional: for translating theme names

  // You can create a more sophisticated way to get translated theme names if needed
  const getTranslatedThemeName = (themeValue: string) => {
    if (themeValue === 'light') return t('themeLight') || 'Light';
    if (themeValue === 'dark') return t('themeDark') || 'Dark';
    if (themeValue === 'system') return t('themeSystem') || 'System';
    return themeValue;
  }


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('toggleTheme') || 'Toggle theme'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} disabled={theme === 'light'}>
          {getTranslatedThemeName('light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} disabled={theme === 'dark'}>
          {getTranslatedThemeName('dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} disabled={theme === 'system'}>
         {getTranslatedThemeName('system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
