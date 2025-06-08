
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addMonths, differenceInDays, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import type { Scheme, Payment, SchemeStatus, PaymentStatus } from '@/types/scheme';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | undefined | null, currency: string = 'INR'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
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
  // If a scheme is explicitly marked 'Completed' (e.g. via manual closure), that status persists.
  if (scheme.status === 'Completed') {
    return 'Completed';
  }

  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  
  const schemeStartDate = startOfDay(parseISO(scheme.startDate));

  if (isFuture(schemeStartDate)) return 'Upcoming';

  // Check for overdue payments only if not already 'Completed'
  const hasOverduePayment = scheme.payments.some(p => p.status === 'Overdue');
  if (hasOverduePayment) return 'Overdue';
  
  const allPaymentsEffectivelyMade = scheme.payments.every(p => p.status === 'Paid');
  // If scheme duration has passed and not all payments made and not marked completed, it's Overdue.
  const lastPayment = scheme.payments[scheme.payments.length - 1];
  if (lastPayment && isPast(startOfDay(parseISO(lastPayment.dueDate))) && !allPaymentsEffectivelyMade) {
    return 'Overdue';
  }
  
  // If not upcoming, not overdue, and not explicitly completed, it's active.
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
  return Math.random().toString(36).substr(2, 9);
}
