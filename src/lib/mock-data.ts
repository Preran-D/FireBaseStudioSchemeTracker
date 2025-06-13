
import type { Scheme, Payment, PaymentMode, GroupDetail, SchemeStatus, MockGroup } from '@/types/scheme'; // Added MockGroup
import { generatePaymentsForScheme, getSchemeStatus, calculateSchemeTotals, calculateDueDate, getPaymentStatus, generateId } from '@/lib/utils';
import { subMonths, addMonths, formatISO, parseISO, startOfDay } from 'date-fns';

const createScheme = (
  customerName: string, 
  startDate: Date, 
  monthlyPaymentAmount: number,
  customerGroupName?: string,
  customerPhone?: string,
  customerAddress?: string
): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status' | 'closureDate'> = {
    id: generateId(),
    customerName,
    customerPhone,
    customerAddress,
    customerGroupName, 
    startDate: formatISO(startDate),
    monthlyPaymentAmount,
    durationMonths: 12,
  };
  
  let payments = generatePaymentsForScheme(baseScheme);
  
  if (customerName.includes("Alice Wonderland") && monthlyPaymentAmount === 1000) { 
    payments = payments.map((p, index) => {
      if (index < 3) { 
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Cash'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Bob The Builder") && monthlyPaymentAmount === 800) { 
    payments = payments.map((p, index) => {
      if (index < 1) { 
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Diana Prince")) { 
     payments = payments.map((p, index) => {
      if (index === 0) { 
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Card'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Edward Scissorhands")) { 
    payments = payments.map(p => ({ ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Cash'] as PaymentMode[] }));
  }

  const tempSchemeForStatusCalc: Scheme = {
    ...baseScheme,
    payments,
    status: 'Upcoming' 
  };
  tempSchemeForStatusCalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForStatusCalc.startDate));
  const calculatedStatus = getSchemeStatus(tempSchemeForStatusCalc);

  let scheme: Scheme = {
    ...baseScheme,
    payments: tempSchemeForStatusCalc.payments, 
    status: calculatedStatus, 
  };
  
  if (customerName.includes("Edward Scissorhands")) {
    // This scheme is fully paid and manually closed for the example
    scheme.status = 'Closed'; 
    scheme.closureDate = formatISO(addMonths(parseISO(scheme.startDate), scheme.durationMonths)); 
  }
  
  const totals = calculateSchemeTotals(scheme);
  scheme = { ...scheme, ...totals };

  return scheme;
};

export let MOCK_SCHEMES: Scheme[] = [
  createScheme('Alice Wonderland', subMonths(new Date(), 4), 1000, "Smith Family", "9876543210", "123 Wonderland Lane, Fantasy City"),
  createScheme('Active Customer', subMonths(new Date(), 4), 1000, "Smith Family", "8765432109", "456 Active Rd, Live Town"),
  createScheme('Active Customer', subMonths(new Date(), 1), 500, "Smith Family", "8765432109", "456 Active Rd, Live Town"), 
  createScheme('Bob The Builder', subMonths(new Date(), 2), 800, "Smith Family", "7654321098", "789 Construction Ave, Buildville"),
  createScheme('Charlie Brown', addMonths(new Date(), 1), 1500, "Office Buddies", "6543210987", "1 Peanuts St, Cartoonville"),
  createScheme('Diana Prince', subMonths(new Date(), 5), 500, "Smith Family", "5432109876", "Themyscira Island, Paradise"), 
  createScheme('Edward Scissorhands', subMonths(new Date(), 13), 2000, "Solo Ventures", "4321098765", "Gothic Mansion, Suburbia"), 
  createScheme('Fiona Gallagher', subMonths(new Date(), 11), 750, "Office Buddies", "3210987654", "South Side, Chicago"), 
  createScheme('George Jetson', subMonths(new Date(), 3), 1200, undefined, "2109876543", "Orbit City, Skypad Apartments"),
  createScheme('Hannah Montana', subMonths(new Date(), 1), 600, undefined, "1098765432", "Malibu, CA"), 
  createScheme('Iris West', subMonths(new Date(), 6), 900, "Smith Family", "0987654321", "Central City Apt"), 
];

// Initialize MOCK_GROUPS
export let MOCK_GROUPS: MockGroup[] = [];

export function initializeMockGroups(): void {
  if (MOCK_GROUPS.length > 0) {
    // Already initialized
    return;
  }
  const groupNames = new Set<string>();
  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.customerGroupName) {
      groupNames.add(scheme.customerGroupName);
    }
  });
  MOCK_GROUPS = Array.from(groupNames).map(name => ({ groupName: name, isArchived: false }));
  // console.log('MOCK_GROUPS initialized:', MOCK_GROUPS.length, 'groups');
}

initializeMockGroups(); // Call this once to populate MOCK_GROUPS


const fionaSchemeIdx = MOCK_SCHEMES.findIndex(s => s.customerName === 'Fiona Gallagher');
if (fionaSchemeIdx !== -1) {
  // Ensure Fiona's scheme is fully paid to become 'Completed'
  MOCK_SCHEMES[fionaSchemeIdx].payments = MOCK_SCHEMES[fionaSchemeIdx].payments.map((p, index) => {
    // Pay all 12 installments for Fiona
    if (index < MOCK_SCHEMES[fionaSchemeIdx].durationMonths) {
      return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
    }
    return p;
  });
  // Ensure closureDate is NOT set for Fiona, so it's purely 'Completed'
  MOCK_SCHEMES[fionaSchemeIdx].closureDate = undefined;

  MOCK_SCHEMES[fionaSchemeIdx].payments.forEach(p => p.status = getPaymentStatus(p, MOCK_SCHEMES[fionaSchemeIdx].startDate));
  MOCK_SCHEMES[fionaSchemeIdx].status = getSchemeStatus(MOCK_SCHEMES[fionaSchemeIdx]); // This should correctly set to 'Completed'
  const totals = calculateSchemeTotals(MOCK_SCHEMES[fionaSchemeIdx]);
  MOCK_SCHEMES[fionaSchemeIdx] = { ...MOCK_SCHEMES[fionaSchemeIdx], ...totals };
}


export const getMockSchemes = (options?: { includeArchived?: boolean }): Scheme[] => {
  const includeArchived = options?.includeArchived || false;
  // Start with all schemes, then filter out trashed ones first.
  let schemesToProcess = MOCK_SCHEMES.filter(s => !s.isTrashed);

  if (!includeArchived) {
    // Further filter out archived schemes if not requested
    schemesToProcess = schemesToProcess.filter(s => s.status !== 'Archived');
  }

  return JSON.parse(JSON.stringify(schemesToProcess.map(s => {
    const tempScheme = JSON.parse(JSON.stringify(s));
    // Ensure payments exist before trying to iterate
    if (tempScheme.payments && Array.isArray(tempScheme.payments)) {
      tempScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, tempScheme.startDate));
    } else {
      tempScheme.payments = []; // Initialize if undefined or not an array
    }

    // If scheme is already 'Archived', preserve it. Otherwise, calculate.
    const status = tempScheme.status === 'Archived' ? 'Archived' : getSchemeStatus(tempScheme);
    const totals = calculateSchemeTotals(tempScheme);
    // Ensure the status in the returned object is the potentially preserved 'Archived' status
    return { ...tempScheme, ...totals, status };
  })));
};

export const getArchivedMockSchemes = (): Scheme[] => {
  // Uses getMockSchemes internal processing to ensure consistent scheme object structure
  // and that the 'Archived' status is correctly preserved.
  const allSchemesIncludingArchived = getMockSchemes({ includeArchived: true });
  return allSchemesIncludingArchived.filter(s => s.status === 'Archived');
};


export const archiveMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];

  if (scheme.status === 'Closed') {
    scheme.status = 'Archived';
    scheme.archivedDate = formatISO(new Date());
    MOCK_SCHEMES[schemeIndex] = { ...scheme }; // Update the scheme in the main array
    return getMockSchemeById(schemeId); // Return a fresh copy with calculated fields
  }
  return undefined;
};

export const unarchiveMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  if (scheme.status === 'Archived') {
    scheme.archivedDate = undefined;
    // Revert to 'Closed'. getSchemeStatus will be called by getMockSchemeById
    // and should correctly evaluate it based on its payments if it wasn't truly 'Closed' before archiving.
    // Forcing it to 'Closed' here is a safe bet if it was archived from 'Closed'.
    // If getSchemeStatus is robust, it might correctly set it to 'Completed' if all payments are made.
    scheme.status = 'Closed';
    MOCK_SCHEMES[schemeIndex] = { ...scheme }; // Update the scheme in the main array
    return getMockSchemeById(schemeId); // Return a fresh copy
  }
  return undefined;
};

export const getMockSchemeById = (id: string): Scheme | undefined => {
  const schemeFromGlobalArray = MOCK_SCHEMES.find(s => s.id === id);
  if (!schemeFromGlobalArray) return undefined;
  
  const clonedScheme: Scheme = JSON.parse(JSON.stringify(schemeFromGlobalArray));

  clonedScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, clonedScheme.startDate));
  clonedScheme.status = getSchemeStatus(clonedScheme);
  
  const totals = calculateSchemeTotals(clonedScheme);
  return { ...clonedScheme, ...totals };
};

export const addMockScheme = (newSchemeData: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths' | 'closureDate'> & { customerGroupName?: string } ): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status' | 'closureDate'> = {
    id: generateId(),
    customerName: newSchemeData.customerName,
    customerPhone: newSchemeData.customerPhone,
    customerAddress: newSchemeData.customerAddress,
    customerGroupName: newSchemeData.customerGroupName,
    startDate: newSchemeData.startDate, 
    monthlyPaymentAmount: newSchemeData.monthlyPaymentAmount,
    durationMonths: 12,
  };
  
  const payments = generatePaymentsForScheme(baseScheme);
  
  const tempSchemeForStatusCalc: Scheme = {
    ...baseScheme,
    payments,
    status: 'Upcoming' as SchemeStatus 
  };
  tempSchemeForStatusCalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForStatusCalc.startDate));
  const calculatedStatus = getSchemeStatus(tempSchemeForStatusCalc); 

  let finalScheme: Scheme = { 
    ...baseScheme, 
    payments: tempSchemeForStatusCalc.payments, 
    status: calculatedStatus 
  };
  
  const totals = calculateSchemeTotals(finalScheme);
  finalScheme = { ...finalScheme, ...totals };
  
  MOCK_SCHEMES.push(finalScheme);
  return JSON.parse(JSON.stringify(finalScheme));
};


interface UpdatePaymentPayload {
  amountPaid?: number;
  paymentDate?: string;
  modeOfPayment?: PaymentMode[];
}

export const updateMockSchemePayment = (schemeId: string, paymentId: string, paymentDetails: UpdatePaymentPayload): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];

  // If the scheme is 'Closed', prevent direct payment modifications unless it's to system closure payments
  if (scheme.status === 'Closed' && scheme.closureDate) {
     const paymentBeingUpdated = scheme.payments.find(p => p.id === paymentId);
     if (paymentBeingUpdated && paymentBeingUpdated.paymentDate === scheme.closureDate && paymentBeingUpdated.modeOfPayment?.includes('System Closure')) {
        // This is likely the reconciliation payment being set/adjusted, allow it
     } else {
        console.warn(`Attempted to update payment for Closed scheme ${schemeId}. Reopen first or edit reconciliation payments specifically.`);
        return getMockSchemeById(schemeId); // Return current state without changes
     }
  }


  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  const originalPayment = scheme.payments[paymentIndex];
  const updatedPayment: Payment = { 
    ...originalPayment, 
    amountPaid: paymentDetails.amountPaid ?? originalPayment.amountPaid,
    paymentDate: paymentDetails.paymentDate ?? originalPayment.paymentDate,
    modeOfPayment: paymentDetails.modeOfPayment ?? originalPayment.modeOfPayment,
    status: originalPayment.status 
  };

  updatedPayment.status = getPaymentStatus(updatedPayment, scheme.startDate); 
  scheme.payments[paymentIndex] = updatedPayment;
  
  const wasClosed = scheme.status === 'Closed' && scheme.closureDate;
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme); 

  // If it was closed and now no longer meets "Closed" criteria (which means all payments are NOT paid)
  // then remove closureDate. This should be handled by getSchemeStatus not returning 'Closed' if not all paid.
  if(wasClosed && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid'){
      scheme.closureDate = undefined; 
  }
  
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); 
};

export const editMockPaymentDetails = (schemeId: string, paymentId: string, details: { amountPaid?: number; paymentDate?: string; modeOfPayment?: PaymentMode[] }): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const wasClosed = scheme.status === 'Closed' && scheme.closureDate;
  
  // If the scheme is 'Closed', prevent direct payment modifications (same logic as update)
  if (scheme.status === 'Closed' && scheme.closureDate) {
     const paymentBeingUpdated = scheme.payments.find(p => p.id === paymentId);
     if (paymentBeingUpdated && paymentBeingUpdated.paymentDate === scheme.closureDate && paymentBeingUpdated.modeOfPayment?.includes('System Closure')) {
        // Allow
     } else {
        console.warn(`Attempted to edit payment for Closed scheme ${schemeId}. Reopen first.`);
        return getMockSchemeById(schemeId);
     }
  }

  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex] = {
    ...scheme.payments[paymentIndex],
    ...details, 
  };
  
  scheme.payments[paymentIndex].status = getPaymentStatus(scheme.payments[paymentIndex], scheme.startDate);

  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); 
  scheme.status = getSchemeStatus(scheme); 

  if (wasClosed && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid') {
    scheme.closureDate = undefined; 
  }
  
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId);
}

export const deleteMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
 const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const wasClosed = scheme.status === 'Closed' && scheme.closureDate;

  // If the scheme is 'Closed', prevent direct payment modifications (same logic as update)
  if (scheme.status === 'Closed' && scheme.closureDate) {
     const paymentBeingDeleted = scheme.payments.find(p => p.id === paymentId);
     if (paymentBeingDeleted && paymentBeingDeleted.paymentDate === scheme.closureDate && paymentBeingDeleted.modeOfPayment?.includes('System Closure')) {
        // Allow deletion of system closure payments during editing a closed scheme (should probably just reopen)
     } else {
        console.warn(`Attempted to delete payment for Closed scheme ${schemeId}. Reopen first.`);
        return getMockSchemeById(schemeId);
     }
  }

  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  // Instead of clearing details, mark as archived
  scheme.payments[paymentIndex].isArchived = true;
  scheme.payments[paymentIndex].archivedDate = formatISO(new Date());
  // Note: The payment's original details (amountPaid, paymentDate, modeOfPayment, status) are preserved.
  // The status field might seem contradictory (e.g. 'Paid' but also archived).
  // UI will need to primarily use isArchived to hide/filter these payments.
  // Calculations in utils.ts (getSchemeStatus, calculateSchemeTotals) might need adjustment
  // if archived payments should not contribute to totals or affect scheme status.
  // For now, this subtask assumes utils.ts will be updated separately if needed.

  // Recalculate scheme status and totals (assuming utils are or will be archive-aware)
  scheme.payments.forEach(p => {
    if (!p.isArchived) p.status = getPaymentStatus(p, scheme.startDate);
  });
  scheme.status = getSchemeStatus(scheme);

  if (wasClosed && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid') {
    scheme.closureDate = undefined;
  }

  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); // Returns a fresh, recalculated scheme object
};

interface CloseSchemeOptions {
  closureDate: string; 
  type: 'full_reconciliation' | 'partial_closure';
  modeOfPayment?: PaymentMode[]; 
}

export const closeMockScheme = (schemeId: string, options: CloseSchemeOptions): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  
  const effectiveModeOfPayment = (options.modeOfPayment && options.modeOfPayment.length > 0) 
                                 ? options.modeOfPayment 
                                 : ['System Closure'] as PaymentMode[];

  // Set status to 'Closed' and update closure date
  scheme.status = 'Closed';
  scheme.closureDate = options.closureDate;

  if (options.type === 'full_reconciliation') {
    scheme.payments.forEach(p => { 
      const currentPaymentStatus = getPaymentStatus(p, scheme.startDate); 
      if (currentPaymentStatus !== 'Paid') {
        p.status = 'Paid'; // Mark as paid internally for reconciliation
        p.amountPaid = p.amountExpected; 
        p.paymentDate = options.closureDate; 
        p.modeOfPayment = effectiveModeOfPayment;
      } else if (p.paymentDate === options.closureDate && currentPaymentStatus === 'Paid') {
        // If a payment was already made on the closure date, ensure its mode is updated if different
        const currentModes = p.modeOfPayment?.join(',');
        const newModes = effectiveModeOfPayment.join(',');
        if (currentModes !== newModes) {
            p.modeOfPayment = effectiveModeOfPayment;
        }
      }
    });
  }
  
  // Recalculate all payment statuses (some might have been set to 'Paid' above)
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  // Scheme status is already 'Closed' by this point, totals are for financial record.
  
  const totals = calculateSchemeTotals(scheme); 
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return getMockSchemeById(schemeId); // getMockSchemeById will re-derive status using getSchemeStatus
};


export const recordNextDuePaymentsForCustomer = (
  customerName: string,
  paymentDetails: { paymentDate: string; modeOfPayment: PaymentMode[] }
): {
  totalRecordedAmount: number;
  paymentsRecordedCount: number;
  recordedPaymentsInfo: Array<{ schemeId: string; monthNumber: number; amount: number }>;
} => {
  let totalRecordedAmount = 0;
  let paymentsRecordedCount = 0;
  const recordedPaymentsInfo: Array<{ schemeId: string; monthNumber: number; amount: number }> = [];

  const customerSchemesIndices = MOCK_SCHEMES
    .map((scheme, index) => ({ scheme, index }))
    .filter(({ scheme }) => scheme.customerName === customerName && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid'); // Filter out Closed and Fully Paid
    
  customerSchemesIndices.forEach(({ scheme }) => { 
      let nextRecordablePaymentIndex = -1;
      for (let i = 0; i < scheme.payments.length; i++) {
        const currentPayment = scheme.payments[i];
        if (getPaymentStatus(currentPayment, scheme.startDate) !== 'Paid') {
          let allPreviousPaid = true;
          for (let j = 0; j < i; j++) {
            if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') {
              allPreviousPaid = false;
              break;
            }
          }
          if (allPreviousPaid) {
            nextRecordablePaymentIndex = i;
            break;
          }
        }
      }

      if (nextRecordablePaymentIndex !== -1) {
        const paymentToRecord = scheme.payments[nextRecordablePaymentIndex];
        const updatedScheme = updateMockSchemePayment(scheme.id, paymentToRecord.id, {
          amountPaid: paymentToRecord.amountExpected,
          paymentDate: paymentDetails.paymentDate,
          modeOfPayment: paymentDetails.modeOfPayment,
        });
        if (updatedScheme) { 
            totalRecordedAmount += paymentToRecord.amountExpected;
            paymentsRecordedCount++;
            recordedPaymentsInfo.push({
            schemeId: scheme.id,
            monthNumber: paymentToRecord.monthNumber,
            amount: paymentToRecord.amountExpected,
            });
        }
      }
  });
  return { totalRecordedAmount, paymentsRecordedCount, recordedPaymentsInfo };
};


export const recordNextDuePaymentsForCustomerGroup = (
  groupName: string,
  paymentDetails: { paymentDate: string; modeOfPayment: PaymentMode[]; schemeIdsToRecord?: string[] }
): {
  totalRecordedAmount: number;
  paymentsRecordedCount: number;
  recordedPaymentsInfo: Array<{ schemeId: string; customerName: string; monthNumber: number; amount: number }>;
} => {
  let totalRecordedAmount = 0;
  let paymentsRecordedCount = 0;
  const recordedPaymentsInfo: Array<{ schemeId: string; customerName: string; monthNumber: number; amount: number }> = [];

  const schemesInGroupIndices = MOCK_SCHEMES
    .map((scheme, index) => ({ scheme, index })) 
    .filter(({ scheme }) => scheme.customerGroupName === groupName && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid'); // Filter out Closed and Fully Paid

  schemesInGroupIndices.forEach(({ scheme }) => { 
      if (paymentDetails.schemeIdsToRecord && paymentDetails.schemeIdsToRecord.length > 0 && !paymentDetails.schemeIdsToRecord.includes(scheme.id)) {
        return; 
      }

      let nextRecordablePaymentIndex = -1;
      for (let i = 0; i < scheme.payments.length; i++) {
        const currentPayment = scheme.payments[i];
        if (getPaymentStatus(currentPayment, scheme.startDate) !== 'Paid') {
          let allPreviousPaid = true;
          for (let j = 0; j < i; j++) {
            if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') {
              allPreviousPaid = false;
              break;
            }
          }
          if (allPreviousPaid) {
            nextRecordablePaymentIndex = i;
            break;
          }
        }
      }

      if (nextRecordablePaymentIndex !== -1) {
        const paymentToRecord = scheme.payments[nextRecordablePaymentIndex];
        const updatedScheme = updateMockSchemePayment(scheme.id, paymentToRecord.id, { 
          amountPaid: paymentToRecord.amountExpected,
          paymentDate: paymentDetails.paymentDate,
          modeOfPayment: paymentDetails.modeOfPayment,
        });

        if (updatedScheme) { 
          totalRecordedAmount += paymentToRecord.amountExpected;
          paymentsRecordedCount++;
          recordedPaymentsInfo.push({
            schemeId: scheme.id,
            customerName: scheme.customerName,
            monthNumber: paymentToRecord.monthNumber,
            amount: paymentToRecord.amountExpected,
          });
        }
      }
  });
  return { totalRecordedAmount, paymentsRecordedCount, recordedPaymentsInfo };
};

export const getGroupDetails = (): GroupDetail[] => {
  // Ensure MOCK_GROUPS is initialized if it hasn't been (e.g., during hot module replacement or direct calls)
  if (MOCK_GROUPS.length === 0 && MOCK_SCHEMES.length > 0) {
    initializeMockGroups();
  }

  const nonArchivedGroupNames = MOCK_GROUPS
    .filter(g => !g.isArchived)
    .map(g => g.groupName);

  const currentSchemes = getMockSchemes(); // Gets non-archived schemes by default
  const groupsMap = new Map<string, { schemes: Scheme[]; customerNames: Set<string>; recordableSchemeCount: number }>();

  // Initialize map with non-archived groups to ensure they appear even if they have no schemes currently
  nonArchivedGroupNames.forEach(groupName => {
    groupsMap.set(groupName, { schemes: [], customerNames: new Set(), recordableSchemeCount: 0 });
  });

  currentSchemes.forEach(scheme => {
    // Only process schemes that belong to a non-archived group
    if (scheme.customerGroupName && nonArchivedGroupNames.includes(scheme.customerGroupName)) {
      const groupEntry = groupsMap.get(scheme.customerGroupName)!; // Should exist due to pre-initialization
      groupEntry.schemes.push(scheme);
      groupEntry.customerNames.add(scheme.customerName);

      let hasRecordablePaymentForThisScheme = false;
      if (scheme.status !== 'Closed' && scheme.status !== 'Completed' && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
        for (let i = 0; i < scheme.payments.length; i++) {
          const payment = scheme.payments[i];
          if (getPaymentStatus(payment, scheme.startDate) !== 'Paid') {
            let allPreviousPaid = true;
            for (let j = 0; j < i; j++) {
              if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') {
                allPreviousPaid = false;
                break;
              }
            }
            if (allPreviousPaid) {
              hasRecordablePaymentForThisScheme = true;
              break;
            }
          }
        }
      }
      if (hasRecordablePaymentForThisScheme) {
        groupEntry.recordableSchemeCount++;
      }
      // groupsMap.set(scheme.customerGroupName, groupEntry); // Not needed as we are modifying the entry directly
    }
  });

  return Array.from(groupsMap.entries()).map(([groupName, data]) => ({
    groupName,
    schemes: data.schemes,
    customerNames: Array.from(data.customerNames).sort(),
    totalSchemesInGroup: data.schemes.length,
    recordableSchemeCount: data.recordableSchemeCount,
  })).sort((a, b) => a.groupName.localeCompare(b.groupName));
};


export const getUniqueGroupNames = (): string[] => {
  // Ensure MOCK_GROUPS is initialized
  if (MOCK_GROUPS.length === 0 && MOCK_SCHEMES.length > 0) {
    initializeMockGroups();
  }
  return MOCK_GROUPS.filter(g => !g.isArchived)
                    .map(g => g.groupName)
                    .sort((a, b) => a.localeCompare(b));
};

export const updateSchemeGroup = (schemeId: string, newGroupName?: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  MOCK_SCHEMES[schemeIndex].customerGroupName = newGroupName ? newGroupName.trim() : undefined;
  
  return getMockSchemeById(schemeId);
};

export const trashScheme = (schemeId: string): boolean => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) {
    return false; // Scheme not found
  }

  // Check if the scheme is already trashed
  if (MOCK_SCHEMES[schemeIndex].isTrashed) {
    return true; // Already trashed, consider it a success
  }

  MOCK_SCHEMES[schemeIndex].isTrashed = true;
  // Optionally, update other properties like status or archivedDate if needed
  // For example, if trashing implies archiving:
  // MOCK_SCHEMES[schemeIndex].status = 'Archived';
  // MOCK_SCHEMES[schemeIndex].archivedDate = formatISO(new Date());

  // If totals or status need recalculation based on isTrashed, ensure that happens.
  // For now, just setting the flag. If getMockSchemeById or other functions
  // need to be aware of isTrashed, they would need updates.
  // const totals = calculateSchemeTotals(MOCK_SCHEMES[schemeIndex]);
  // MOCK_SCHEMES[schemeIndex] = { ...MOCK_SCHEMES[schemeIndex], ...totals };


  // It's important to consider if getMockSchemeById should reflect this change immediately
  // or if isTrashed is handled by a separate flow (e.g. getTrashedSchemes).
  // For now, directly mutating MOCK_SCHEMES is the core requirement.
  return true; // Scheme found and updated
};

interface SchemeClosureImportRow {
  SchemeID: string;
  MarkAsClosed?: 'TRUE' | 'FALSE' | ''; 
  ClosureDate?: string; 
}

export const importSchemeClosureUpdates = (data: SchemeClosureImportRow[]): { successCount: number; errorCount: number; messages: string[] } => {
  let successCount = 0;
  let errorCount = 0;
  const messages: string[] = [];

  data.forEach((row, index) => {
    const schemeId = row.SchemeID?.trim();
    if (!schemeId) {
      messages.push(`Row ${index + 2}: Missing SchemeID. Skipping.`);
      errorCount++;
      return;
    }

    const scheme = getMockSchemeById(schemeId); 
    if (!scheme) {
      messages.push(`Row ${index + 2}: SchemeID "${schemeId.toUpperCase()}" not found. Skipping.`);
      errorCount++;
      return;
    }
    
    let changed = false;

    if (row.MarkAsClosed?.toUpperCase() === 'TRUE' && scheme.status !== 'Closed') {
        const closureDateForUpdate = row.ClosureDate ? parseISO(row.ClosureDate.trim()).toISOString() : formatISO(startOfDay(new Date()));
        
        const updatedScheme = closeMockScheme(scheme.id, {
            closureDate: closureDateForUpdate,
            type: 'full_reconciliation', 
            modeOfPayment: ['System Closure'] 
        });
        if (updatedScheme && updatedScheme.status === 'Closed') {
            changed = true;
            messages.push(`Row ${index + 2}: Scheme "${schemeId.toUpperCase()}" for ${scheme.customerName} marked as Closed on ${formatDate(updatedScheme.closureDate!)} (Full Reconciliation).`);
        } else {
            messages.push(`Row ${index + 2}: Error closing scheme "${schemeId.toUpperCase()}". It might already be closed or an issue occurred.`);
            errorCount++; 
            return; 
        }
    } else if (row.MarkAsClosed?.toUpperCase() === 'TRUE' && scheme.status === 'Closed') {
         messages.push(`Row ${index + 2}: Scheme "${schemeId.toUpperCase()}" for ${scheme.customerName} was already closed. Closure date updated if provided and different.`);
         if (row.ClosureDate) {
            const newClosureDateISO = parseISO(row.ClosureDate.trim()).toISOString();
            const schemeToUpdate = MOCK_SCHEMES.find(s => s.id === schemeId); 
            if (schemeToUpdate && schemeToUpdate.closureDate !== newClosureDateISO) {
                schemeToUpdate.closureDate = newClosureDateISO;
                // If system closure payments were made, update their date too
                schemeToUpdate.payments.forEach(p => {
                    if(p.modeOfPayment?.includes('System Closure') && p.paymentDate === schemeToUpdate.closureDate) { 
                        p.paymentDate = newClosureDateISO;
                    }
                });
                changed = true; 
            }
         }
    } else if (row.MarkAsClosed?.toUpperCase() === 'FALSE' && scheme.status === 'Closed') {
      const reopenedScheme = reopenMockScheme(schemeId);
      if (reopenedScheme && reopenedScheme.status !== 'Closed') {
        changed = true;
        messages.push(`Row ${index + 2}: Scheme "${schemeId.toUpperCase()}" for ${scheme.customerName} has been Reopened.`);
      } else {
        messages.push(`Row ${index + 2}: Error reopening scheme "${schemeId.toUpperCase()}". It might not have been closed or an issue occurred.`);
        errorCount++;
        return;
      }
    } else {
       messages.push(`Row ${index + 2}: No action taken for SchemeID "${schemeId.toUpperCase()}" (MarkAsClosed was not TRUE or FALSE, or scheme status did not permit action).`);
    }

    if (changed) {
      successCount++;
    }
  });

  return { successCount, errorCount, messages };
};

export const updateMockCustomerDetails = (
  originalCustomerName: string,
  newDetails: { customerName: string; customerPhone?: string; customerAddress?: string }
): { success: boolean; message?: string; updatedSchemes?: Scheme[] } => {
  
  if (newDetails.customerName.trim() === "") {
    return { success: false, message: "New customer name cannot be empty." };
  }

  const trimmedNewName = newDetails.customerName.trim();
  if (trimmedNewName.toLowerCase() !== originalCustomerName.trim().toLowerCase()) {
    const nameExists = MOCK_SCHEMES.some(
      (s) => s.customerName.trim().toLowerCase() === trimmedNewName.toLowerCase()
    );
    if (nameExists) {
      return { success: false, message: `Customer name "${trimmedNewName}" already exists.` };
    }
  }
  
  let customerFoundAndUpdated = false;
  MOCK_SCHEMES.forEach((scheme) => {
    if (scheme.customerName === originalCustomerName) {
      scheme.customerName = trimmedNewName;
      scheme.customerPhone = newDetails.customerPhone !== undefined ? newDetails.customerPhone : scheme.customerPhone;
      scheme.customerAddress = newDetails.customerAddress !== undefined ? newDetails.customerAddress : scheme.customerAddress;
      customerFoundAndUpdated = true;
    }
  });

  if (customerFoundAndUpdated) {
    const updatedSchemesForCustomer = getMockSchemes().filter(s => s.customerName === trimmedNewName);
    return { success: true, updatedSchemes: updatedSchemesForCustomer };
  }
  return { success: false, message: "Original customer name not found." }; 
};

export const reopenMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const formerClosureDate = scheme.closureDate;
  scheme.closureDate = undefined; 

  if (formerClosureDate) {
    scheme.payments.forEach(p => {
      if (p.paymentDate === formerClosureDate && p.modeOfPayment?.includes('System Closure')) {
        p.amountPaid = undefined;
        p.paymentDate = undefined;
        p.modeOfPayment = undefined;
        // Re-evaluate this specific payment's status immediately
        p.status = getPaymentStatus(p, scheme.startDate); 
      }
    });
  }
  
  // Re-evaluate all payment statuses and then the scheme status
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme); // This will now set to Active, Overdue, or Completed based on actuals

  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); 
};

export const deleteFullMockScheme = (schemeId: string): boolean => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);

  if (schemeIndex === -1) {
    // Scheme not found
    return false;
  }

  const schemeToDelete = MOCK_SCHEMES[schemeIndex];

  // Ensure status is calculated based on the most up-to-date payment info before checking
  // This requires a temporary recalculation if the global MOCK_SCHEMES might not be perfectly up-to-date
  // For simplicity here, we assume the status on schemeToDelete is sufficiently current
  // or that getMockSchemeById could be used if deeper refresh is needed:
  // const currentSchemeState = getMockSchemeById(schemeId); // This would be more robust
  // if (currentSchemeState && currentSchemeState.status !== 'Closed' && currentSchemeState.status !== 'Archived') { ... }

  if (schemeToDelete.status !== 'Closed' && schemeToDelete.status !== 'Archived') {
    console.warn(`Scheme ${schemeId} cannot be fully deleted as its status is '${schemeToDelete.status}'. It must be 'Closed' or 'Archived'.`);
    return false; // Indicate deletion was prevented
  }

  // If status is 'Closed' or 'Archived', proceed with deletion
  MOCK_SCHEMES.splice(schemeIndex, 1);
  return true; // Indicate successful deletion
};

// Note for getSchemeStatus in utils.ts:
// It should ideally check: if (scheme.status === 'Archived') return 'Archived'; at the beginning.
// This was partially handled in getMockSchemes by preserving 'Archived' status before calling getSchemeStatus.

export const updateMockGroupName = (oldGroupName: string, newGroupName: string): { success: boolean; message?: string } => {
  const trimmedNewGroupName = newGroupName.trim();
  if (!trimmedNewGroupName) {
    return { success: false, message: "New group name cannot be empty." };
  }

  if (oldGroupName === trimmedNewGroupName) {
    return { success: true, message: "Group name is already set to this value." }; // No change needed
  }

  // Ensure MOCK_GROUPS is initialized
  if (MOCK_GROUPS.length === 0 && MOCK_SCHEMES.length > 0) {
    initializeMockGroups();
  }

  const oldGroupIndex = MOCK_GROUPS.findIndex(g => g.groupName === oldGroupName);
  if (oldGroupIndex === -1) {
    // This case should ideally not happen if oldGroupName comes from a valid source (non-archived group)
    // However, if a group was somehow deleted/archived externally or old name is arbitrary.
    // For now, let's assume oldGroupName must exist as a non-archived group to be renamed.
    const oldGroupIsArchived = MOCK_GROUPS.some(g => g.groupName === oldGroupName && g.isArchived);
    if (oldGroupIsArchived) {
         return { success: false, message: `Cannot rename "${oldGroupName}" as it is an archived group.` };
    }
    return { success: false, message: `Old group name "${oldGroupName}" not found or is not an active group.` };
  }

  if (MOCK_GROUPS[oldGroupIndex].isArchived) {
    // This check is redundant if oldGroupName is always sourced from non-archived groups, but good for safety.
    return { success: false, message: `Archived group "${oldGroupName}" cannot be renamed.` };
  }

  const newGroupNameExistsAsActive = MOCK_GROUPS.some(g => g.groupName === trimmedNewGroupName && !g.isArchived);
  if (newGroupNameExistsAsActive) {
    return { success: false, message: `An active group named "${trimmedNewGroupName}" already exists. Please choose a different name.` };
  }

  const newGroupNameExistsAsArchived = MOCK_GROUPS.some(g => g.groupName === trimmedNewGroupName && g.isArchived);
  if (newGroupNameExistsAsArchived) {
     return { success: false, message: `A group named "${trimmedNewGroupName}" already exists in the archive. Please permanently delete or restore it first.` };
  }

  // Update in MOCK_GROUPS
  MOCK_GROUPS[oldGroupIndex].groupName = trimmedNewGroupName;

  // Update in MOCK_SCHEMES
  let schemesUpdatedCount = 0;
  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.customerGroupName === oldGroupName) {
      scheme.customerGroupName = trimmedNewGroupName;
      schemesUpdatedCount++;
    }
  });

  return { success: true, message: `Group "${oldGroupName}" renamed to "${trimmedNewGroupName}". ${schemesUpdatedCount} schemes updated.` };
};

// Archives a group by marking it as archived in MOCK_GROUPS
export const deleteMockGroup = (groupName: string): boolean => {
  const groupIndex = MOCK_GROUPS.findIndex(g => g.groupName === groupName);
  if (groupIndex !== -1) {
    if (MOCK_GROUPS[groupIndex].isArchived) {
      // console.warn(`Group "${groupName}" is already archived.`);
      return false; // Or true, depending on desired idempotency behavior
    }
    MOCK_GROUPS[groupIndex].isArchived = true;
    MOCK_GROUPS[groupIndex].archivedDate = formatISO(new Date());
    // console.log(`Group "${groupName}" archived successfully.`);
    return true;
  }
  // console.warn(`Group "${groupName}" not found for archiving.`);
  return false;
};

export const getArchivedGroups = (): MockGroup[] => {
  return JSON.parse(JSON.stringify(MOCK_GROUPS.filter(g => g.isArchived)));
};

export const unarchiveMockGroup = (groupName: string): MockGroup | undefined => {
  const groupIndex = MOCK_GROUPS.findIndex(g => g.groupName === groupName);
  if (groupIndex !== -1 && MOCK_GROUPS[groupIndex].isArchived) {
    MOCK_GROUPS[groupIndex].isArchived = false;
    MOCK_GROUPS[groupIndex].archivedDate = undefined;
    // console.log(`Group "${groupName}" unarchived successfully.`);
    return JSON.parse(JSON.stringify(MOCK_GROUPS[groupIndex]));
  }
  // console.warn(`Group "${groupName}" not found or not archived.`);
  return undefined;
};

export const deleteFullMockGroup = (groupName: string): boolean => {
  const groupIndex = MOCK_GROUPS.findIndex(g => g.groupName === groupName);
  if (groupIndex !== -1) {
    // For safety, ensure it's an archived group, though not strictly necessary by plan
    // if (!MOCK_GROUPS[groupIndex].isArchived) {
    //   console.warn(`Group "${groupName}" is not archived. Archive it first before full deletion.`);
    //   return false;
    // }

    MOCK_GROUPS.splice(groupIndex, 1); // Remove group from MOCK_GROUPS

    // Remove group association from schemes
    let schemesChanged = false;
    MOCK_SCHEMES.forEach(scheme => {
      if (scheme.customerGroupName === groupName) {
        scheme.customerGroupName = undefined;
        schemesChanged = true;
      }
    });
    // if (schemesChanged) console.log(`Schemes updated for deleted group "${groupName}".`);
    // console.log(`Group "${groupName}" permanently deleted.`);
    return true;
  }
  // console.warn(`Group "${groupName}" not found for full deletion.`);
  return false;
};

// --- Payment Archival Functions ---

export type ArchivedPaymentAugmented = Payment & {
  schemeId: string;
  customerName: string;
  schemeStatus?: SchemeStatus
};

export const getArchivedPaymentsForAllSchemes = (): ArchivedPaymentAugmented[] => {
  const archivedPayments: ArchivedPaymentAugmented[] = [];
  // Use a fresh call to getMockSchemes to ensure up-to-date scheme details, including status
  const currentSchemes = getMockSchemes({ includeArchived: true });

  currentSchemes.forEach(scheme => {
    scheme.payments.forEach(payment => {
      if (payment.isArchived) {
        archivedPayments.push({
          ...payment,
          schemeId: scheme.id, // Augment with schemeId
          customerName: scheme.customerName, // Augment with customerName
          schemeStatus: scheme.status, // Augment with schemeStatus
        });
      }
    });
  });
  return JSON.parse(JSON.stringify(archivedPayments));
};

export const unarchiveMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);

  if (paymentIndex === -1 || !scheme.payments[paymentIndex].isArchived) {
    // console.warn(`Payment ${paymentId} in scheme ${schemeId} not found or not archived.`);
    return undefined; // Or return scheme as is
  }

  scheme.payments[paymentIndex].isArchived = false;
  scheme.payments[paymentIndex].archivedDate = undefined;

  // Recalculate scheme status and totals
  scheme.payments.forEach(p => {
    // Re-evaluate status for the unarchived payment too
    p.status = getPaymentStatus(p, scheme.startDate);
  });
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId);
};

export const deleteFullMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const initialPaymentCount = scheme.payments.length;
  scheme.payments = scheme.payments.filter(p => p.id !== paymentId);

  if (scheme.payments.length === initialPaymentCount) {
    // console.warn(`Payment ${paymentId} not found in scheme ${schemeId} for full deletion.`);
    return undefined; // Or return scheme as is if no change
  }

  // Recalculate scheme status and totals
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId);
};
