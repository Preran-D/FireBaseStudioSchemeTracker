
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/layout/AppLayout';
import { ThemeProvider } from '@/hooks/useTheme';
import { SideContextWrapper } from '@/components/ui/sidebar'; // Import the provider

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

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
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
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
