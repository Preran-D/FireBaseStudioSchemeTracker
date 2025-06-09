
'use client';

import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, DatabaseZap } from 'lucide-react';

import { AppLogo } from '@/components/shared/AppLogo';
import { ThemeToggle } from './ThemeToggle';
import {
  // SideContextWrapper, // No longer used here, moved to RootLayout
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar, // This component will consume the context
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/data-management', label: 'Data Management', icon: DatabaseZap },
];

// This component is now the main layout structure and uses useSidebar
export default function AppLayout({ children }: PropsWithChildren) {
  const { isOpen } = useSidebar(); // Consuming the context
  const pathname = usePathname();

  // MainHeader is defined here as it uses SidebarTrigger which uses useSidebar
  function MainHeader() {
    return (
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <SidebarTrigger />
        <div className="flex-1">
          {/* Placeholder for breadcrumbs or page title if needed */}
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar>
        <SidebarHeader>
          <Link href="/" className="flex items-center gap-2 overflow-hidden h-full">
            <AppLogo className="h-7 w-7 text-primary flex-shrink-0" />
            <span className={cn(
              "font-headline text-xl font-semibold text-sidebar-foreground whitespace-nowrap transition-opacity duration-200",
              isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
              Scheme Tracker
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  href={item.href}
                  icon={<item.icon className="h-5 w-5" />}
                  tooltipLabel={item.label}
                  isActive={pathname === item.href}
                >
                  {item.label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <MainHeader />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
