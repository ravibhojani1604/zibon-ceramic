
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google'; // Corrected import name
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Added Toaster import
import { I18nProvider } from '@/context/i18n'; // Import I18nProvider
import { ThemeProvider } from '@/context/ThemeContext'; // Import ThemeProvider

const geistSans = Geist({ // Corrected usage
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({ // Corrected usage
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Zibon Ceramic', // Updated title - this will be static unless overridden by child pages
  description: 'Track your tile inventory with Zibon Ceramic.', // Updated description - static
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
              {children}
              <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
