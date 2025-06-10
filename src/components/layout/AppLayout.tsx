
'use client';

import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, DatabaseZap } from 'lucide-react';
import { AppLogo } from '@/components/shared/AppLogo';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/data-management', label: 'Data Management', icon: DatabaseZap },
];

function TopNavigationBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 py-2 shadow-sm backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <AppLogo className="h-8 w-8 text-primary" />
          <span className="font-headline text-xl font-semibold text-foreground hidden sm:inline-block">
            Scheme Tracker
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant={pathname === item.href ? "secondary" : "ghost"}
              size="sm"
              asChild
              className={cn(
                "px-3 py-1.5 h-auto text-sm font-medium",
                pathname === item.href 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              )}
            >
              <Link href={item.href} className="flex items-center gap-1.5">
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline-block">{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopNavigationBar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 container mx-auto">
        {children}
      </main>
    </div>
  );
}
