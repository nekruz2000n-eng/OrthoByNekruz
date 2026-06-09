'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, ClipboardList, FileText, BarChart3, RotateCcw } from 'lucide-react';

const NAV = [
  { href: '/learn', icon: Home, label: 'Главная' },
  { href: '/learn/study', icon: BookOpen, label: 'Учёба' },
  { href: '/learn/review', icon: RotateCcw, label: 'Повтор' },
  { href: '/learn/glossary', icon: FileText, label: 'Глоссарий' },
  { href: '/learn/stats', icon: BarChart3, label: 'Статистика' },
];

export function OrthoNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-2 pt-2"
      style={{ paddingBottom: 'calc(var(--nav-bottom, 0px) + 8px)', background: 'var(--c-nav-bg)', borderTop: '1px solid var(--c-nav-border)' }}
    >
      <div className="flex justify-around max-w-lg mx-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/learn' && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center px-2"
              style={{ color: active ? 'var(--c-primary)' : 'var(--c-muted)' }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ background: 'var(--c-bg)' }}>
      <div className="flex-1 overflow-hidden" style={{ paddingTop: 'var(--header-pt)', paddingBottom: 'var(--scroll-pb)' }}>
        {children}
      </div>
      <OrthoNav />
    </div>
  );
}
