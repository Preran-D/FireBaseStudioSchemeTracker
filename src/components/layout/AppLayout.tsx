
'use client';

import type { PropsWithChildren } from 'react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, Settings, Bell, User, MoreVertical, Sun, Moon, Palette, FileText } from 'lucide-react'; // Added FileText
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from '@/hooks/useTheme';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/reports', label: 'Reports', icon: FileText }, // Added Reports link
];

const utilityNavItems = [
    { id: 'settings', href: '/settings', label: 'Settings', icon: Settings },
];

function TopNavigationBar() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light'); // system goes back to light
  };

  return (
    <header className="sticky top-0 z-50 py-3 px-4 md:px-6 supports-[backdrop-filter]:bg-transparent bg-transparent">
      <div
        className="container mx-auto flex h-16 items-center justify-between rounded-full px-4 md:px-6 shadow-lg
                   bg-card/70 dark:bg-card/60 backdrop-blur-xl border border-border/30"
      >
        {/* Left: Logo */}
        <Link
          href="/"
          className="px-5 py-2.5 border border-[hsl(var(--border)/0.7)] dark:border-[hsl(var(--border)/0.6)] rounded-full
                     text-foreground font-semibold text-sm hover:bg-muted/30 transition-colors flex-shrink-0"
        >
          Scheme Tracker
        </Link>

        {/* Desktop Navigation (Center & Right) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Main Navigation Links */}
          <nav
            className="flex items-center gap-1 rounded-full px-2 py-1.5
                       bg-background/80 dark:bg-zinc-800/70 border border-[hsl(var(--border)/0.5)] dark:border-[hsl(var(--border)/0.4)]"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ease-out",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Utility Icons */}
          <div className="flex items-center gap-1 rounded-full px-1.5 py-1
                          bg-background/80 dark:bg-zinc-800/70 border border-[hsl(var(--border)/0.5)] dark:border-[hsl(var(--border)/0.4)]">
            {utilityNavItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground h-9 w-9 relative"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  {item.hasNotification && (
                      <span className="absolute top-1.5 right-1.5 block h-2 w-2.5 rounded-full bg-accent ring-1 ring-background" />
                  )}
                  <span className="sr-only">{item.label}</span>
                </Link>
              </Button>
            ))}
            <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                className="rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground h-9 w-9"
                aria-label={mounted ? `Toggle theme. Current theme: ${theme}. Displaying as: ${resolvedTheme}.` : 'Toggle theme'}
            >
              {mounted && resolvedTheme === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              <span className="sr-only">
                {mounted ? `Toggle theme (Currently: ${theme}, Displaying as: ${resolvedTheme})` : 'Toggle theme'}
              </span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu Trigger & Panel */}
        <div className="md:hidden flex items-center">
          <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 mt-2 glassmorphism border-border/30 shadow-xl">
              {/* Main Nav Items for Mobile */}
              {navItems.map((item) => (
                <DropdownMenuItem key={`mobile-${item.href}`} asChild className="cursor-pointer p-0">
                  <Link
                    href={item.href}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm",
                      pathname === item.href ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted/50"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className={cn("h-5 w-5", pathname === item.href ? "text-primary" : "text-muted-foreground")} />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-1.5 bg-border/30"/>
              {/* Utility Nav Items for Mobile */}
              {utilityNavItems.map((item) => (
                <DropdownMenuItem key={`mobile-util-${item.id}`} asChild className="cursor-pointer p-0">
                  <Link
                    href={item.href}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted/50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <span>{item.label}</span>
                    {item.hasNotification && <span className="ml-auto h-2 w-2.5 rounded-full bg-accent" />}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-1.5 bg-border/30"/>
              {/* Theme Toggle for Mobile */}
              <DropdownMenuItem
                onClick={() => { cycleTheme(); setIsMobileMenuOpen(false); }}
                className="cursor-pointer flex items-center gap-3 px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted/50"
              >
                {mounted && resolvedTheme === 'dark' ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <span>Toggle Theme</span>
                {mounted && (
                  <span className="ml-auto text-xs text-muted-foreground uppercase">({theme.charAt(0)})</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function BottomNavigationBar() {
  const pathname = usePathname();
  const bottomNavItems = navItems.slice(0, Math.min(navItems.length, 4)); // Ensures we don't exceed 4 items if navItems is shorter

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_-3px_rgba(255,255,255,0.03)]">
      <div className="container mx-auto flex justify-around items-center h-16">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={`bottom-${item.href}`}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-1/4 h-full", // Ensure w-1/4 for 4 items
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/30"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-0.5 truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body">
      <TopNavigationBar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 container mx-auto md:pt-8 pb-20 md:pb-6">
        {children}
      </main>
      <BottomNavigationBar />
    </div>
  );
}

