'use client';
import "./globals.css";
import React, { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/AuthScreen'; // Убедись, что путь к AuthScreen верный
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

// Добавь этот импорт в самом верху вместе с остальными
import Script from 'next/script'; 

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const authStatus = localStorage.getItem('is_authed') === 'true';
    setIsAuthenticated(authStatus);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkDemoExpiry = () => {
      const isDemo = localStorage.getItem('demo_mode') === 'true';
      const demoStart = localStorage.getItem('demo_start');
      
      if (isDemo && demoStart) {
        const elapsed = Date.now() - parseInt(demoStart, 10);
        const THREE_MINUTES = 3 * 60 * 1000; 

        if (elapsed >= THREE_MINUTES) {
          localStorage.setItem('is_authed', 'false');
          localStorage.setItem('demo_expired', 'true');
          setIsAuthenticated(false);
          
          toast({
            variant: 'destructive',
            title: 'Демо-период завершен',
            description: 'Для продолжения работы необходим ключ доступа.',
          });
        }
      }
    };

    const interval = setInterval(checkDemoExpiry, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, toast]);

  if (isChecking) return null;

  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        
        {/* КРИТИЧЕСКИ ВАЖНО: Подключаем скрипт Telegram */}
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive" 
        />
      </head>
      <body className="antialiased dark">
        {isAuthenticated ? (
          <main>{children}</main>
        ) : (
          <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        )}
        <Toaster />
      </body>
    </html>
  );
}