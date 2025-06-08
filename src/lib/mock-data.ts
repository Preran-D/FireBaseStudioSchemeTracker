import type { Scheme, Payment } from '@/types/scheme';
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
  if (customerName.includes("Active")) { // For "Active Customer"
    payments = payments.map((p, index) => {
      if (index < 3) { // First 3 months paid
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const };
      }
      return p;
    });
  } else if (customerName.includes("Overdue")) { // For "Overdue Payer"
     payments = payments.map((p, index) => {
      if (index === 0) { // First month paid
        return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const };
      }
      // Month 2 and 3 are overdue, not paid
      return p;
    });
  } else if (customerName.includes("Completed")) { // For "Completed Scheme"
    payments = payments.map(p => ({ ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const }));
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

export const MOCK_SCHEMES: Scheme[] = [
  createScheme('Active Customer', subMonths(new Date(), 4), 1000),
  createScheme('New Prospect', addMonths(new Date(), 1), 1500),
  createScheme('Overdue Payer', subMonths(new Date(), 5), 500),
  createScheme('Completed Scheme', subMonths(new Date(), 13), 2000),
  createScheme('Almost Done', subMonths(new Date(), 11), 750),
];

// Simulate some payments for 'Almost Done'
const almostDoneScheme = MOCK_SCHEMES.find(s => s.customerName === 'Almost Done');
if (almostDoneScheme) {
  almostDoneScheme.payments = almostDoneScheme.payments.map((p, index) => {
    if (index < 10) { // First 10 months paid
      return { ...p, amountPaid: p.amountExpected, paymentDate: p.dueDate, status: 'Paid' as const };
    }
    return p;
  });
  almostDoneScheme.payments.forEach(p => p.status = getPaymentStatus(p, almostDoneScheme.startDate));
  almostDoneScheme.status = getSchemeStatus(almostDoneScheme);
  const totals = calculateSchemeTotals(almostDoneScheme);
  Object.assign(almostDoneScheme, totals);
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

export const updateMockSchemePayment = (schemeId: string, paymentId: string, paymentDetails: Partial<Payment>): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  const scheme = MOCK_SCHEMES[schemeIndex];
  const paymentIndex = scheme.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return undefined;

  scheme.payments[paymentIndex] = { ...scheme.payments[paymentIndex], ...paymentDetails };
  // If payment is made, update status
  if (paymentDetails.amountPaid && paymentDetails.amountPaid >= scheme.payments[paymentIndex].amountExpected) {
    scheme.payments[paymentIndex].status = 'Paid';
    if(paymentDetails.paymentDate) scheme.payments[paymentIndex].paymentDate = paymentDetails.paymentDate;
    else scheme.payments[paymentIndex].paymentDate = formatISO(new Date());
  }
  
  // Recalculate payment statuses and scheme status/totals
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  scheme.status = getSchemeStatus(scheme);
  const totals = calculateSchemeTotals(scheme);
  MOCK_SCHEMES[schemeIndex] = { ...scheme, ...totals };

  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
};

export const closeMockScheme = (schemeId: string): Scheme | undefined => {
  const schemeIndex = MOCK_SCHEMES.findIndex(s => s.id === schemeId);
  if (schemeIndex === -1) return undefined;

  MOCK_SCHEMES[schemeIndex].status = 'Completed';
  // Potentially fill any unpaid as 'Paid' if business logic allows, or just mark completed
  // For now, just updating status
  const totals = calculateSchemeTotals(MOCK_SCHEMES[schemeIndex]);
  MOCK_SCHEMES[schemeIndex] = { ...MOCK_SCHEMES[schemeIndex], ...totals };
  return JSON.parse(JSON.stringify(MOCK_SCHEMES[schemeIndex]));
}
