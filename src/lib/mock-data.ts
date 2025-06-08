
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { generatePaymentsForScheme, getSchemeStatus, calculateSchemeTotals, calculateDueDate, getPaymentStatus, generateId } from '@/lib/utils';
import { subMonths, addMonths, formatISO } from 'date-fns';

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
  createScheme('Active Customer', subMonths(new Date(), 4), 1000, "Smith Family"),
  createScheme('Active Customer', subMonths(new Date(), 2), 800, "Smith Family"),
  createScheme('New Prospect', addMonths(new Date(), 1), 1500, "Office Buddies"),
  createScheme('Overdue Payer', subMonths(new Date(), 5), 500, "Smith Family"),
  createScheme('Completed Scheme', subMonths(new Date(), 13), 2000, "Solo Ventures"),
  createScheme('Almost Done', subMonths(new Date(), 11), 750, "Office Buddies"),
  createScheme('Another Customer', subMonths(new Date(), 3), 1200, "Office Buddies"), // New customer in Office Buddies
  createScheme('Independent Client', subMonths(new Date(), 1), 600), // No group
];

const almostDoneSchemeIdx = MOCK_SCHEMES.findIndex(s => s.customerName === 'Almost Done');
if (almostDoneSchemeIdx !== -1) {
  MOCK_SCHEMES[almostDoneSchemeIdx].payments = MOCK_SCHEMES[almostDoneSchemeIdx].payments.map((p, index) => {
    if (index < 10) { 
      return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const, modeOfPayment: ['UPI'] as PaymentMode[] };
    }
    return p;
  });
  MOCK_SCHEMES[almostDoneSchemeIdx].payments.forEach(p => p.status = getPaymentStatus(p, MOCK_SCHEMES[almostDoneSchemeIdx].startDate));
  MOCK_SCHEMES[almostDoneSchemeIdx].status = getSchemeStatus(MOCK_SCHEMES[almostDoneSchemeIdx]);
  const totals = calculateSchemeTotals(MOCK_SCHEMES[almostDoneSchemeIdx]);
  MOCK_SCHEMES[almostDoneSchemeIdx] = { ...MOCK_SCHEMES[almostDoneSchemeIdx], ...totals };
}


export const getMockSchemes = (): Scheme[] => JSON.parse(JSON.stringify(MOCK_SCHEMES)); 

export const getMockSchemeById = (id: string): Scheme | undefined => {
  const scheme = MOCK_SCHEMES.find(s => s.id === id);
  return scheme ? JSON.parse(JSON.stringify(scheme)) : undefined;
};

export const addMockScheme = (newSchemeData: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths' | 'customerGroupName'> & { customerGroupName?: string }): Scheme => {
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
  const updatedPayment = { 
    ...originalPayment, 
    amountPaid: paymentDetails.amountPaid ?? originalPayment.amountPaid,
    paymentDate: paymentDetails.paymentDate ?? originalPayment.paymentDate,
    modeOfPayment: paymentDetails.modeOfPayment ?? originalPayment.modeOfPayment,
  };

  if (updatedPayment.amountPaid && updatedPayment.amountPaid >= updatedPayment.amountExpected) {
    updatedPayment.status = 'Paid';
    if(!updatedPayment.paymentDate) updatedPayment.paymentDate = formatISO(new Date());
  }
  scheme.payments[paymentIndex] = updatedPayment;
  
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
  const totals = calculateSchemeTotals(MOCK_SCHEMES[schemeIndex]);
  MOCK_SCHEMES[schemeIndex] = { ...MOCK_SCHEMES[schemeIndex], ...totals };
  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}

export const recordNextDuePaymentsForCustomer = ( // Kept for potential future use, but dashboard now uses group batching
  customerName: string,
  paymentDetails: { paymentDate: string; modeOfPayment: PaymentMode[] }
): {
  totalRecordedAmount: number;
  paymentsRecordedCount: number;
  recordedPaymentsInfo: Array<{ schemeId: string; customerName: string; monthNumber: number; amount: number }>;
} => {
  let totalRecordedAmount = 0;
  let paymentsRecordedCount = 0;
  const recordedPaymentsInfo: Array<{ schemeId: string; customerName: string; monthNumber: number; amount: number }> = [];

  MOCK_SCHEMES.forEach((scheme) => {
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
    }
  });

  return { totalRecordedAmount, paymentsRecordedCount, recordedPaymentsInfo };
};

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

  MOCK_SCHEMES.forEach((scheme) => {
    if (scheme.customerGroupName === groupName && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
      let nextRecordablePaymentIndex = -1;
      // Find the next recordable payment for this specific scheme within the group
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
    }
  });
  return { totalRecordedAmount, paymentsRecordedCount, recordedPaymentsInfo };
};
