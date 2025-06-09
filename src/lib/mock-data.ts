
import type { Scheme, Payment, PaymentMode, GroupDetail, SchemeStatus } from '@/types/scheme';
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

  // Create a temporary scheme object to pass to getSchemeStatus, 
  // ensuring its own .status property doesn't interfere with the initial calculation.
  const tempSchemeForStatusCalc: Scheme = {
    ...baseScheme,
    payments,
    status: 'Upcoming' // Provide a known, non-completed state for calculation purposes
  };
  tempSchemeForStatusCalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForStatusCalc.startDate));
  const calculatedStatus = getSchemeStatus(tempSchemeForStatusCalc);

  let scheme: Scheme = {
    ...baseScheme,
    payments: tempSchemeForStatusCalc.payments, // Use payments with their individual statuses updated
    status: calculatedStatus, // Assign the purely calculated status
  };
  
  if (customerName.includes("Edward Scissorhands")) {
    scheme.status = 'Completed'; // Override for this specific example user after general calculation
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
  createScheme('George Jetson', subMonths(new Date(), 3), 1200, "Office Buddies", "2109876543", "Orbit City, Skypad Apartments"),
  createScheme('Hannah Montana', subMonths(new Date(), 1), 600, undefined, "1098765432", "Malibu, CA"), 
  createScheme('Iris West', subMonths(new Date(), 6), 900, "Smith Family", "0987654321", "Central City Apt"), 
];

const fionaSchemeIdx = MOCK_SCHEMES.findIndex(s => s.customerName === 'Fiona Gallagher');
if (fionaSchemeIdx !== -1) {
  MOCK_SCHEMES[fionaSchemeIdx].payments = MOCK_SCHEMES[fionaSchemeIdx].payments.map((p, index) => {
    if (index < 10) { 
      return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
    }
    return p;
  });
  MOCK_SCHEMES[fionaSchemeIdx].payments.forEach(p => p.status = getPaymentStatus(p, MOCK_SCHEMES[fionaSchemeIdx].startDate));
  MOCK_SCHEMES[fionaSchemeIdx].status = getSchemeStatus(MOCK_SCHEMES[fionaSchemeIdx]);
  const totals = calculateSchemeTotals(MOCK_SCHEMES[fionaSchemeIdx]);
  MOCK_SCHEMES[fionaSchemeIdx] = { ...MOCK_SCHEMES[fionaSchemeIdx], ...totals };
}


export const getMockSchemes = (): Scheme[] => JSON.parse(JSON.stringify(MOCK_SCHEMES.map(s => {
    // Create a temporary scheme to ensure status is based on current payment statuses
    const tempScheme = JSON.parse(JSON.stringify(s));
    tempScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, tempScheme.startDate));
    const status = getSchemeStatus(tempScheme);
    const totals = calculateSchemeTotals(tempScheme);
    return { ...tempScheme, ...totals, status };
  })));

export const getMockSchemeById = (id: string): Scheme | undefined => {
  const schemeFromGlobalArray = MOCK_SCHEMES.find(s => s.id === id);
  if (!schemeFromGlobalArray) return undefined;
  
  const clonedScheme: Scheme = JSON.parse(JSON.stringify(schemeFromGlobalArray));

  // Ensure all payment statuses are up-to-date relative to the current date
  clonedScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, clonedScheme.startDate));
  
  // Recalculate the overall scheme status based on the (potentially updated) payment statuses
  // This ensures that getSchemeStatus has the most accurate payment info.
  // The getSchemeStatus function itself will respect an existing 'Completed' status if it's already set on clonedScheme.
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
    startDate: newSchemeData.startDate, // Expecting ISO string
    monthlyPaymentAmount: newSchemeData.monthlyPaymentAmount,
    durationMonths: 12,
  };
  
  const payments = generatePaymentsForScheme(baseScheme);
  
  // Create a temporary scheme object to pass to getSchemeStatus, 
  // ensuring its own .status property doesn't interfere with the initial calculation.
  const tempSchemeForStatusCalc: Scheme = {
    ...baseScheme,
    payments,
    status: 'Upcoming' as SchemeStatus // Provide a known, non-completed state for calculation purposes
  };
  tempSchemeForStatusCalc.payments.forEach(p => p.status = getPaymentStatus(p, tempSchemeForStatusCalc.startDate));
  const calculatedStatus = getSchemeStatus(tempSchemeForStatusCalc); // This calculatedStatus should be correct ('Active', 'Upcoming', etc.)

  // Now create the final scheme object with the correctly calculated status
  let finalScheme: Scheme = { 
    ...baseScheme, 
    payments: tempSchemeForStatusCalc.payments, // Use payments with their individual statuses updated
    status: calculatedStatus // Use the purely calculated status
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
  if (scheme.status === 'Completed') {
    console.warn(`Attempted to update payment for already completed scheme: ${schemeId}`);
    return getMockSchemeById(schemeId); 
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

  updatedPayment.status = getPaymentStatus(updatedPayment, scheme.startDate); // Recalculate this payment's status
  scheme.payments[paymentIndex] = updatedPayment;
  
  // Recalculate all payment statuses and overall scheme status
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme); 
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); // Return a fresh copy with latest calculations
};

export const editMockPaymentDetails = (schemeId: string, paymentId: string, details: { amountPaid?: number; paymentDate?: string; modeOfPayment?: PaymentMode[] }): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  if (scheme.status === 'Completed') {
    console.warn(`Attempted to edit payment for already completed scheme: ${schemeId}`);
    return getMockSchemeById(schemeId);
  }

  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex] = {
    ...scheme.payments[paymentIndex],
    ...details, 
  };
  
  scheme.payments[paymentIndex].status = getPaymentStatus(scheme.payments[paymentIndex], scheme.startDate);

  // Recalculate all payment statuses and overall scheme status
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); 
  scheme.status = getSchemeStatus(scheme); 
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId);
}

export const deleteMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
 const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  if (scheme.status === 'Completed') {
    console.warn(`Attempted to delete payment for already completed scheme: ${schemeId}`);
    return getMockSchemeById(schemeId);
  }

  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex].amountPaid = undefined;
  scheme.payments[paymentIndex].paymentDate = undefined;
  scheme.payments[paymentIndex].modeOfPayment = undefined;
  
  // Recalculate all payment statuses and overall scheme status
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); 
  scheme.status = getSchemeStatus(scheme); 
  const totals = calculateSchemeTotals(scheme); 
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return getMockSchemeById(schemeId);
};

interface CloseSchemeOptions {
  closureDate: string; // ISO Date string
  type: 'full_reconciliation' | 'partial_closure';
  modeOfPayment?: PaymentMode[]; // Required if type is 'full_reconciliation'
}

export const closeMockScheme = (schemeId: string, options: CloseSchemeOptions): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  if (scheme.status === 'Completed' && scheme.closureDate === options.closureDate && options.type === 'full_reconciliation') {
    // If already completed with same date and full reconciliation, check if mode of payment needs update
     let modeChanged = false;
     scheme.payments.forEach(p => {
        if (p.paymentDate === options.closureDate) { // payments reconciled on this date
            const currentModes = p.modeOfPayment?.join(',');
            const newModes = options.modeOfPayment?.join(',');
            if (currentModes !== newModes) {
                p.modeOfPayment = options.modeOfPayment && options.modeOfPayment.length > 0 ? options.modeOfPayment : ['System Closure'];
                modeChanged = true;
            }
        }
     });
     if(modeChanged){
         const totals = calculateSchemeTotals(scheme);
         MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
         return getMockSchemeById(schemeId);
     }
    console.warn(`Scheme ${schemeId} is already completed with these settings.`);
    return getMockSchemeById(schemeId); 
  }

  scheme.status = 'Completed';
  scheme.closureDate = options.closureDate;

  if (options.type === 'full_reconciliation') {
    scheme.payments.forEach(p => { 
      if (getPaymentStatus(p, scheme.startDate) !== 'Paid') { // Check original status before forced update
        p.status = 'Paid';
        p.amountPaid = p.amountExpected; 
        p.paymentDate = options.closureDate; 
        p.modeOfPayment = options.modeOfPayment && options.modeOfPayment.length > 0 ? options.modeOfPayment : ['System Closure'];
      } else if (p.paymentDate === options.closureDate && p.status === 'Paid' && options.modeOfPayment) {
        // If it was already paid on the closure date, update mode of payment if different
        const currentModes = p.modeOfPayment?.join(',');
        const newModes = options.modeOfPayment?.join(',');
        if (currentModes !== newModes) {
            p.modeOfPayment = options.modeOfPayment;
        }
      }
    });
  }
  // For 'partial_closure', individual payment statuses remain as they were.
  
  // Ensure all payment statuses are consistent after any changes
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  // Scheme status is already set to 'Completed' above, so getSchemeStatus will honor it.
  // scheme.status = getSchemeStatus(scheme); // This line is redundant now as it's set above.
  
  const totals = calculateSchemeTotals(scheme); 
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return getMockSchemeById(schemeId);
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
    .filter(({ scheme }) => scheme.customerName === customerName && scheme.status !== 'Completed' && (scheme.status === 'Active' || scheme.status === 'Overdue'));
    
  customerSchemesIndices.forEach(({ scheme }) => { // Removed unused index
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
    .map((scheme, index) => ({ scheme, index })) // Keep index if needed for MOCK_SCHEMES direct modification, but prefer functional updates
    .filter(({ scheme }) => scheme.customerGroupName === groupName && scheme.status !== 'Completed' && (scheme.status === 'Active' || scheme.status === 'Overdue'));

  schemesInGroupIndices.forEach(({ scheme }) => { // Removed unused index
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
  const currentSchemes = getMockSchemes(); // Use the getter to ensure fresh data
  const groupsMap = new Map<string, { schemes: Scheme[]; customerNames: Set<string>; recordableSchemeCount: number }>();

  currentSchemes.forEach(scheme => {
    if (scheme.customerGroupName) {
      const groupEntry = groupsMap.get(scheme.customerGroupName) || { schemes: [], customerNames: new Set(), recordableSchemeCount: 0 };
      groupEntry.schemes.push(scheme);
      groupEntry.customerNames.add(scheme.customerName);

      let hasRecordablePaymentForThisScheme = false;
      if (scheme.status !== 'Completed' && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
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
    schemes: data.schemes, // schemes here are already processed by getMockSchemes
    customerNames: Array.from(data.customerNames).sort(),
    totalSchemesInGroup: data.schemes.length,
    recordableSchemeCount: data.recordableSchemeCount,
  })).sort((a,b) => a.groupName.localeCompare(b.groupName));
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
  // Note: This directly mutates MOCK_SCHEMES. Consider returning new array if immutability is key.
  // For this app's scale, direct mutation followed by reload is okay.
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

export const getUniqueGroupNames = (): string[] => {
  const groupNames = new Set<string>();
  // Iterate over a potentially fresh copy to avoid issues if MOCK_SCHEMES is stale
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
  
  // Return a fresh, recalculated copy
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

    const scheme = getMockSchemeById(schemeId); // Get a fresh, calculated version
    if (!scheme) {
      messages.push(`Row ${index + 2}: SchemeID "${schemeId.toUpperCase()}" not found. Skipping.`);
      errorCount++;
      return;
    }
    
    let changed = false;

    if (row.MarkAsClosed?.toUpperCase() === 'TRUE' && scheme.status !== 'Completed') {
        const closureDateForUpdate = row.ClosureDate ? parseISO(row.ClosureDate.trim()).toISOString() : formatISO(startOfDay(new Date()));
        
        const updatedScheme = closeMockScheme(scheme.id, {
            closureDate: closureDateForUpdate,
            type: 'full_reconciliation', // CSV import defaults to full reconciliation
            modeOfPayment: ['System Closure'] 
        });
        if (updatedScheme) {
            changed = true;
            messages.push(`Row ${index + 2}: Scheme "${schemeId.toUpperCase()}" for ${scheme.customerName} marked as Closed on ${formatDate(updatedScheme.closureDate!)} (Full Reconciliation).`);
        } else {
            messages.push(`Row ${index + 2}: Error closing scheme "${schemeId.toUpperCase()}".`);
            errorCount++; 
            return; 
        }
    } else if (row.MarkAsClosed?.toUpperCase() === 'TRUE' && scheme.status === 'Completed') {
         messages.push(`Row ${index + 2}: Scheme "${schemeId.toUpperCase()}" for ${scheme.customerName} was already closed. Closure date updated if provided and different.`);
         if (row.ClosureDate) {
            const newClosureDateISO = parseISO(row.ClosureDate.trim()).toISOString();
            const schemeToUpdate = MOCK_SCHEMES.find(s => s.id === schemeId); // get direct ref for update
            if (schemeToUpdate && schemeToUpdate.closureDate !== newClosureDateISO) {
                schemeToUpdate.closureDate = newClosureDateISO;
                schemeToUpdate.payments.forEach(p => {
                    if(p.modeOfPayment?.includes('System Closure') || (p.status === 'Paid' && p.paymentDate === schemeToUpdate.closureDate)) { 
                        p.paymentDate = newClosureDateISO;
                    }
                });
                changed = true; 
            }
         }
    } else if (row.MarkAsClosed?.toUpperCase() === 'FALSE') {
      messages.push(`Row ${index + 2}: Re-opening schemes (MarkAsClosed=FALSE) is not currently supported for SchemeID "${schemeId.toUpperCase()}". No action taken.`);
    } else {
       messages.push(`Row ${index + 2}: No action taken for SchemeID "${schemeId.toUpperCase()}" (MarkAsClosed was not TRUE or FALSE).`);
    }

    if (changed) {
      // The closeMockScheme already updates MOCK_SCHEMES and its totals.
      // If only closureDate was changed for an already completed scheme, we might need to ensure totals are fine,
      // but closeMockScheme (if called) or direct update handles it.
      successCount++;
    }
  });

  return { successCount, errorCount, messages };
};

export const updateMockCustomerDetails = (
  customerNameToUpdate: string,
  details: { customerPhone?: string; customerAddress?: string }
): Scheme[] | undefined => {
  let updatedSchemesForCustomer: Scheme[] = [];
  let customerFound = false;

  MOCK_SCHEMES.forEach((scheme, index) => {
    if (scheme.customerName === customerNameToUpdate) {
      customerFound = true;
      MOCK_SCHEMES[index].customerPhone = details.customerPhone !== undefined ? details.customerPhone : scheme.customerPhone;
      MOCK_SCHEMES[index].customerAddress = details.customerAddress !== undefined ? details.customerAddress : scheme.customerAddress;
      // No need to getMockSchemeById here as we only change non-calculated fields.
      // The page displaying this will re-fetch if necessary.
    }
  });

  if (customerFound) {
    // After updating, filter to get all schemes for this customer to return
    // This ensures we return copies with any recalculations if needed elsewhere, though not strictly for this function
    updatedSchemesForCustomer = getMockSchemes().filter(s => s.customerName === customerNameToUpdate);
    return updatedSchemesForCustomer;
  }
  return undefined; // Customer not found
};


