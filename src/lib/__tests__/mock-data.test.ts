import {
  MOCK_SCHEMES,
  addMockScheme,
  getMockSchemeById,
  deleteFullMockScheme,
  archiveMockScheme, // Import archiveMockScheme for test setup
  reopenMockScheme, // Import for test setup or resetting state
  closeMockScheme // Import for test setup
} from '../mock-data'; // Adjust path as needed
import type { Scheme, SchemeStatus } from '@/types/scheme'; // Adjust path as needed
import { formatISO, addMonths, subMonths, startOfDay } from 'date-fns';

// Helper to reset MOCK_SCHEMES to a known state before each test or group of tests
// This is important because MOCK_SCHEMES is mutated by some functions.
const originalMockSchemes = JSON.parse(JSON.stringify(MOCK_SCHEMES));
const resetMockSchemes = () => {
  MOCK_SCHEMES.length = 0; // Clear the array
  Array.prototype.push.apply(MOCK_SCHEMES, JSON.parse(JSON.stringify(originalMockSchemes)));
};

describe('Mock Data Scheme Operations', () => {
  beforeEach(() => {
    resetMockSchemes(); // Reset before each test in this describe block
  });

  // ... other tests for mock-data.ts can go here ...

  describe('deleteFullMockScheme', () => {
    let activeScheme: Scheme;
    let closedScheme: Scheme;
    let archivedScheme: Scheme;
    let upcomingScheme: Scheme;

    // beforeAll runs once before all tests in this describe block
    beforeAll(() => {
      resetMockSchemes(); // Ensure a clean slate for this specific suite's setup

      // Active Scheme (example setup)
      const activeSchemeData = {
        customerName: 'Test Active Customer',
        startDate: formatISO(subMonths(new Date(), 2)),
        monthlyPaymentAmount: 100,
      };
      activeScheme = addMockScheme(activeSchemeData);
      // To ensure it's 'Active', we might need to simulate a payment or rely on addMockScheme's logic
      // For now, we assume addMockScheme sets it to a non-Closed/Archived state.
      // If tests fail due to incorrect initial status, this setup needs refinement.
      const activeSchemeIdx = MOCK_SCHEMES.findIndex(s => s.id === activeScheme.id);
      if (activeSchemeIdx > -1 && (MOCK_SCHEMES[activeSchemeIdx].status === 'Upcoming' || MOCK_SCHEMES[activeSchemeIdx].status === 'Closed' || MOCK_SCHEMES[activeSchemeIdx].status === 'Archived')) {
         // Minimal change to make it appear active for testing deletion logic
         MOCK_SCHEMES[activeSchemeIdx].status = 'Active';
         activeScheme = getMockSchemeById(activeScheme.id)!;
      }


      // Closed Scheme
      const closedSchemeData = {
        customerName: 'Test Closed Customer',
        startDate: formatISO(subMonths(new Date(), 13)),
        monthlyPaymentAmount: 100,
      };
      let tempClosedScheme = addMockScheme(closedSchemeData);
      const schemeToCloseIdx = MOCK_SCHEMES.findIndex(s => s.id === tempClosedScheme.id);
      if (schemeToCloseIdx > -1) {
         const closedResult = closeMockScheme(tempClosedScheme.id, { closureDate: formatISO(startOfDay(new Date())), type: 'full_reconciliation' });
         closedScheme = getMockSchemeById(tempClosedScheme.id)!;
         if (!closedScheme || closedScheme.status !== 'Closed') {
            // Fallback if closeMockScheme didn't set it as expected or failed
            MOCK_SCHEMES[schemeToCloseIdx].status = 'Closed';
            closedScheme = getMockSchemeById(tempClosedScheme.id)!;
         }
      } else {
        // Fallback if addMockScheme failed or scheme not found
        console.error("Failed to setup closedScheme for tests.");
        // @ts-ignore
        closedScheme = { id: 'error-closed', status: 'Closed' } as Scheme;
      }


      // Archived Scheme
      const archivableSchemeData = {
        customerName: 'Test Archivable Customer',
        startDate: formatISO(subMonths(new Date(), 14)),
        monthlyPaymentAmount: 100,
      };
      let tempArchivableScheme = addMockScheme(archivableSchemeData);
      const schemeToArchiveIdx = MOCK_SCHEMES.findIndex(s => s.id === tempArchivableScheme.id);

      if (schemeToArchiveIdx > -1) {
        closeMockScheme(tempArchivableScheme.id, { closureDate: formatISO(startOfDay(new Date())), type: 'full_reconciliation' });
        archiveMockScheme(tempArchivableScheme.id);
        archivedScheme = getMockSchemeById(tempArchivableScheme.id)!;
         if (!archivedScheme || archivedScheme.status !== 'Archived') {
            MOCK_SCHEMES[schemeToArchiveIdx].status = 'Archived';
            archivedScheme = getMockSchemeById(tempArchivableScheme.id)!;
         }
      } else {
        console.error("Failed to setup archivedScheme for tests.");
        // @ts-ignore
        archivedScheme = { id: 'error-archived', status: 'Archived' } as Scheme;
      }

      // Upcoming Scheme
      const upcomingSchemeData = {
        customerName: 'Test Upcoming Customer',
        startDate: formatISO(addMonths(new Date(), 2)),
        monthlyPaymentAmount: 100,
      };
      upcomingScheme = addMockScheme(upcomingSchemeData);
      const upcomingSchemeIdx = MOCK_SCHEMES.findIndex(s => s.id === upcomingScheme.id);
      if (upcomingSchemeIdx > -1 && MOCK_SCHEMES[upcomingSchemeIdx].status !== 'Upcoming') {
        MOCK_SCHEMES[upcomingSchemeIdx].status = 'Upcoming';
        upcomingScheme = getMockSchemeById(upcomingScheme.id)!;
      } else if (!upcomingScheme) {
        console.error("Failed to setup upcomingScheme for tests.");
        // @ts-ignore
        upcomingScheme = { id: 'error-upcoming', status: 'Upcoming' } as Scheme;
      }
    });

    afterAll(() => {
        resetMockSchemes(); // Clean up after this describe block
    });


    it('should NOT delete a scheme if its status is "Active"', () => {
      const activeSchemeFromGlobal = getMockSchemeById(activeScheme.id); // Fetch fresh from (potentially modified) MOCK_SCHEMES
      expect(activeSchemeFromGlobal).toBeDefined();
      expect(activeSchemeFromGlobal?.status).not.toBe('Closed');
      expect(activeSchemeFromGlobal?.status).not.toBe('Archived');

      const initialLength = MOCK_SCHEMES.length;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = deleteFullMockScheme(activeScheme.id);

      expect(result).toBe(false);
      expect(MOCK_SCHEMES.length).toBe(initialLength);
      expect(getMockSchemeById(activeScheme.id)).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`status is '${activeSchemeFromGlobal?.status}'`));
      consoleWarnSpy.mockRestore();
    });

    it('should NOT delete a scheme if its status is "Upcoming"', () => {
      const upcomingSchemeFromGlobal = getMockSchemeById(upcomingScheme.id);
      expect(upcomingSchemeFromGlobal).toBeDefined();
      expect(upcomingSchemeFromGlobal?.status).toBe('Upcoming');

      const initialLength = MOCK_SCHEMES.length;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = deleteFullMockScheme(upcomingScheme.id);

      expect(result).toBe(false);
      expect(MOCK_SCHEMES.length).toBe(initialLength);
      expect(getMockSchemeById(upcomingScheme.id)).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("status is 'Upcoming'"));
      consoleWarnSpy.mockRestore();
    });

    it('should NOT delete a scheme if its status is "Overdue"', () => {
      const overdueSchemeData = { customerName: 'Test Overdue Customer', startDate: formatISO(subMonths(new Date(), 3)), monthlyPaymentAmount: 50 };
      let overdueSchemeOriginal = addMockScheme(overdueSchemeData); // Add it fresh within this test
      const overdueSchemeIdx = MOCK_SCHEMES.findIndex(s => s.id === overdueSchemeOriginal.id);

      if (overdueSchemeIdx > -1) {
        MOCK_SCHEMES[overdueSchemeIdx].status = 'Overdue';
        overdueSchemeOriginal = getMockSchemeById(overdueSchemeOriginal.id)!;
      } else {
        console.error("Failed to setup overdueScheme for test.");
        // @ts-ignore
        overdueSchemeOriginal = { id: 'error-overdue', status: 'Overdue' } as Scheme;
      }
      expect(overdueSchemeOriginal?.status).toBe('Overdue');

      const initialLength = MOCK_SCHEMES.length;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = deleteFullMockScheme(overdueSchemeOriginal.id);

      expect(result).toBe(false);
      expect(MOCK_SCHEMES.length).toBe(initialLength);
      expect(getMockSchemeById(overdueSchemeOriginal.id)).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("status is 'Overdue'"));
      consoleWarnSpy.mockRestore();
    });

    it('should delete a scheme if its status is "Closed"', () => {
      const closedSchemeFromGlobal = getMockSchemeById(closedScheme.id);
      expect(closedSchemeFromGlobal).toBeDefined();
      expect(closedSchemeFromGlobal?.status).toBe('Closed');

      const initialLength = MOCK_SCHEMES.length;
      const result = deleteFullMockScheme(closedScheme.id);

      expect(result).toBe(true);
      expect(MOCK_SCHEMES.length).toBe(initialLength - 1);
      expect(getMockSchemeById(closedScheme.id)).toBeUndefined();
    });

    it('should delete a scheme if its status is "Archived"', () => {
      const archivedSchemeFromGlobal = getMockSchemeById(archivedScheme.id);
      expect(archivedSchemeFromGlobal).toBeDefined();
      expect(archivedSchemeFromGlobal?.status).toBe('Archived');

      const initialLength = MOCK_SCHEMES.length;
      const result = deleteFullMockScheme(archivedScheme.id);

      expect(result).toBe(true);
      expect(MOCK_SCHEMES.length).toBe(initialLength - 1);
      expect(getMockSchemeById(archivedScheme.id)).toBeUndefined();
    });

    it('should return false if scheme ID does not exist', () => {
      const initialLength = MOCK_SCHEMES.length;
      const result = deleteFullMockScheme('non-existent-id');
      expect(result).toBe(false);
      expect(MOCK_SCHEMES.length).toBe(initialLength);
    });
  });
});
