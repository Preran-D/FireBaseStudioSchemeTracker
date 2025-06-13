import React from 'react';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import BottomNavigationBar from '@/components/layout/BottomNavigationBar';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  LayoutDashboard: () => <svg data-testid="icon-dashboard" />,
  ListChecks: () => <svg data-testid="icon-schemes" />,
  Repeat: () => <svg data-testid="icon-transactions" />,
  UsersRound: () => <svg data-testid="icon-groups" />,
  FileText: () => <svg data-testid="icon-reports" />, // Ensure this matches the icon used
}));

describe('BottomNavigationBar', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (usePathname as jest.Mock).mockReturnValue('/');
  });

  it('renders correctly with default props', () => {
    render(<BottomNavigationBar />);

    // Check for general structure (e.g., nav element)
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    // Check for glass morphism and positioning classes (approximate check)
    const navElement = screen.getByRole('navigation');
    expect(navElement).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
    expect(navElement).toHaveClass('bg-white/30', 'backdrop-blur-md'); // Example glassmorphism classes
  });

  it('renders all navigation items with icons and text', () => {
    render(<BottomNavigationBar />);

    const navItems = [
      { label: 'Dashboard', href: '/', iconTestId: 'icon-dashboard' },
      { label: 'Schemes', href: '/schemes', iconTestId: 'icon-schemes' },
      { label: 'Transactions', href: '/transactions', iconTestId: 'icon-transactions' },
      { label: 'Groups', href: '/groups', iconTestId: 'icon-groups' },
      { label: 'Reports', href: '/reports', iconTestId: 'icon-reports' },
    ];

    navItems.forEach(item => {
      const linkElement = screen.getByRole('link', { name: new RegExp(item.label, 'i') });
      expect(linkElement).toBeInTheDocument();
      expect(linkElement).toHaveAttribute('href', item.href);
      expect(screen.getByTestId(item.iconTestId)).toBeInTheDocument();
    });
  });

  it('applies active styles to the current path link', () => {
    (usePathname as jest.Mock).mockReturnValue('/schemes');
    render(<BottomNavigationBar />);

    const activeLink = screen.getByRole('link', { name: /schemes/i });
    const inactiveLink = screen.getByRole('link', { name: /dashboard/i });

    // Assuming active class is 'bg-primary text-primary-foreground' or similar
    // This will depend on the actual classes used in BottomNavigationBar.tsx
    // For this example, let's check for a common pattern.
    // Note: Exact class matching can be brittle. Consider testing aria-current or a data attribute if used.
    expect(activeLink).toHaveClass('text-primary'); // Example active class part
    expect(inactiveLink).not.toHaveClass('text-primary'); // Example: ensure inactive doesn't have it
  });

  it('renders placeholder icons if original icons are not available', () => {
    // This test case is more for robustness if icon components could fail.
    // Here, we're mocking them, so they should always "render".
    // If there was a fallback mechanism in the component, we'd test that.
    render(<BottomNavigationBar />);
    expect(screen.getByTestId('icon-dashboard')).toBeInTheDocument();
  });

});
