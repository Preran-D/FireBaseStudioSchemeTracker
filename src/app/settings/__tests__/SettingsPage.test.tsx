import React from 'react';
import { render, screen } from '@testing-library/react';
import SettingsPage from '../page'; // Adjust import path to the actual page component
import { useToast } from '@/hooks/use-toast'; // Mock useToast

// Mock next/navigation if Link components are used directly or for usePathname
jest.mock('next/navigation', () => ({
  usePathname: jest.fn().mockReturnValue('/settings'), // Mock pathname for Settings page
  useRouter: jest.fn(() => ({ push: jest.fn() })), // Mock router if needed
}));

// Mock useToast
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(() => ({ toast: jest.fn() })),
}));

// Mock any child components that make network calls or have complex internal state not relevant to this test.
// For instance, if RecommendedSettingsTabContent or DataManagementTabContent (if it were still there)
// had complex side effects, they might need mocking. Given the refactor, we're mostly checking structure.

describe('SettingsPage', () => {
  beforeEach(() => {
    // Reset mocks if necessary, e.g., (usePathname as jest.Mock).mockClear();
    (useToast().toast as jest.Mock).mockClear();
  });

  it('renders the App Preferences tab and does NOT render Data Management tab trigger', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('tab', { name: /App Preferences/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Data Management/i })).not.toBeInTheDocument();
  });

  it('renders a link/button to the new Data Management page within App Preferences content', () => {
    render(<SettingsPage />);

    // Assuming the "App Preferences" tab is active by default or can be clicked.
    // If not active by default, add userEvent.click(screen.getByRole('tab', { name: /App Preferences/i }));

    const dataManagementLink = screen.getByRole('link', { name: /Go to Data Management Page/i });
    expect(dataManagementLink).toBeInTheDocument();
    expect(dataManagementLink).toHaveAttribute('href', '/data-management');
  });

  it('uses grid-cols-1 for TabsList, indicating single tab setup', () => {
    render(<SettingsPage />);
    const tabsList = screen.getByRole('tablist');
    expect(tabsList).toHaveClass('grid-cols-1');
  });
});
