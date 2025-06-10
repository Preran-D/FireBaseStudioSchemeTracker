
import type { Metadata } from 'next';
// Removed Inter and Space_Grotesk imports
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/layout/AppLayout';
import { ThemeProvider } from '@/hooks/useTheme';
import { SideContextWrapper } from '@/components/ui/sidebar';

// Removed font loading for Inter and Space_Grotesk

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
      {/* Removed font variables from body className, rely on font-body from Tailwind config */}
      <body className="font-body antialiased">
        <ThemeProvider>
          <SideContextWrapper> {/* Wrap AppLayout with the Sidebar context provider */}
            <AppLayout>
              {children}
            </AppLayout>
          </SideContextWrapper>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
