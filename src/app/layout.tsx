import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Орбита — цифровой деканат', template: '%s · Орбита' },
  description:
    'Концепт для конкурса «Цифровой деканат будущего». Не является официальным сервисом вуза. Все персональные данные вымышленные.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#09090B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // класс .dark выставляет THEME_BOOT_SCRIPT до гидрации — отсюда suppressHydrationWarning
    <html lang="ru" className={`dark ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
