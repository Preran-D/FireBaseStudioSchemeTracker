
import type { PropsWithChildren } from 'react';
import { SideContextWrapper, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarInset, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Repeat, Users2, DatabaseZap } from 'lucide-react'; 
import { AppLogo } from '@/components/shared/AppLogo';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schemes', label: 'Schemes', icon: ListChecks },
  { href: '/transactions', label: 'Transactions', icon: Repeat }, 
  { href: '/groups', label: 'Groups', icon: Users2 },
  { href: '/data-management', label: 'Data Management', icon: DatabaseZap },
];

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <SideContextWrapper defaultOpen={false}> {/* Sidebar starts collapsed for nav rail effect */}
      <Sidebar collapsible="icon" variant="sidebar" className="border-r">
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <AppLogo className="size-7 text-primary group-data-[collapsible=icon]:size-6" />
            <h1 className="font-headline text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">Scheme Tracker</h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={{ 
                      children: item.label, 
                      className:"bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border shadow-lg" // Enhanced tooltip style
                    }}
                    className="justify-start"
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 mt-auto">
          {/* Footer items removed as per request */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:px-6">
          <SidebarTrigger className="sm:hidden" /> {/* For mobile */}
          <div className="flex-1">
            {/* Breadcrumbs or page title can go here if needed in future */}
          </div>
          {/* Notifications and User Avatar Dropdowns removed */}
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SideContextWrapper>
  );
}
