
'use client';

import type { PropsWithChildren } from 'react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, DatabaseZap, Settings, Bell, User, Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/data-management', label: 'Data Management', icon: DatabaseZap },
];

// Utility items will now only have icons for desktop, labels for mobile.
const utilityNavItems = [
    { id: 'settings', href: '#!', label: 'Settings', icon: Settings },
    { id: 'notifications', href: '#!', label: 'Notifications', icon: Bell, hasNotification: true },
    { id: 'profile', href: '#!', label: 'Profile', icon: User },
];


function TopNavigationBar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <header className="sticky top-0 z-50 py-3 px-4 md:px-6 supports-[backdrop-filter]:bg-transparent bg-transparent">
      {/* Main navigation bar container */}
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

        {/* Right: Group for Navigation Links and Utility Icons (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Main Navigation Links */}
          <nav
            className="flex items-center gap-1 rounded-full px-2 py-1.5
                       bg-background/80 dark:bg-zinc-800/70 border border-[hsl(var(--border)/0.5)] dark:border-[hsl(var(--border)/0.4)]"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
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
            <ThemeToggle /> {/* ThemeToggle is already styled as a circular icon button */}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileMenu}
            className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>
      
      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden absolute top-[calc(100%_-_0.25rem)] left-0 right-0 mx-4 shadow-xl z-40" // Positioned slightly overlapping
          >
            <div className="rounded-xl border border-border bg-card/90 dark:bg-card/80 backdrop-blur-lg p-4">
              <nav className="flex flex-col space-y-1 mb-3">
                {navItems.map((item) => (
                  <Link
                    key={`mobile-${item.label}`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors",
                      pathname === item.href
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5 opacity-80" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-border pt-3 space-y-1">
                 {utilityNavItems.map((item) => (
                  <Link
                    key={`mobile-util-${item.id}`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-foreground hover:bg-muted relative"
                  >
                    <item.icon className="h-5 w-5 opacity-80" />
                    {item.label}
                    {item.hasNotification && (
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 block h-2.5 w-2.5 rounded-full bg-accent" />
                    )}
                  </Link>
                ))}
                <div className="flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-muted">
                    <span className="flex items-center gap-3 text-base font-medium text-foreground">
                        <Settings className="h-5 w-5 opacity-80"/> Theme
                    </span>
                    <ThemeToggle />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body">
      <TopNavigationBar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 container mx-auto">
        {children}
      </main>
    </div>
  );
}
    

    