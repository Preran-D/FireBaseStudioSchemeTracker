
'use client';

import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, DatabaseZap, Settings, Bell, User } from 'lucide-react';
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

const utilityNavItems = [
    { href: '#!', label: 'Settings', icon: Settings, showLabel: true },
    { href: '#!', label: 'Notifications', icon: Bell, showLabel: false, hasNotification: true },
    { href: '#!', label: 'Profile', icon: User, showLabel: false },
];


function TopNavigationBar() {
  const pathname = usePathname();

  return (
    <header className="py-3 px-4 md:px-6 supports-[backdrop-filter]:bg-transparent bg-transparent">
      <div
        className="container mx-auto flex h-16 items-center justify-between rounded-full px-3 shadow-lg
                   bg-gray-100/70 dark:bg-zinc-900/70 backdrop-blur-lg border border-gray-200/50 dark:border-zinc-700/50"
      >
        {/* Left: Logo - Stays on the far left */}
        <Link href="/" className="flex items-center">
          <div
            className="px-5 py-2 border border-gray-400/80 dark:border-zinc-600/80 rounded-full
                       text-foreground font-semibold text-base hover:bg-gray-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            Scheme Tracker
          </div>
        </Link>

        {/* Right: Group for Navigation Links and Utility Icons */}
        <div className="flex items-center gap-4">
          {/* Main Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-1 rounded-full px-2 py-1.5 shadow-inner
                       bg-white/80 dark:bg-zinc-800/80 border border-gray-200/30 dark:border-zinc-700/40"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-md"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-zinc-700/70"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Utility Icons & Theme Toggle */}
          <div className="flex items-center gap-2">
            {utilityNavItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                size={item.showLabel ? "default" : "icon"}
                asChild
                className="rounded-full bg-white/80 dark:bg-zinc-800/80 hover:bg-gray-200/80 dark:hover:bg-zinc-700/80
                           text-gray-700 dark:text-gray-300 hover:text-foreground
                           h-10 w-auto px-3 data-[size=icon]:w-10 data-[size=icon]:px-0 relative shadow-sm border border-gray-200/30 dark:border-zinc-700/40"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  {item.showLabel && <span className="ml-1.5 text-sm">{item.label}</span>}
                  {item.hasNotification && (
                      <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white/80 dark:ring-zinc-800/80" />
                  )}
                  <span className="sr-only">{item.label}</span>
                </Link>
              </Button>
            ))}
            <ThemeToggle />
          </div>
        </div>
      </div>
       {/* Mobile navigation (hamburger menu) placeholder - can be implemented later */}
      <div className="md:hidden flex items-center justify-between mt-2 px-4">
        <Link href="/" className="flex items-center">
            <div className="px-4 py-1.5 border border-gray-400/80 dark:border-zinc-600/80 rounded-full text-foreground font-semibold text-sm">
                Scheme Tracker
            </div>
        </Link>
        {/* Placeholder for a mobile menu button */}
        <Button variant="ghost" size="icon" className="rounded-full">
            <LayoutDashboard className="h-5 w-5"/> {/* Or Menu icon */}
        </Button>
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
