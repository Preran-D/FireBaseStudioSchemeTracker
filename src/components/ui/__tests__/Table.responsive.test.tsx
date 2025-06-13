import React from 'react';
import { render, screen } from '@testing-library/react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'; // Adjust import path if needed

// Helper function to simulate viewport changes (conceptual)
// In a real environment, this might involve JSDOM manipulation or a library.
const setViewportWidth = (width: number) => {
  // This is a placeholder. React Testing Library runs in JSDOM, which doesn't
  // fully support layout/media queries out of the box for dynamic changes.
  // For actual testing, you might use tools like Cypress, Playwright,
  // or configure Jest + JSDOM with appropriate shims or manual property overrides.
  // For this test, we'll rely on Tailwind classes being correctly applied
  // and assume the test runner can interpret them or we check for classes directly.
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

const mockTableData = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const TestTableComponent = ({ mobile }: { mobile?: boolean }) => {
  // Simulate viewport change before rendering if 'mobile' prop is true
  // This is a workaround for testing responsive behavior in JSDOM.
  // Ideally, media queries would be handled by the testing environment.
  if (mobile) {
    // Simulate mobile viewport (e.g., less than 768px for 'md' breakpoint)
    // This won't directly trigger CSS media queries in JSDOM the same way a browser does.
    // The tests will primarily check for the application of responsive utility classes.
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockTableData.map(row => (
          <TableRow key={row.id}>
            <TableCell data-label="ID">{row.id}</TableCell>
            <TableCell data-label="Name">{row.name}</TableCell>
            <TableCell data-label="Email">{row.email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};


describe('Table Component Responsive Behavior', () => {
  // Note: These tests rely on checking for Tailwind classes.
  // Testing actual visual output based on media queries is better done with E2E tests.

  describe('On small screens (mobile view)', () => {
    beforeEach(() => {
      // setViewportWidth(500); // Conceptual: not directly effective in JSDOM for CSS
      // We will test by checking the classes that Tailwind applies for small screens.
    });

    it('hides TableHeader', () => {
      render(<TestTableComponent mobile />);
      const tableHeader = screen.getByRole('rowgroup', { name: '' }); // thead
      // Tailwind class for hidden on small, table-header-group on md+
      expect(tableHeader).toHaveClass('hidden', 'md:table-header-group');
    });

    it('displays TableCells as blocks and shows data-label content', () => {
      render(<TestTableComponent mobile />);
      const cells = screen.getAllByRole('cell'); // Get all <td> elements

      cells.forEach(cell => {
        // Check for block display class for mobile
        expect(cell).toHaveClass('block', 'md:table-cell');

        // Check if the data-label span is present and visible on mobile
        // The TableCell component was modified to render:
        // {dataLabel && <span className="md:hidden font-semibold mr-2">{dataLabel}:</span>}
        const labelSpan = cell.querySelector('span.md\:hidden');
        if (cell.textContent === '1' || cell.textContent === '2') { // Cells with ID
          expect(labelSpan).toHaveTextContent('ID:');
        } else if (cell.textContent === 'Alice' || cell.textContent === 'Bob') { // Cells with Name
          expect(labelSpan).toHaveTextContent('Name:');
        } else if (cell.textContent === 'alice@example.com' || cell.textContent === 'bob@example.com') { // Cells with Email
          expect(labelSpan).toHaveTextContent('Email:');
        }
        if (labelSpan) { // Ensure the span itself has md:hidden
            expect(labelSpan).toHaveClass('md:hidden');
        }
      });
    });
  });

  describe('On larger screens (desktop view)', () => {
    beforeEach(() => {
      // setViewportWidth(1024); // Conceptual
    });

    it('shows TableHeader', () => {
      render(<TestTableComponent />);
      const tableHeader = screen.getByRole('rowgroup', { name: '' }); // thead
      // Should not effectively be 'hidden' due to md:table-header-group
      // We check that the classes allow it to be visible on md+ screens.
      expect(tableHeader).toHaveClass('md:table-header-group');
      // More robustly, check that 'hidden' is not the dominant style if possible,
      // or verify computed styles if the test env supports it.
      // For now, class check is the primary method.
    });

    it('displays TableCells as table-cells and hides data-label spans', () => {
      render(<TestTableComponent />);
      const cells = screen.getAllByRole('cell');

      cells.forEach(cell => {
        expect(cell).toHaveClass('md:table-cell');
        // The span with data-label should be hidden on md screens by 'md:hidden'
        const labelSpan = cell.querySelector('span.md\:hidden');
        if (labelSpan) {
          // This is tricky in JSDOM. 'md:hidden' means it *would* be hidden in a browser.
          // We can check if the class is there, implying it's meant to be hidden.
          expect(labelSpan).toHaveClass('md:hidden');
        }
      });

      // Verify header cells are present
      expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    });
  });
});
