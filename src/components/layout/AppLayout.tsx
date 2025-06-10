
'use client';

import type { PropsWithChildren } from 'react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, DatabaseZap, Settings, Bell, User, Menu, MoreVertical, Sun, Moon } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/data-management', label: 'Data Management', icon: DatabaseZap },
];

// Utility items for the top-right dropdown on mobile, and icons on desktop.
const utilityNavItems = [
    { id: 'settings', href: '#!', label: 'Settings', icon: Settings },
    { id: 'notifications', href: '#!', label: 'Notifications', icon: Bell, hasNotification: true },
    { id: 'profile', href: '#!', label: 'Profile', icon: User },
];

function TopNavigationBar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 py-3 px-4 md:px-6 supports-[backdrop-filter]:bg-transparent bg-transparent">
      <div
        className="container mx-auto flex h-16 items-center justify-between rounded-full px-4 md:px-6 shadow-lg
                   bg-card/70 dark:bg-card/60 backdrop-blur-xl border border-white/20 dark:border-white/10"
      >
        {/* Left: Logo */}
        <Link href="/" className="flex-shrink-0">
          <div
            className="px-5 py-2.5 border border-[hsl(var(--border)/0.7)] dark:border-[hsl(var(--border)/0.6)] rounded-full
                       text-foreground font-semibold text-sm hover:bg-muted/30 transition-colors"
          >
            Scheme Tracker
          </div>
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
                key={item.href} // Changed from item.label
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
          <div className="flex items-center gap-2 rounded-full px-1.5 py-1
                          bg-background/80 dark:bg-zinc-800/70 border border-[hsl(var(--border)/0.5)] dark:border-[hsl(var(--border)/0.4)]">
            {utilityNavItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full bg-transparent hover:bg-muted/60
                           text-muted-foreground hover:text-foreground
                           h-9 w-9 relative"
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
            {/* Desktop Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full bg-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground h-9 w-9"
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")} className={cn(theme === 'light' && 'font-semibold bg-muted/50', "cursor-pointer")}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className={cn(theme === 'dark' && 'font-semibold bg-muted/50', "cursor-pointer")}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className={cn(theme === 'system' && 'font-semibold bg-muted/50', "cursor-pointer")}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Utility Menu Trigger (Right) */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {utilityNavItems.map((item) => (
                <DropdownMenuItem key={item.id} asChild className="cursor-pointer">
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                    {item.hasNotification && <span className="ml-auto h-2 w-2 rounded-full bg-accent" />}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" /> System
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
  // Select first 4 items for the bottom bar.
  const bottomNavItems = navItems.slice(0, 4); 

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_-3px_rgba(255,255,255,0.03)]">
      <div className="container mx-auto flex justify-around items-center h-16">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={`bottom-${item.href}`} // Changed from item.label
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-1/4 h-full",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/30"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-6 w-6" />
              <span className="sr-only">{item.label}</span>
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
