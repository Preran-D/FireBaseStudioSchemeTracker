
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { generatePaymentsForScheme, getSchemeStatus, calculateSchemeTotals, calculateDueDate, getPaymentStatus, generateId } from '@/lib/utils';
import { subMonths, addMonths, formatISO, parseISO } from 'date-fns';

const createScheme = (
  customerName: string, 
  startDate: Date, 
  monthlyPaymentAmount: number,
  customerGroupName?: string // Added customerGroupName
): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status'> = {
    id: generateId(),
    customerName,
    customerGroupName, // Assign group name
    startDate: formatISO(startDate),
    monthlyPaymentAmount,
    durationMonths: 12,
  };
  
  let payments = generatePaymentsForScheme(baseScheme);
  
  // Simulate some payments for mock data
  if (customerName.includes("Active Customer") && monthlyPaymentAmount === 1000) { 
    payments = payments.map((p, index) => {
      if (index < 3) { 
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Cash'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Active Customer") && monthlyPaymentAmount === 800) { 
    payments = payments.map((p, index) => {
      if (index < 1) { 
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Overdue Payer")) { 
     payments = payments.map((p, index) => {
      if (index === 0) { 
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Card'] as PaymentMode[] };
      }
      // Month 2 (index 1) remains unpaid for overdue testing
      return p;
    });
  } else if (customerName.includes("Completed Scheme")) { 
    payments = payments.map(p => ({ ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Cash'] as PaymentMode[] }));
  }

  payments.forEach(p => p.status = getPaymentStatus(p, baseScheme.startDate));

  let scheme: Scheme = {
    ...baseScheme,
    payments,
    status: 'Upcoming', 
  };
  
  scheme.status = getSchemeStatus(scheme); 
  const totals = calculateSchemeTotals(scheme);
  scheme = { ...scheme, ...totals };

  return scheme;
};

export let MOCK_SCHEMES: Scheme[] = [
  createScheme('Alice Wonderland', subMonths(new Date(), 4), 1000, "Smith Family"),
  createScheme('Bob The Builder', subMonths(new Date(), 2), 800, "Smith Family"),
  createScheme('Charlie Brown', addMonths(new Date(), 1), 1500, "Office Buddies"),
  createScheme('Diana Prince', subMonths(new Date(), 5), 500, "Smith Family"), // Overdue Payer
  createScheme('Edward Scissorhands', subMonths(new Date(), 13), 2000, "Solo Ventures"), // Completed
  createScheme('Fiona Gallagher', subMonths(new Date(), 11), 750, "Office Buddies"), // Almost Done
  createScheme('George Jetson', subMonths(new Date(), 3), 1200, "Office Buddies"),
  createScheme('Hannah Montana', subMonths(new Date(), 1), 600), // No group
  createScheme('Iris West', subMonths(new Date(), 6), 900, "Smith Family"), 
];

// Ensure "Almost Done" (Fiona Gallagher) has most payments made
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
    const totals = calculateSchemeTotals(s);
    s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
    const status = getSchemeStatus(s);
    return { ...s, ...totals, status };
  })));

export const getMockSchemeById = (id: string): Scheme | undefined => {
  const scheme = MOCK_SCHEMES.find(s => s.id === id);
  if (!scheme) return undefined;
  const clonedScheme = JSON.parse(JSON.stringify(scheme));
  clonedScheme.payments.forEach((p: Payment) => p.status = getPaymentStatus(p, clonedScheme.startDate));
  clonedScheme.status = getSchemeStatus(clonedScheme);
  const totals = calculateSchemeTotals(clonedScheme);
  return { ...clonedScheme, ...totals };
};

export const addMockScheme = (newSchemeData: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'> ): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status'> = {
    id: generateId(),
    customerName: newSchemeData.customerName,
    customerGroupName: newSchemeData.customerGroupName,
    startDate: newSchemeData.startDate,
    monthlyPaymentAmount: newSchemeData.monthlyPaymentAmount,
    durationMonths: 12,
  };
  const payments = generatePaymentsForScheme(baseScheme);
  let scheme: Scheme = { ...baseScheme, payments, status: 'Upcoming' }; 
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  scheme = { ...scheme, ...totals };
  
  MOCK_SCHEMES.push(scheme);
  return JSON.parse(JSON.stringify(scheme));
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
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  const originalPayment = scheme.payments[paymentIndex];
  const updatedPayment: Payment = { 
    ...originalPayment, 
    amountPaid: paymentDetails.amountPaid ?? originalPayment.amountPaid,
    paymentDate: paymentDetails.paymentDate ?? originalPayment.paymentDate,
    modeOfPayment: paymentDetails.modeOfPayment ?? originalPayment.modeOfPayment,
    // Status will be recalculated below
    status: originalPayment.status // Keep original status temporarily
  };

  if (updatedPayment.amountPaid && updatedPayment.amountPaid >= updatedPayment.amountExpected) {
    updatedPayment.status = 'Paid'; // Tentatively mark as Paid
    if(!updatedPayment.paymentDate) updatedPayment.paymentDate = formatISO(new Date());
  }
  scheme.payments[paymentIndex] = updatedPayment;
  
  // Recalculate all payment statuses for the scheme, then scheme status and totals
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
};

export const editMockPaymentDetails = (schemeId: string, paymentId: string, details: { amountPaid?: number; paymentDate?: string; modeOfPayment?: PaymentMode[] }): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex] = {
    ...scheme.payments[paymentIndex],
    ...details, // Apply given details
  };
  
  // Ensure status is correctly set based on new details
  if (details.amountPaid && details.amountPaid >= scheme.payments[paymentIndex].amountExpected) {
    scheme.payments[paymentIndex].status = 'Paid';
    if(!details.paymentDate && !scheme.payments[paymentIndex].paymentDate) { // If no date provided and none exists, set to now
      scheme.payments[paymentIndex].paymentDate = formatISO(new Date());
    }
  } else if (details.hasOwnProperty('amountPaid') && (!details.amountPaid || details.amountPaid < scheme.payments[paymentIndex].amountExpected)) {
    // If amountPaid was explicitly set to something less than expected, or cleared
     scheme.payments[paymentIndex].status = getPaymentStatus(scheme.payments[paymentIndex], scheme.startDate); // Recalculate, likely Pending/Overdue
  }


  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}

export const deleteMockPayment = (schemeId: string, paymentId: string): Scheme | undefined => {
 const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex].amountPaid = undefined;
  scheme.payments[paymentIndex].paymentDate = undefined;
  scheme.payments[paymentIndex].modeOfPayment = undefined;
  // Status will be recalculated
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate)); // Recalculate all payment statuses
  scheme.status = getSchemeStatus(scheme); // Recalculate scheme status
  const totals = calculateSchemeTotals(scheme); // Recalculate totals
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}


export const closeMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  MOCK_SCHEMES[schemeIndex].status = 'Completed';
  MOCK_SCHEMES[schemeIndex].payments.forEach(p => { // Ensure all payments are marked paid if closing
    if (p.status !== 'Paid') {
      p.status = 'Paid';
      p.amountPaid = p.amountExpected;
      if (!p.paymentDate) p.paymentDate = formatISO(new Date());
    }
  });
  const totals = calculateSchemeTotals(MOCK_SCHEMES[schemeIndex]);
  MOCK_SCHEMES[schemeIndex] = { ...MOCK_SCHEMES[schemeIndex], ...totals };
  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}

export const recordNextDuePaymentsForCustomerGroup = (
  groupName: string,
  paymentDetails: { paymentDate: string; modeOfPayment: PaymentMode[] }
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
    .filter(({ scheme }) => scheme.customerGroupName === groupName && (scheme.status === 'Active' || scheme.status === 'Overdue'));

  schemesInGroupIndices.forEach(({ scheme, index: schemeGlobalIndex }) => {
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
        const updatedScheme = updateMockSchemePayment(scheme.id, paymentToRecord.id, { // This will update MOCK_SCHEMES directly
          amountPaid: paymentToRecord.amountExpected,
          paymentDate: paymentDetails.paymentDate,
          modeOfPayment: paymentDetails.modeOfPayment,
        });

        if (updatedScheme) { // updateMockSchemePayment returns the updated scheme or undefined
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
  const schemes = getMockSchemes(); // Get fresh, calculated schemes
  const groupsMap = new Map<string, { schemes: Scheme[]; customerNames: Set<string>; recordableSchemeCount: number }>();

  schemes.forEach(scheme => {
    if (scheme.customerGroupName) {
      const groupEntry = groupsMap.get(scheme.customerGroupName) || { schemes: [], customerNames: new Set(), recordableSchemeCount: 0 };
      groupEntry.schemes.push(scheme);
      groupEntry.customerNames.add(scheme.customerName);

      // Check if this scheme has a recordable payment
      let hasRecordablePaymentForThisScheme = false;
      if (scheme.status === 'Active' || scheme.status === 'Overdue') {
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
    customerNames: Array.from(data.customerNames),
    totalSchemesInGroup: data.schemes.length,
    recordableSchemeCount: data.recordableSchemeCount,
  })).sort((a,b) => a.groupName.localeCompare(b.groupName));
};

export const updateMockGroupName = (oldGroupName: string, newGroupName: string): boolean => {
  if (!newGroupName || newGroupName.trim() === "") return false;
  // Check if new group name already exists (optional, depends on desired behavior)
  // For now, allow renaming even if it merges with another group concept (simple rename)
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

