
// Removed 'use client' directive

// Removed useEffect import as it's no longer directly used here
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
// Removed autoArchiveClosedSchemesByGracePeriod import from mock-data
import AppLayout from '@/components/layout/AppLayout';
import { ThemeProvider } from '@/hooks/useTheme';
import { AutoArchiveTrigger } from '@/components/layout/AutoArchiveTrigger'; // Import the new component

export const metadata: Metadata = {
  title: 'Scheme Tracker',
  description: 'Track and maintain customer schemes',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Removed the useEffect hook for auto-archiving from here

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Additional head elements if needed */}
      </head>
      <body className="font-body antialiased">
        <ThemeProvider> {/* ThemeProvider typically does not need 'use client' itself if it's just context */}
            <AppLayout> {/* AppLayout might be a client component or contain client components */}
              {children}
            </AppLayout>
          <Toaster />
          <AutoArchiveTrigger /> {/* Added the AutoArchiveTrigger component */}
        </ThemeProvider>
      </body>
    </html>
  );
}
