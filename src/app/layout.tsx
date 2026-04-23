import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';
import TelegramProvider from '@/components/TelegramProvider';

export const metadata: Metadata = {
  title: 'OrthoByNekruz',
  description: 'Dental Student Learning Platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Telegram SDK загружаем только на клиенте и асинхронно */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="lazyOnload"
        />
      </head>
      <body className="font-body antialiased bg-background text-foreground overflow-hidden h-screen w-screen">
        <TelegramProvider />
        {children}
        <Toaster />
      </body>
    </html>
  );
}