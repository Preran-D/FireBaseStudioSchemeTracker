
'use client'; // Add 'use client' directive

import { useEffect } from 'react'; // Import useEffect
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { autoArchiveClosedSchemesByGracePeriod } from '@/lib/mock-data'; // Import the auto-archive function
import AppLayout from '@/components/layout/AppLayout';
import { ThemeProvider } from '@/hooks/useTheme';

export const metadata: Metadata = {
  title: 'Scheme Tracker',
  description: 'Track and maintain customer schemes',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // This should ideally use a grace period from user settings if available.
    // For now, using a default value.
    const DEFAULT_GRACE_PERIOD_DAYS = 60;
    console.log(`Running auto-archive for schemes closed more than ${DEFAULT_GRACE_PERIOD_DAYS} days ago on app load.`);
    const result = autoArchiveClosedSchemesByGracePeriod(DEFAULT_GRACE_PERIOD_DAYS);
    // The function autoArchiveClosedSchemesByGracePeriod already logs successes to the console.
    // No toast notification here to avoid being intrusive on every app load.
    // Users can see the results of archival on the archive management page or via console logs.
    if (result.archivedCount > 0) {
      console.log(`[AppLayout Auto-Archive] Successfully auto-archived ${result.archivedCount} scheme(s).`);
    } else {
      console.log(`[AppLayout Auto-Archive] No schemes were eligible for auto-archiving on app load.`);
    }
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Additional head elements if needed */}
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
            <AppLayout>
              {children}
            </AppLayout>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
