
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { generatePaymentsForScheme, getSchemeStatus, calculateSchemeTotals, calculateDueDate, getPaymentStatus, generateId } from '@/lib/utils';
import { subMonths, addMonths, formatISO } from 'date-fns';

const createScheme = (customerName: string, startDate: Date, monthlyPaymentAmount: number): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status'> = {
    id: generateId(),
    customerName,
    startDate: formatISO(startDate),
    monthlyPaymentAmount,
    durationMonths: 12,
  };
  
  let payments = generatePaymentsForScheme(baseScheme);
  
  // Simulate some payments for mock data
  if (customerName.includes("Active Customer") && monthlyPaymentAmount === 1000) { // For "Active Customer - Scheme 1"
    payments = payments.map((p, index) => {
      if (index < 3) { // First 3 months paid
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Cash'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Active Customer") && monthlyPaymentAmount === 800) { // For "Active Customer - Scheme 2"
    payments = payments.map((p, index) => {
      if (index < 1) { // First month paid
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
      }
      return p;
    });
  } else if (customerName.includes("Overdue Payer")) { // For "Overdue Payer"
     payments = payments.map((p, index) => {
      if (index === 0) { // First month paid
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Card'] as PaymentMode[] };
      }
      // Make month 2 overdue by not paying it, and month 3 pending
      return p;
    });
  } else if (customerName.includes("Completed Scheme")) { // For "Completed Scheme"
    payments = payments.map(p => ({ ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['Cash'] as PaymentMode[] }));
  }

  // Recalculate payment statuses after mocking payments
  payments.forEach(p => p.status = getPaymentStatus(p, baseScheme.startDate));

  let scheme: Scheme = {
    ...baseScheme,
    payments,
    status: 'Upcoming', // temporary
  };
  
  scheme.status = getSchemeStatus(scheme); // Recalculate scheme status based on updated payment statuses
  const totals = calculateSchemeTotals(scheme);
  scheme = { ...scheme, ...totals };

  return scheme;
};

export let MOCK_SCHEMES: Scheme[] = [
  createScheme('Active Customer', subMonths(new Date(), 4), 1000), // Scheme 1 for Active Customer
  createScheme('Active Customer', subMonths(new Date(), 2), 800),  // Scheme 2 for Active Customer, started later, different amount
  createScheme('New Prospect', addMonths(new Date(), 1), 1500),
  createScheme('Overdue Payer', subMonths(new Date(), 5), 500),
  createScheme('Completed Scheme', subMonths(new Date(), 13), 2000),
  createScheme('Almost Done', subMonths(new Date(), 11), 750),
];

// Simulate some payments for 'Almost Done'
const almostDoneSchemeIdx = MOCK_SCHEMES.findIndex(s => s.customerName === 'Almost Done');
if (almostDoneSchemeIdx !== -1) {
  MOCK_SCHEMES[almostDoneSchemeIdx].payments = MOCK_SCHEMES[almostDoneSchemeIdx].payments.map((p, index) => {
    if (index < 10) { // First 10 months paid
      return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
    }
    return p;
  });
  MOCK_SCHEMES[almostDoneSchemeIdx].payments.forEach(p => p.status = getPaymentStatus(p, MOCK_SCHEMES[almostDoneSchemeIdx].startDate));
  MOCK_SCHEMES[almostDoneSchemeIdx].status = getSchemeStatus(MOCK_SCHEMES[almostDoneSchemeIdx]);
  const totals = calculateSchemeTotals(MOCK_SCHEMES[almostDoneSchemeIdx]);
  MOCK_SCHEMES[almostDoneSchemeIdx] = { ...MOCK_SCHEMES[almostDoneSchemeIdx], ...totals };
}


export const getMockSchemes = (): Scheme[] => JSON.parse(JSON.stringify(MOCK_SCHEMES)); // Deep copy

export const getMockSchemeById = (id: string): Scheme | undefined => {
  const scheme = MOCK_SCHEMES.find(s => s.id === id);
  return scheme ? JSON.parse(JSON.stringify(scheme)) : undefined;
};

export const addMockScheme = (newSchemeData: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'>): Scheme => {
  const baseScheme: Omit<Scheme, 'payments' | 'status'> = {
    id: generateId(),
    customerName: newSchemeData.customerName,
    startDate: newSchemeData.startDate,
    monthlyPaymentAmount: newSchemeData.monthlyPaymentAmount,
    durationMonths: 12,
  };
  const payments = generatePaymentsForScheme(baseScheme);
  let scheme: Scheme = { ...baseScheme, payments, status: 'Upcoming' }; // Initial status
  
  // Recalculate statuses
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
  const updatedPayment = { 
    ...originalPayment, 
    amountPaid: paymentDetails.amountPaid ?? originalPayment.amountPaid,
    paymentDate: paymentDetails.paymentDate ?? originalPayment.paymentDate,
    modeOfPayment: paymentDetails.modeOfPayment ?? originalPayment.modeOfPayment,
  };

  if (updatedPayment.amountPaid && updatedPayment.amountPaid >= updatedPayment.amountExpected) {
    updatedPayment.status = 'Paid';
    if(!updatedPayment.paymentDate) updatedPayment.paymentDate = formatISO(new Date());
  } else {
     // Status will be recalculated by getPaymentStatus below
     // If amount paid is less than expected, or removed, it's not 'Paid'.
  }
  scheme.payments[paymentIndex] = updatedPayment;
  
  // Recalculate ALL payment statuses for the scheme, then scheme status and totals
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
    ...details,
  };
  
  if (details.amountPaid && details.amountPaid >= scheme.payments[paymentIndex].amountExpected) {
    scheme.payments[paymentIndex].status = 'Paid';
    if(!details.paymentDate && !scheme.payments[paymentIndex].paymentDate) {
      scheme.payments[paymentIndex].paymentDate = formatISO(new Date());
    }
  } else if (details.amountPaid !== undefined && details.amountPaid < scheme.payments[paymentIndex].amountExpected) {
    // Let getPaymentStatus handle it
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
  
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };
  
  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}


export const closeMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  MOCK_SCHEMES[schemeIndex].status = 'Completed';
  // Ensure all payments are marked paid before closing might be a good idea in real app
  const totals = calculateSchemeTotals(MOCK_SCHEMES[schemeIndex]);
  MOCK_SCHEMES[schemeIndex] = { ...MOCK_SCHEMES[schemeIndex], ...totals };
  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}

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

  MOCK_SCHEMES.forEach((scheme, schemeIdx) => {
    if (scheme.customerName === customerName && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
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
        const updatedPayment = updateMockSchemePayment(scheme.id, paymentToRecord.id, {
          amountPaid: paymentToRecord.amountExpected,
          paymentDate: paymentDetails.paymentDate,
          modeOfPayment: paymentDetails.modeOfPayment,
        });

        if (updatedPayment) { // updateMockSchemePayment returns the updated scheme or undefined
          // The MOCK_SCHEMES array is updated by reference within updateMockSchemePayment
          totalRecordedAmount += paymentToRecord.amountExpected;
          paymentsRecordedCount++;
          recordedPaymentsInfo.push({
            schemeId: scheme.id,
            monthNumber: paymentToRecord.monthNumber,
            amount: paymentToRecord.amountExpected,
          });
        }
      }
    }
  });

  return { totalRecordedAmount, paymentsRecordedCount, recordedPaymentsInfo };
};
