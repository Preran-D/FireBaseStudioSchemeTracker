
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
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
