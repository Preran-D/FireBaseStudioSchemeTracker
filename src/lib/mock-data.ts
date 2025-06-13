
import type { Scheme, Payment, PaymentMode, GroupDetail, SchemeStatus, ArchivedGroupInfo } from '@/types/scheme';
import { generatePaymentsForScheme, getSchemeStatus, calculateSchemeTotals, calculateDueDate, getPaymentStatus, generateId, formatDate } from '@/lib/utils';
import { subMonths, addMonths, formatISO, parseISO, startOfDay, subDays, isBefore } from 'date-fns'; // Added subDays, isBefore

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
  let schemesToProcess = MOCK_SCHEMES;

  if (!includeArchived) {
    schemesToProcess = MOCK_SCHEMES.filter(s => s.status !== 'Archived');
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

  // If already archived, update the archivedDate. Otherwise, set to archived.
  if (scheme.status !== 'Archived') {
    scheme.status = 'Archived';
    scheme.archivedDate = formatISO(new Date());
  } else {
    // Optionally, update archivedDate even if already archived, as per subtask description
    scheme.archivedDate = formatISO(new Date());
  }

  MOCK_SCHEMES[schemeIndex] = { ...scheme }; // Update the scheme in the main array
  // Return a fresh copy with calculated fields, which also re-evaluates status.
  // getMockSchemeById will ensure the status is 'Archived' if it was set here.
  return getMockSchemeById(schemeId);
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

export const archiveAllSchemesForCustomer = (customerName: string): { archivedCount: number; skippedCount: number; notFound: boolean } => {
  let archivedCount = 0;
  let skippedCount = 0;
  let foundCustomerSchemes = false;

  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.customerName === customerName) {
      foundCustomerSchemes = true;
      // Call archiveMockScheme directly. It will handle if the scheme is already archived or not.
      // archiveMockScheme now archives regardless of status (unless already archived).
      const archivedScheme = archiveMockScheme(scheme.id);
      if (archivedScheme) {
        // Check if the status actually changed to 'Archived' or was already 'Archived' and date updated.
        // For simplicity, we count it as "archived in this operation" if archiveMockScheme returns a scheme.
        // A more nuanced check could compare previous status if needed.
        archivedCount++;
      } else {
        // This implies archiveMockScheme failed to find the scheme, which is unlikely here.
        // Or, if archiveMockScheme were to return undefined for other reasons (e.g., a pre-archive check it might do).
        // Since archiveMockScheme was modified to archive any non-archived scheme,
        // a falsy return here would be unexpected if the scheme exists.
        console.warn(`Failed to process scheme ${scheme.id} for customer ${customerName} during archive all operation.`);
        skippedCount++;
      }
    }
  });

  return {
    archivedCount,
    skippedCount,
    notFound: !foundCustomerSchemes,
  };
};

export const autoArchiveClosedSchemesByGracePeriod = (graceDays: number): { archivedCount: number } => {
  let archivedCount = 0;
  const schemesToConsider = getMockSchemes({ includeArchived: true }); // Consider all, including already archived to avoid processing them again if logic changes
  const thresholdDate = subDays(new Date(), graceDays);

  schemesToConsider.forEach(scheme => {
    if (scheme.status === 'Closed' && scheme.closureDate) {
      try {
        const closureDateTime = parseISO(scheme.closureDate);
        if (isBefore(closureDateTime, thresholdDate)) {
          // Scheme is 'Closed' and its closureDate is older than the grace period
          const archivedScheme = archiveMockScheme(scheme.id); // archiveMockScheme already checks if it's 'Closed'
          if (archivedScheme) {
            console.log(`Auto-archived scheme ${scheme.id} closed on ${scheme.closureDate}`);
            archivedCount++;
          }
        }
      } catch (e) {
        // Log error if closureDate is invalid, though getMockSchemes should provide valid dates
        console.error(`Error parsing closure date for scheme ${scheme.id}: ${scheme.closureDate}`, e);
      }
    }
  });

  return { archivedCount };
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

  scheme.payments[paymentIndex].amountPaid = undefined;
  scheme.payments[paymentIndex].paymentDate = undefined;
  scheme.payments[paymentIndex].modeOfPayment = undefined;
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); 
  scheme.status = getSchemeStatus(scheme); 

  if (wasClosed && scheme.status !== 'Closed' && scheme.status !== 'Fully Paid') {
    scheme.closureDate = undefined; 
  }
  
  const totals = calculateSchemeTotals(scheme); 
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return getMockSchemeById(schemeId);
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
  const currentSchemes = getMockSchemes(); // Gets non-archived schemes by default
  const archivedGroupNames = new Set(MOCK_ARCHIVED_GROUPS.map(ag => ag.name));
  const groupsMap = new Map<string, { schemes: Scheme[]; customerNames: Set<string>; recordableSchemeCount: number }>();

  currentSchemes.forEach(scheme => {
    if (scheme.customerGroupName && !archivedGroupNames.has(scheme.customerGroupName)) { // Ensure group is not archived
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
    hasOverdueSchemeInGroup: data.schemes.some(scheme => scheme.status === 'Overdue'),
  })).sort((a,b) => a.groupName.localeCompare(b.groupName));
};


export const getUniqueGroupNames = (): string[] => {
  const groupNames = new Set<string>();
  const currentSchemes = getMockSchemes(); // Gets non-archived schemes by default
  const archivedGroupNames = new Set(MOCK_ARCHIVED_GROUPS.map(ag => ag.name));

  currentSchemes.forEach(scheme => {
    if (scheme.customerGroupName && !archivedGroupNames.has(scheme.customerGroupName)) { // Ensure group is not archived
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
  const initialLength = MOCK_SCHEMES.length;
  MOCK_SCHEMES = MOCK_SCHEMES.filter(s => s.id !== schemeId);
  return MOCK_SCHEMES.length < initialLength;
};

// Note for getSchemeStatus in utils.ts:
// It should ideally check: if (scheme.status === 'Archived') return 'Archived'; at the beginning.
// This was partially handled in getMockSchemes by preserving 'Archived' status before calling getSchemeStatus.

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

// --- Archived Payment Management ---

export const archiveMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);

  if (paymentIndex === -1) return undefined;

  if (scheme.payments[paymentIndex].isArchived) {
    // Already archived, perhaps update date or just return current state
    scheme.payments[paymentIndex].archivedDate = formatISO(new Date());
    MOCK_SCHEMES[schemeIndex] = { ...scheme };
    return getMockSchemeById(schemeId); // Return fresh copy
  }

  scheme.payments[paymentIndex].isArchived = true;
  scheme.payments[paymentIndex].archivedDate = formatISO(new Date());

  // After archiving a payment, the scheme's totals and status might change
  const totals = calculateSchemeTotals(scheme);
  scheme.status = getSchemeStatus(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); // Return fresh copy
};

export const unarchiveMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);

  if (paymentIndex === -1 || !scheme.payments[paymentIndex].isArchived) {
    return undefined; // Not found or not archived
  }

  scheme.payments[paymentIndex].isArchived = false;
  scheme.payments[paymentIndex].archivedDate = undefined;

  // After unarchiving, totals and status might change
  const totals = calculateSchemeTotals(scheme);
  scheme.status = getSchemeStatus(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); // Return fresh copy
};

export const deleteArchivedMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentExists = scheme.payments.some(p => p.id === paymentId && p.isArchived);

  if (!paymentExists) {
    // Payment not found, or not archived, so do not delete
    return getMockSchemeById(schemeId); // Return current state
  }

  scheme.payments = scheme.payments.filter(p => !(p.id === paymentId && p.isArchived));

  // After deleting, totals and status might change
  const totals = calculateSchemeTotals(scheme);
  scheme.status = getSchemeStatus(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); // Return fresh copy
};

export const getArchivedPaymentsForAllSchemes = (): Array<Payment & { schemeId: string; customerName: string; schemeStatus?: SchemeStatus }> => {
  const allArchivedPayments: Array<Payment & { schemeId: string; customerName: string; schemeStatus?: SchemeStatus }> = [];
  // Use includeArchived: true to process schemes that themselves might be archived but contain archived payments.
  const allSchemes = getMockSchemes({ includeArchived: true });

  allSchemes.forEach(scheme => {
    scheme.payments.forEach(payment => {
      if (payment.isArchived) {
        allArchivedPayments.push({
          ...payment, // All original payment properties
          schemeId: scheme.id,
          customerName: scheme.customerName,
          schemeStatus: scheme.status, // Current status of the parent scheme
        });
      }
    });
  });
  return allArchivedPayments;
};

// --- Archived Group Management ---
export let MOCK_ARCHIVED_GROUPS: ArchivedGroupInfo[] = [];

export const archiveMockGroup = (groupName: string): boolean => {
  if (MOCK_ARCHIVED_GROUPS.some(ag => ag.name === groupName)) {
    // Group is already archived. We can choose to update its archivedDate or just return.
    // For this implementation, let's update the date and return true, signifying the state is "archived".
    const existingArchivedGroup = MOCK_ARCHIVED_GROUPS.find(ag => ag.name === groupName)!;
    existingArchivedGroup.archivedDate = formatISO(new Date());
    // No change to originalSchemeAssociations or originalSchemeCount as this is an update to an existing archive entry.
    return true;
  }

  const schemesInGroup = MOCK_SCHEMES.filter(s => s.customerGroupName === groupName);
  const associatedSchemes = schemesInGroup.map(s => ({ schemeId: s.id, customerName: s.customerName }));

  MOCK_ARCHIVED_GROUPS.push({
    name: groupName,
    archivedDate: formatISO(new Date()),
    originalSchemeAssociations: associatedSchemes,
    originalSchemeCount: associatedSchemes.length,
  });

  // Disassociate schemes from the group by setting their customerGroupName to undefined
  MOCK_SCHEMES.forEach(scheme => {
    if (scheme.customerGroupName === groupName) {
      scheme.customerGroupName = undefined;
    }
  });

  return true;
};

export const getArchivedGroupsMock = (): ArchivedGroupInfo[] => {
  // Return a deep copy to prevent direct modification of the mock data.
  // Map to include essential info, including originalSchemeCount.
  return JSON.parse(JSON.stringify(MOCK_ARCHIVED_GROUPS.map(group => ({
    name: group.name,
    archivedDate: group.archivedDate,
    originalSchemeCount: group.originalSchemeAssociations?.length ?? 0,
    // originalSchemeAssociations are not included by default to keep the initial list light,
    // but they are available in MOCK_ARCHIVED_GROUPS if needed for a detailed view.
  }))));
};

export const unarchiveMockGroup = (groupName: string): boolean => {
  const groupIndex = MOCK_ARCHIVED_GROUPS.findIndex(ag => ag.name === groupName);
  if (groupIndex === -1) {
    return false; // Group not found in archived list
  }

  // Remove the group from the archived list.
  // Schemes are NOT automatically re-associated with the group name upon unarchiving.
  // This allows for intentional re-association via the UI if desired.
  MOCK_ARCHIVED_GROUPS.splice(groupIndex, 1);

  return true;
};

export const deleteArchivedMockGroup = (groupName: string): boolean => {
  const initialLength = MOCK_ARCHIVED_GROUPS.length;
  MOCK_ARCHIVED_GROUPS = MOCK_ARCHIVED_GROUPS.filter(ag => ag.name !== groupName);
  // Returns true if an element was removed, false otherwise.
  return MOCK_ARCHIVED_GROUPS.length < initialLength;
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
