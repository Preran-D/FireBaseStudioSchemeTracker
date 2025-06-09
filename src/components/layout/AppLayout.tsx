
'use client';

import type { PropsWithChildren } from 'react';
import { LayoutDashboard, ListChecks, Repeat, UsersRound, DatabaseZap } from 'lucide-react';
import { TopNavigation } from './TopNavigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/data-management', label: 'Data Management', icon: DatabaseZap },
];

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopNavigation navItems={navItems} />
      <main className="flex-1 pt-16"> {/* Add padding-top to account for sticky nav height */}
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
