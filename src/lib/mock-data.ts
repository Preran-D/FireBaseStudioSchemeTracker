
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
  
  scheme.status = getSchemeStatus(scheme);
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
  let scheme: Scheme = { ...baseScheme, payments, status: 'Upcoming' };
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  scheme = { ...scheme, ...totals };
  MOCK_SCHEMES.push(scheme);
  return JSON.parse(JSON.stringify(scheme));
};

interface UpdatePaymentPayload extends Partial<Omit<Payment, 'id' | 'schemeId' | 'monthNumber' | 'dueDate' | 'amountExpected' | 'status'>> {
  // only amountPaid, paymentDate, modeOfPayment are expected
}

export const updateMockSchemePayment = (schemeId: string, paymentId: string, paymentDetails: UpdatePaymentPayload): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  // Merge new details
  const updatedPayment = { ...scheme.payments[paymentIndex], ...paymentDetails };

  if (updatedPayment.amountPaid && updatedPayment.amountPaid >= updatedPayment.amountExpected) {
    updatedPayment.status = 'Paid';
    if(!updatedPayment.paymentDate) updatedPayment.paymentDate = formatISO(new Date());
  } else if (updatedPayment.amountPaid === undefined || updatedPayment.amountPaid === null || updatedPayment.amountPaid <= 0) {
    // If payment is effectively removed or zeroed out
    updatedPayment.amountPaid = undefined;
    updatedPayment.paymentDate = undefined;
    updatedPayment.modeOfPayment = undefined;
    // Status will be recalculated by getPaymentStatus
  }
  scheme.payments[paymentIndex] = updatedPayment;
  
  // Recalculate payment statuses and scheme status/totals
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

  // Apply updates
  scheme.payments[paymentIndex] = {
    ...scheme.payments[paymentIndex],
    ...details,
  };
  
  // If amountPaid is provided and it's enough, mark as Paid
  if (details.amountPaid && details.amountPaid >= scheme.payments[paymentIndex].amountExpected) {
    scheme.payments[paymentIndex].status = 'Paid';
    if(!details.paymentDate) scheme.payments[paymentIndex].paymentDate = formatISO(new Date()); // Default payment date if not provided
  } else if (details.amountPaid !== undefined && details.amountPaid < scheme.payments[paymentIndex].amountExpected) {
     // If partially paid or less than expected, it's not 'Paid' for status calculation purposes (unless business logic changes)
     // The getPaymentStatus will handle if it's Pending/Overdue based on due date
  }


  // Recalculate all statuses and totals
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

  // Revert payment details
  scheme.payments[paymentIndex].amountPaid = undefined;
  scheme.payments[paymentIndex].paymentDate = undefined;
  scheme.payments[paymentIndex].modeOfPayment = undefined;
  
  // Recalculate statuses and totals
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme); // Recalculate scheme status
  const totals = calculateSchemeTotals(scheme); // Recalculate totals
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
