
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
    scheme.status = 'Completed'; 
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
  // Do not allow payment updates if the scheme was completed and this would alter it,
  // unless closureDate is cleared first by edit/delete logic.
  // This basic check might be enhanced by the calling function's logic.
  if (scheme.status === 'Completed' && scheme.closureDate) {
     const paymentBeingUpdated = scheme.payments.find(p => p.id === paymentId);
     // Allow update if it's the "system closure" payment being set or if it doesn't change the paid status
     if (paymentBeingUpdated && paymentBeingUpdated.paymentDate === scheme.closureDate && paymentBeingUpdated.modeOfPayment?.includes('System Closure')) {
        // this is likely the reconciliation payment being set, allow it
     } else if(paymentDetails.amountPaid && paymentDetails.amountPaid < scheme.monthlyPaymentAmount) {
        console.warn(`Attempted to update payment for completed scheme ${schemeId} in a way that would make it unpaid. This should be handled by reopening.`);
        // Return current state or an error indicator if preferred. For now, return current.
        return getMockSchemeById(schemeId);
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
  
  const wasCompleted = scheme.status === 'Completed' && scheme.closureDate;
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme); 

  if(wasCompleted && scheme.status !== 'Completed'){
      scheme.closureDate = undefined; // Scheme is no longer considered completed
  }
  
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId); 
};

export const editMockPaymentDetails = (schemeId: string, paymentId: string, details: { amountPaid?: number; paymentDate?: string; modeOfPayment?: PaymentMode[] }): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const wasCompleted = scheme.status === 'Completed' && scheme.closureDate;

  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex] = {
    ...scheme.payments[paymentIndex],
    ...details, 
  };
  
  scheme.payments[paymentIndex].status = getPaymentStatus(scheme.payments[paymentIndex], scheme.startDate);

  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); 
  scheme.status = getSchemeStatus(scheme); 

  if (wasCompleted && scheme.status !== 'Completed') {
    scheme.closureDate = undefined; // If editing a payment makes a completed scheme no longer complete
  }
  
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId);
}

export const deleteMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
 const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const wasCompleted = scheme.status === 'Completed' && scheme.closureDate;

  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex].amountPaid = undefined;
  scheme.payments[paymentIndex].paymentDate = undefined;
  scheme.payments[paymentIndex].modeOfPayment = undefined;
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); 
  scheme.status = getSchemeStatus(scheme); 

  if (wasCompleted && scheme.status !== 'Completed') {
    scheme.closureDate = undefined; // If deleting a payment makes a completed scheme no longer complete
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

  if (scheme.status === 'Completed' && scheme.closureDate === options.closureDate && options.type === 'full_reconciliation') {
     let modeChanged = false;
     scheme.payments.forEach(p => {
        if (p.paymentDate === options.closureDate) { 
            const currentModes = p.modeOfPayment?.join(',');
            const newModes = effectiveModeOfPayment.join(',');
            if (currentModes !== newModes) {
                p.modeOfPayment = effectiveModeOfPayment;
                modeChanged = true;
            }
        }
     });
     if(modeChanged){
         const totals = calculateSchemeTotals(scheme);
         MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
         return getMockSchemeById(schemeId);
     }
    return getMockSchemeById(schemeId); 
  }

  scheme.status = 'Completed';
  scheme.closureDate = options.closureDate;

  if (options.type === 'full_reconciliation') {
    scheme.payments.forEach(p => { 
      const currentPaymentStatus = getPaymentStatus(p, scheme.startDate); // Get status before potential modification
      if (currentPaymentStatus !== 'Paid') {
        p.status = 'Paid';
        p.amountPaid = p.amountExpected; 
        p.paymentDate = options.closureDate; 
        p.modeOfPayment = effectiveModeOfPayment;
      } else if (p.paymentDate === options.closureDate && currentPaymentStatus === 'Paid') {
        // If it was already paid on the closure date, update mode of payment if different
        const currentModes = p.modeOfPayment?.join(',');
        const newModes = effectiveModeOfPayment.join(',');
        if (currentModes !== newModes) {
            p.modeOfPayment = effectiveModeOfPayment;
        }
      }
    });
  }
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  
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
    .filter(({ scheme }) => scheme.customerGroupName === groupName && scheme.status !== 'Completed' && (scheme.status === 'Active' || scheme.status === 'Overdue'));

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
  const currentSchemes = getMockSchemes(); 
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
    schemes: data.schemes, 
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

    if (row.MarkAsClosed?.toUpperCase() === 'TRUE' && scheme.status !== 'Completed') {
        const closureDateForUpdate = row.ClosureDate ? parseISO(row.ClosureDate.trim()).toISOString() : formatISO(startOfDay(new Date()));
        
        const updatedScheme = closeMockScheme(scheme.id, {
            closureDate: closureDateForUpdate,
            type: 'full_reconciliation', 
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
            const schemeToUpdate = MOCK_SCHEMES.find(s => s.id === schemeId); 
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
      const reopenedScheme = reopenMockScheme(schemeId);
      if (reopenedScheme) {
        changed = true;
        messages.push(`Row ${index + 2}: Scheme "${schemeId.toUpperCase()}" for ${scheme.customerName} has been Reopened.`);
      } else {
        messages.push(`Row ${index + 2}: Error reopening scheme "${schemeId.toUpperCase()}".`);
        errorCount++;
        return;
      }
    } else {
       messages.push(`Row ${index + 2}: No action taken for SchemeID "${schemeId.toUpperCase()}" (MarkAsClosed was not TRUE or FALSE).`);
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

  // Check if the new customer name already exists (unless it's the same as the original)
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
      }
    });
  }
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return getMockSchemeById(schemeId);
};

export const deleteFullMockScheme = (schemeId: string): boolean => {
  const initialLength = MOCK_SCHEMES.length;
  MOCK_SCHEMES = MOCK_SCHEMES.filter(s => s.id !== schemeId);
  return MOCK_SCHEMES.length < initialLength;
};

