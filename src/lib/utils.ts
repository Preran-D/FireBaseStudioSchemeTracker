import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addMonths, differenceInDays, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import type { Scheme, Payment, SchemeStatus, PaymentStatus } from '@/types/scheme';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | undefined | null, currency: string = 'INR'): string {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateString: string | undefined | null, dateFormat: string = 'dd MMM yyyy'): string {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), dateFormat);
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

  if (payment.amountPaid && payment.amountPaid >= payment.amountExpected) {
    return 'Paid';
  }
  if (isPast(dueDate) && payment.status !== 'Paid') {
    return 'Overdue';
  }
  // Check if due date is today or in the near future (e.g. within 7 days) to be 'Pending'
  // For simplicity, if not paid and not overdue, consider it 'Pending' if it's the current/next expected payment
  // Otherwise, if it's far in the future, it's 'Upcoming'

  // This logic can be more complex. For now:
  // If the scheme hasn't started yet, all are upcoming.
  if (isFuture(parseISO(schemeStartDate))) return 'Upcoming';

  // If it's the current month's payment or past due
  if (dueDate <= today || differenceInDays(dueDate, today) <= 30) { // Crude check for current relevance
     return 'Pending';
  }
  
  return 'Upcoming';
}


export function generatePaymentsForScheme(scheme: Omit<Scheme, 'payments' | 'status'>): Payment[] {
  const payments: Payment[] = [];
  for (let i = 1; i <= scheme.durationMonths; i++) {
    const dueDate = calculateDueDate(scheme.startDate, i);
    payments.push({
      id: `${scheme.id}-month-${i}`,
      schemeId: scheme.id,
      monthNumber: i,
      dueDate: dueDate,
      amountExpected: scheme.monthlyPaymentAmount,
      status: 'Upcoming', // Initial status
    });
  }
  // Update status for initial payments based on current date
  payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  return payments;
}

export function getSchemeStatus(scheme: Scheme): SchemeStatus {
  const today = startOfDay(new Date());
  const schemeStartDate = startOfDay(parseISO(scheme.startDate));

  if (isFuture(schemeStartDate)) return 'Upcoming';

  const allPaymentsMade = scheme.payments.every(p => p.status === 'Paid');
  if (allPaymentsMade) return 'Completed';

  const hasOverduePayment = scheme.payments.some(p => getPaymentStatus(p, scheme.startDate) === 'Overdue');
  if (hasOverduePayment) return 'Overdue';
  
  const lastDueDate = startOfDay(parseISO(scheme.payments[scheme.payments.length - 1].dueDate));
  if (isPast(lastDueDate) && !allPaymentsMade) return 'Overdue'; // Scheme duration ended but not all paid

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
