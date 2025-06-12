
import type { Scheme, Payment, PaymentMode, GroupDetail, SchemeStatus } from '@/types/scheme';
import { generatePaymentsForScheme, getSchemeStatus, calculateSchemeTotals, calculateDueDate, getPaymentStatus } from '@/lib/utils'; // Removed generateId from utils
import { subMonths, addMonths, formatISO, parseISO, startOfDay } from 'date-fns';

let nextNumericSchemeId = 1;
const generateUniqueNumericId = (): number => {
  // This is a simple sequential ID for mock data.
  // In a real app, IDs would come from a database.
  // To make it somewhat unique even if schemes are deleted, find max current ID.
  if (MOCK_SCHEMES && MOCK_SCHEMES.length > 0) {
    const maxId = MOCK_SCHEMES.reduce((max, s) => (s.id > max ? s.id : max), 0);
    nextNumericSchemeId = maxId + 1;
  } else {
    nextNumericSchemeId = 1; // Start from 1 if no schemes
  }
  return nextNumericSchemeId++;
};

const createScheme = (
  id: number, // Expect numeric ID
  customerName: string, 
  startDate: Date, 
  monthlyPaymentAmount: number,
  customerGroupName?: string,
  customerPhone?: string,
  customerAddress?: string
): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status' | 'closureDate'> = {
    id: id, // Use provided numeric ID
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
  // Assign initial numeric IDs sequentially for simplicity during mock data setup
  createScheme(1, 'Alice Wonderland', subMonths(new Date(), 4), 1000, "Smith Family", "9876543210", "123 Wonderland Lane, Fantasy City"),
  createScheme(2, 'Active Customer', subMonths(new Date(), 4), 1000, "Smith Family", "8765432109", "456 Active Rd, Live Town"),
  createScheme(3, 'Active Customer', subMonths(new Date(), 1), 500, "Smith Family", "8765432109", "456 Active Rd, Live Town"),
  createScheme(4, 'Bob The Builder', subMonths(new Date(), 2), 800, "Smith Family", "7654321098", "789 Construction Ave, Buildville"),
  createScheme(5, 'Charlie Brown', addMonths(new Date(), 1), 1500, "Office Buddies", "6543210987", "1 Peanuts St, Cartoonville"),
  createScheme(6, 'Diana Prince', subMonths(new Date(), 5), 500, "Smith Family", "5432109876", "Themyscira Island, Paradise"),
  createScheme(7, 'Edward Scissorhands', subMonths(new Date(), 13), 2000, "Solo Ventures", "4321098765", "Gothic Mansion, Suburbia"),
  createScheme(8, 'Fiona Gallagher', subMonths(new Date(), 11), 750, "Office Buddies", "3210987654", "South Side, Chicago"),
  createScheme(9, 'George Jetson', subMonths(new Date(), 3), 1200, undefined, "2109876543", "Orbit City, Skypad Apartments"),
  createScheme(10, 'Hannah Montana', subMonths(new Date(), 1), 600, undefined, "1098765432", "Malibu, CA"),
  createScheme(11, 'Iris West', subMonths(new Date(), 6), 900, "Smith Family", "0987654321", "Central City Apt"),
];
// Initialize nextNumericSchemeId after MOCK_SCHEMES is populated
// This should be done after MOCK_SCHEMES is fully defined.
// For now, generateUniqueNumericId() will handle finding max ID dynamically if MOCK_SCHEMES is populated.


const fionaSchemeIdx = MOCK_SCHEMES.findIndex(s => s.customerName === 'Fiona Gallagher');
if (fionaSchemeIdx !== -1) {
  // Ensure Fiona's scheme is fully paid to become 'Fully Paid'
  MOCK_SCHEMES[fionaSchemeIdx].payments = MOCK_SCHEMES[fionaSchemeIdx].payments.map((p, index) => {
    // Pay all 12 installments for Fiona
    if (index < MOCK_SCHEMES[fionaSchemeIdx].durationMonths) {
      return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
    }
    return p;
  });
  // Ensure closureDate is NOT set for Fiona, so it's purely 'Fully Paid'
  MOCK_SCHEMES[fionaSchemeIdx].closureDate = undefined;

  MOCK_SCHEMES[fionaSchemeIdx].payments.forEach(p => p.status = getPaymentStatus(p, MOCK_SCHEMES[fionaSchemeIdx].startDate));
  MOCK_SCHEMES[fionaSchemeIdx].status = getSchemeStatus(MOCK_SCHEMES[fionaSchemeIdx]); // This should correctly set to 'Fully Paid'
  const totals = calculateSchemeTotals(MOCK_SCHEMES[fionaSchemeIdx]);
  MOCK_SCHEMES[fionaSchemeIdx] = { ...MOCK_SCHEMES[fionaSchemeIdx], ...totals };
}


export const getMockSchemes = (options?: { includeArchived?: boolean; includeDeleted?: boolean }): Scheme[] => {
  const includeArchived = options?.includeArchived || false;
  const includeDeleted = options?.includeDeleted || false;
  let schemesToProcess = MOCK_SCHEMES;

  if (!includeArchived) {
    // Filter out schemes marked with the new isArchived flag
    schemesToProcess = schemesToProcess.filter(s => !s.isArchived);
  }
  // Keep the old filter for s.status === 'Archived' for now for backward compatibility during transition,
  // but ideally, it should be removed once everything uses isArchived.
  // For now, if !includeArchived, we also remove those still marked by status.
  if (!includeArchived) {
     schemesToProcess = schemesToProcess.filter(s => s.status !== 'Archived');
  }

  if (!includeDeleted) {
    schemesToProcess = schemesToProcess.filter(s => !s.deletedDate);
  }

  return JSON.parse(JSON.stringify(schemesToProcess.map(s => {
    const tempScheme = JSON.parse(JSON.stringify(s));
    // Ensure payments exist before trying to iterate
    // Also, filter out soft-deleted payments before processing
    if (tempScheme.payments && Array.isArray(tempScheme.payments)) {
      tempScheme.payments = tempScheme.payments.filter((p: Payment) => !p.deletedDate);
      tempScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, tempScheme.startDate));
    } else {
      tempScheme.payments = []; // Initialize if undefined or not an array
    }

    // Recalculate status based on payments, unless it's manually set to 'Closed' or other terminal statuses.
    // The isArchived flag is separate and doesn't affect the scheme's inherent status (like 'Fully Paid', 'Closed').
    const status = getSchemeStatus(tempScheme); // getSchemeStatus should rely on payments and closureDate primarily.
    const totals = calculateSchemeTotals(tempScheme);
    return { ...tempScheme, ...totals, status, isArchived: s.isArchived, archivedDate: s.archivedDate }; // Persist archive flags
  })));
};

// Returns schemes explicitly marked with isArchived = true and not soft-deleted
export const getArchivedSchemes = (): Scheme[] => {
  const allSchemes = getMockSchemes({ includeArchived: true, includeDeleted: true }); // Get all schemes
  return allSchemes.filter(s => s.isArchived === true && !s.deletedDate);
};

// Renaming old archiveMockScheme to archiveScheme and use new logic
export const archiveScheme = (schemeId: number, archiveDate?: string): Scheme | undefined => { // schemeId is number
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];

  // Allow archiving of 'Fully Paid' or 'Closed' schemes that are not already archived and not soft-deleted
  if ((scheme.status === 'Fully Paid' || scheme.status === 'Closed') && !scheme.isArchived && !scheme.deletedDate) {
    scheme.isArchived = true;
    scheme.archivedDate = archiveDate || formatISO(new Date());
    // Note: scheme.status remains its original status ('Fully Paid' or 'Closed')
    MOCK_SCHEMES[schemeIndex] = { ...scheme };
    return getMockSchemeById(schemeId, { includeArchived: true, includeDeleted: true });
  }
  console.warn(`Scheme ${schemeId} not eligible for archiving. Status: ${scheme.status}, Archived: ${scheme.isArchived}, Deleted: ${scheme.deletedDate}`);
  return undefined;
};

// Renaming old unarchiveMockScheme to unarchiveScheme and use new logic
export const unarchiveScheme = (schemeId: number): Scheme | undefined => { // schemeId is number
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  if (scheme.isArchived) {
    scheme.isArchived = false;
    scheme.archivedDate = undefined;
    // Scheme status remains what it was. getSchemeStatus will re-evaluate if needed when scheme is fetched.
    MOCK_SCHEMES[schemeIndex] = { ...scheme };
    // Recalculate scheme status and totals upon unarchiving
    const freshScheme = getMockSchemeById(schemeId); // This will re-calculate everything
    if(freshScheme) MOCK_SCHEMES[schemeIndex] = JSON.parse(JSON.stringify(freshScheme)); // Update main array with recalculated
    return freshScheme;
  }
  return undefined;
};

export const updateSchemeArchiveDate = (schemeId: number, newArchiveDate: string): Scheme | undefined => { // schemeId is number
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  if (scheme.isArchived) {
    try {
        const parsedDate = parseISO(newArchiveDate);
        if (!isValidDate(parsedDate)) {
            console.warn(`Invalid date provided for updateSchemeArchiveDate: ${newArchiveDate}`);
            return undefined;
        }
        scheme.archivedDate = formatISO(parsedDate);
        MOCK_SCHEMES[schemeIndex] = { ...scheme };
        return getMockSchemeById(schemeId, { includeArchived: true, includeDeleted: true });
    } catch (error) {
        console.error(`Error parsing date in updateSchemeArchiveDate: ${error}`);
        return undefined;
    }
  }
  return undefined; // Scheme not archived
};

export const getMockSchemeById = (id: number, options?: { includeDeleted?: boolean; includeArchived?: boolean }): Scheme | undefined => {
  const includeDeleted = options?.includeDeleted || false;
  const includeArchived = options?.includeArchived || false;
  const schemeFromGlobalArray = MOCK_SCHEMES.find(s => s.id === id);

  if (!schemeFromGlobalArray) return undefined;
  if (!includeDeleted && schemeFromGlobalArray.deletedDate) return undefined;
  if (!includeArchived && schemeFromGlobalArray.isArchived) return undefined; // New check for isArchived
  
  const clonedScheme: Scheme = JSON.parse(JSON.stringify(schemeFromGlobalArray));

  // Filter out soft-deleted payments before further processing
  if (clonedScheme.payments && Array.isArray(clonedScheme.payments)) {
    clonedScheme.payments = clonedScheme.payments.filter((p: Payment) => !p.deletedDate);
  }

  clonedScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, clonedScheme.startDate));
  clonedScheme.status = getSchemeStatus(clonedScheme);
  
  const totals = calculateSchemeTotals(clonedScheme);
  return { ...clonedScheme, ...totals };
};

export const addMockScheme = (newSchemeData: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths' | 'closureDate'> & { customerGroupName?: string } ): Scheme => {
  const newId = generateUniqueNumericId(); // Use the new numeric ID generator
  const baseScheme: Omit<Scheme, 'payments' | 'status' | 'closureDate'> = {
    id: newId, // Assign numeric ID
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

export const updateMockSchemePayment = (schemeId: number, paymentId: string, paymentDetails: UpdatePaymentPayload): Scheme | undefined => {
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

export const editMockPaymentDetails = (schemeId: number, paymentId: string, details: { amountPaid?: number; paymentDate?: string; modeOfPayment?: PaymentMode[] }): Scheme | undefined => {
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

export const deleteMockPayment = (schemeId: number, paymentId: string): Scheme | undefined => {
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

  // Soft delete the payment
  scheme.payments[paymentIndex].deletedDate = formatISO(new Date());
  // Clear payment details that indicate it was made, but keep amountExpected for historical context if needed
  scheme.payments[paymentIndex].amountPaid = undefined;
  scheme.payments[paymentIndex].paymentDate = undefined;
  // scheme.payments[paymentIndex].modeOfPayment = undefined; // Keep mode for potential restoration context? Or clear? Let's clear.
  scheme.payments[paymentIndex].modeOfPayment = undefined;


  // Recalculate scheme status and totals
  // Ensure that getPaymentStatus and calculateSchemeTotals in utils.ts correctly handle deletedDate on payments
  const tempSchemeForRecalc: Scheme = JSON.parse(JSON.stringify(scheme));
  if (tempSchemeForRecalc.payments && Array.isArray(tempSchemeForRecalc.payments)) {
    tempSchemeForRecalc.payments = tempSchemeForRecalc.payments.filter(p => !p.deletedDate);
  }
  tempSchemeForRecalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForRecalc.startDate));
  scheme.status = getSchemeStatus(tempSchemeForRecalc);
  
  const totals = calculateSchemeTotals(tempSchemeForRecalc); // Pass the version with deleted payments filtered out
  MOCK_SCHEMES[schemeIndex] = { ...scheme, payments: scheme.payments, status: scheme.status, ...totals }; // Ensure original payments array (with soft delete) is saved

  return getMockSchemeById(schemeId); // This will also filter deleted payments for the returned object by default
};

export const permanentlyDeleteMockPayment = (schemeId: number, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const initialPaymentCount = scheme.payments.length;
  scheme.payments = scheme.payments.filter(p => p.id !== paymentId);

  if (scheme.payments.length < initialPaymentCount) {
    // Recalculate scheme status and totals
    const tempSchemeForRecalc: Scheme = JSON.parse(JSON.stringify(scheme));
     if (tempSchemeForRecalc.payments && Array.isArray(tempSchemeForRecalc.payments)) {
      tempSchemeForRecalc.payments = tempSchemeForRecalc.payments.filter(p => !p.deletedDate); // ensure this is still respected
    }
    tempSchemeForRecalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForRecalc.startDate));
    scheme.status = getSchemeStatus(tempSchemeForRecalc);
    const totals = calculateSchemeTotals(tempSchemeForRecalc);
    MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
    return getMockSchemeById(schemeId);
  }
  return undefined; // Payment not found or not deleted
};

export const restoreMockPayment = (schemeId: number, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1 || !scheme.payments[paymentIndex].deletedDate) return undefined; // Not found or not soft-deleted

  scheme.payments[paymentIndex].deletedDate = undefined;
  // Payment status will be re-evaluated by getPaymentStatus when scheme is loaded/processed
  // Recalculate scheme status and totals
  const tempSchemeForRecalc: Scheme = JSON.parse(JSON.stringify(scheme));
  if (tempSchemeForRecalc.payments && Array.isArray(tempSchemeForRecalc.payments)) {
    tempSchemeForRecalc.payments = tempSchemeForRecalc.payments.filter(p => !p.deletedDate);
  }
  tempSchemeForRecalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForRecalc.startDate));
  scheme.status = getSchemeStatus(tempSchemeForRecalc);
  const totals = calculateSchemeTotals(tempSchemeForRecalc);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return getMockSchemeById(schemeId);
};


interface CloseSchemeOptions {
  closureDate: string; 
  type: 'full_reconciliation' | 'partial_closure';
  modeOfPayment?: PaymentMode[]; 
}

export const closeMockScheme = (schemeId: number, options: CloseSchemeOptions): Scheme | undefined => {
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
    // Ensure scheme.id is compared as number if schemeId in filter is number; assuming customerName is primary key here for filtering.
    .filter(({ scheme }) => scheme.customerName === customerName && !scheme.deletedDate && !scheme.isArchived && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid');
    
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
    .filter(({ scheme }) => scheme.customerGroupName === groupName && !scheme.deletedDate && !scheme.isArchived && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid');

  schemesInGroupIndices.forEach(({ scheme }) => { 
      if (paymentDetails.schemeIdsToRecord && paymentDetails.schemeIdsToRecord.length > 0 && !paymentDetails.schemeIdsToRecord.includes(scheme.id.toString())) { // scheme.id is number, schemeIdsToRecord likely string[]
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
  const currentSchemes = getMockSchemes(); 
  const groupsMap = new Map<string, { schemes: Scheme[]; customerNames: Set<string>; recordableSchemeCount: number }>();

  currentSchemes.forEach(scheme => {
    if (scheme.customerGroupName) {
      const groupEntry = groupsMap.get(scheme.customerGroupName) || { schemes: [], customerNames: new Set(), recordableSchemeCount: 0 };
      groupEntry.schemes.push(scheme);
      groupEntry.customerNames.add(scheme.customerName);

      let hasRecordablePaymentForThisScheme = false;
      // Only count recordable if not Closed and not Fully Paid
      if (scheme.status !== 'Closed' && scheme.status !== 'Fully Paid' && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
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
      groupsMap.set(scheme.customerGroupName, groupEntry);
    }
  });

  return Array.from(groupsMap.entries()).map(([groupName, data]) => ({
    groupName,
    schemes: data.schemes, 
    customerNames: Array.from(data.customerNames).sort(),
    totalSchemesInGroup: data.schemes.length,
    recordableSchemeCount: data.recordableSchemeCount,
  })).sort((a,b) => a.groupName.localeCompare(b.groupName));
};


export const getUniqueGroupNames = (): string[] => {
  const groupNames = new Set<string>();
  const currentSchemes = getMockSchemes(); 
  currentSchemes.forEach(scheme => {
    if (scheme.customerGroupName) {
      groupNames.add(scheme.customerGroupName);
    }
  });
  return Array.from(groupNames).sort((a, b) => a.localeCompare(b));
};

export const updateSchemeGroup = (schemeId: string, newGroupName?: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  MOCK_SCHEMES[schemeIndex].customerGroupName = newGroupName ? newGroupName.trim() : undefined;
  
  return getMockSchemeById(schemeId);
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
  const schemeIdStr = row.SchemeID?.trim();
    if (!schemeIdStr) {
      messages.push(`Row ${index + 2}: Missing SchemeID. Skipping.`);
      errorCount++;
      return;
    }
    const schemeIdNum = parseInt(schemeIdStr, 10);
    if (isNaN(schemeIdNum)) {
      messages.push(`Row ${index + 2}: Invalid SchemeID format "${schemeIdStr}". Must be a number. Skipping.`);
      errorCount++;
      return;
    }

    const scheme = getMockSchemeById(schemeIdNum);
    if (!scheme) {
      messages.push(`Row ${index + 2}: SchemeID "${schemeIdNum}" not found. Skipping.`);
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
            messages.push(`Row ${index + 2}: Scheme "${schemeIdNum}" for ${scheme.customerName} marked as Closed on ${formatDate(updatedScheme.closureDate!)} (Full Reconciliation).`);
        } else {
            messages.push(`Row ${index + 2}: Error closing scheme "${schemeIdNum}". It might already be closed or an issue occurred.`);
            errorCount++; 
            return; 
        }
    } else if (row.MarkAsClosed?.toUpperCase() === 'TRUE' && scheme.status === 'Closed') {
         messages.push(`Row ${index + 2}: Scheme "${schemeIdNum}" for ${scheme.customerName} was already closed. Closure date updated if provided and different.`);
         if (row.ClosureDate) {
            const newClosureDateISO = parseISO(row.ClosureDate.trim()).toISOString();
            const schemeToUpdate = MOCK_SCHEMES.find(s => s.id === schemeIdNum);
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
      const reopenedScheme = reopenMockScheme(schemeIdNum);
      if (reopenedScheme && reopenedScheme.status !== 'Closed') {
        changed = true;
        messages.push(`Row ${index + 2}: Scheme "${schemeIdNum}" for ${scheme.customerName} has been Reopened.`);
      } else {
        messages.push(`Row ${index + 2}: Error reopening scheme "${schemeIdNum}". It might not have been closed or an issue occurred.`);
        errorCount++;
        return;
      }
    } else {
       messages.push(`Row ${index + 2}: No action taken for SchemeID "${schemeIdNum}" (MarkAsClosed was not TRUE or FALSE, or scheme status did not permit action).`);
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

export const reopenMockScheme = (schemeId: number): Scheme | undefined => {
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

// Soft delete a scheme
export const deleteMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  MOCK_SCHEMES[schemeIndex].deletedDate = formatISO(new Date());
  // Optionally, update status to something like 'Deleted' or handle in getSchemeStatus
  // For now, just marking deletedDate is enough as getMockSchemes will filter it.
  return getMockSchemeById(schemeId, { includeDeleted: true }); // Return the modified scheme
};

// Permanently delete a scheme
export const permanentlyDeleteMockScheme = (schemeId: string): boolean => {
  const initialLength = MOCK_SCHEMES.length;
  MOCK_SCHEMES = MOCK_SCHEMES.filter(s => s.id !== schemeId);
  return MOCK_SCHEMES.length < initialLength;
};

// Restore a soft-deleted scheme
export const restoreMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1 || !MOCK_SCHEMES[schemeIndex].deletedDate) return undefined;

  MOCK_SCHEMES[schemeIndex].deletedDate = undefined;
  // Re-calculate status and totals as it's being restored
  const restoredScheme = MOCK_SCHEMES[schemeIndex];
  restoredScheme.payments.forEach(p => p.status = getPaymentStatus(p, restoredScheme.startDate));
  restoredScheme.status = getSchemeStatus(restoredScheme);
  const totals = calculateSchemeTotals(restoredScheme);
  MOCK_SCHEMES[schemeIndex] = { ...restoredScheme, ...totals };

  return getMockSchemeById(schemeId);
};


// Note for getSchemeStatus in utils.ts:
// It should ideally check: if (scheme.status === 'Archived') return 'Archived'; at the beginning.
// This was partially handled in getMockSchemes by preserving 'Archived' status before calling getSchemeStatus.

export const getSoftDeletedSchemes = (): Scheme[] => {
  const allSchemesIncludingDeleted = getMockSchemes({ includeArchived: true, includeDeleted: true });
  return allSchemesIncludingDeleted.filter(scheme => !!scheme.deletedDate);
};

export interface SoftDeletedPaymentInfo {
  schemeInfo: Pick<Scheme, 'id' | 'customerName' | 'deletedDate'>; // Include scheme's deletedDate
  payment: Payment;
}

export const getSoftDeletedPayments = (): SoftDeletedPaymentInfo[] => {
  const softDeletedPayments: SoftDeletedPaymentInfo[] = [];
  // Iterate over the raw MOCK_SCHEMES to find all payments, even in deleted schemes
  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.payments && Array.isArray(scheme.payments)) {
      scheme.payments.forEach(payment => {
        if (payment.deletedDate) {
          softDeletedPayments.push({
            schemeInfo: {
              id: scheme.id,
              customerName: scheme.customerName,
              deletedDate: scheme.deletedDate, // Pass along if the parent scheme is also soft-deleted
            },
            payment: JSON.parse(JSON.stringify(payment)), // Return a copy
          });
        }
      });
    }
  });
  return softDeletedPayments.sort((a,b) => parseISO(b.payment.deletedDate!).getTime() - parseISO(a.payment.deletedDate!).getTime());
};


export const updateMockGroupName = (oldGroupName: string, newGroupName: string): boolean => {
  if (!newGroupName || newGroupName.trim() === "") return false;
  let changed = false;
  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.customerGroupName === oldGroupName) {
      scheme.customerGroupName = newGroupName.trim();
      changed = true;
    }
  });
  return changed;
};

export const deleteMockGroup = (groupName: string): boolean => {
  let changed = false;
  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.customerGroupName === groupName) {
      scheme.customerGroupName = undefined;
      changed = true;
    }
  });
  return changed;
};
