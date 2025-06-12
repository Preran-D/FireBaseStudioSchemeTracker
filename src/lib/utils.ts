
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addMonths, differenceInDays, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import type { Scheme, Payment, SchemeStatus, PaymentStatus } from '@/types/scheme';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | undefined | null, currencySymbol: string = '₹'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
  // Using 'en-IN' locale implies Rupee, but explicitly providing symbol for robustness if needed.
  // The Intl.NumberFormat will typically handle the symbol correctly based on currency code 'INR'.
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    minimumFractionDigits: 0, // Optional: to remove paisa if not needed
    maximumFractionDigits: 2, // Standard for currency
  }).format(amount);
}

export function formatDate(dateString: string | undefined | null, dateFormat: string = 'dd MMM yyyy'): string {
  if (!dateString) return 'N/A';
  try {
    const parsed = parseISO(dateString);
    if (isNaN(parsed.getTime())) return 'Invalid Date';
    return format(parsed, dateFormat);
  } catch (error) {
    return 'Invalid Date';
  }
}

export function calculateDueDate(startDate: string, monthNumber: number): string {
  const start = parseISO(startDate);
  return addMonths(start, monthNumber -1).toISOString(); // monthNumber is 1-indexed
}

export function getPaymentStatus(payment: Payment, schemeStartDate: string): PaymentStatus {
  const dueDate = startOfDay(parseISO(payment.dueDate));
  const today = startOfDay(new Date());

  if (payment.amountPaid !== undefined && payment.amountPaid !== null && payment.amountPaid >= payment.amountExpected) {
    return 'Paid';
  }
  
  if (isFuture(startOfDay(parseISO(schemeStartDate)))) {
    return 'Upcoming';
  }

  if (isPast(dueDate)) { 
    return 'Overdue';
  }
  
  return 'Pending';
}


export function generatePaymentsForScheme(scheme: Omit<Scheme, 'payments' | 'status' | 'closureDate'>): Payment[] {
  const payments: Payment[] = [];
  for (let i = 1; i <= scheme.durationMonths; i++) {
    const dueDate = calculateDueDate(scheme.startDate, i);
    const paymentBase: Payment = { 
      id: `${scheme.id}-month-${i}`,
      schemeId: scheme.id,
      monthNumber: i,
      dueDate: dueDate,
      amountExpected: scheme.monthlyPaymentAmount,
      status: 'Upcoming', 
    };
    payments.push(paymentBase);
  }
  payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  return payments;
}

export function getSchemeStatus(scheme: Scheme): SchemeStatus {
  // The 'isArchived' flag is now the source of truth for the archived state.
  // This function should determine the scheme's status based on its payments and closure date,
  // irrespective of its archived state. UI components will use 'isArchived' for display purposes.

  // Ensure all individual payment statuses are up-to-date for accurate calculation
  // (This assumes scheme.payments is already filtered for non-deleted payments)
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  
  // If a scheme has a closureDate, it is considered 'Closed' by manual action.
  if (scheme.closureDate) {
    return 'Closed';
  }
  
  const allPaymentsPaid = scheme.payments.every(p => p.status === 'Paid');
  if (allPaymentsPaid) {
    return 'Fully Paid'; // All payments made, but not yet manually 'Closed'.
  }

  const schemeStartDate = startOfDay(parseISO(scheme.startDate));
  if (isFuture(schemeStartDate)) return 'Upcoming';

  const hasOverduePayment = scheme.payments.some(p => p.status === 'Overdue');
  if (hasOverduePayment) return 'Overdue';
  
  return 'Active';
}


export function calculateSchemeTotals(scheme: Scheme): Partial<Scheme> {
  const totalCollected = scheme.payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalExpected = scheme.payments.reduce((sum, p) => sum + p.amountExpected, 0);
  const paymentsMadeCount = scheme.payments.filter(p => p.status === 'Paid').length;
  return {
    totalCollected,
    totalRemaining: totalExpected - totalCollected,
    paymentsMadeCount,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 6); // Generates a 6-character string
}

