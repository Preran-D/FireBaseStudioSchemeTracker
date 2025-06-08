
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addMonths, differenceInDays, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import type { Scheme, Payment, SchemeStatus, PaymentStatus } from '@/types/scheme';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | undefined | null, currency: string = 'INR'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'N/A'; // Added NaN check
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateString: string | undefined | null, dateFormat: string = 'dd MMM yyyy'): string {
  if (!dateString) return 'N/A';
  try {
    const parsed = parseISO(dateString);
    if (isNaN(parsed.getTime())) return 'Invalid Date'; // Check if date is valid
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
  
  // If the scheme itself hasn't started, all its payments are 'Upcoming'.
  if (isFuture(startOfDay(parseISO(schemeStartDate)))) {
    return 'Upcoming';
  }

  if (isPast(dueDate)) { // No need to check payment.status !== 'Paid' here, as the first if handles 'Paid'
    return 'Overdue';
  }
  
  // If due date is today or in the future, and not paid, it's 'Pending' or 'Upcoming'
  // For simplicity, if not paid and not overdue, consider it 'Pending'.
  // A more nuanced 'Upcoming' could be for payments > N days away, but 'Pending' works for now.
  return 'Pending';
}


export function generatePaymentsForScheme(scheme: Omit<Scheme, 'payments' | 'status'>): Payment[] {
  const payments: Payment[] = [];
  for (let i = 1; i <= scheme.durationMonths; i++) {
    const dueDate = calculateDueDate(scheme.startDate, i);
    const paymentBase: Payment = { // Define base structure for type safety
      id: `${scheme.id}-month-${i}`,
      schemeId: scheme.id,
      monthNumber: i,
      dueDate: dueDate,
      amountExpected: scheme.monthlyPaymentAmount,
      status: 'Upcoming', // Initial status, will be refined by getPaymentStatus
      // amountPaid, paymentDate, modeOfPayment will be undefined initially
    };
    payments.push(paymentBase);
  }
  // Update status for initial payments based on current date and scheme start date
  payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  return payments;
}

export function getSchemeStatus(scheme: Scheme): SchemeStatus {
  // First, ensure all payment statuses within the scheme are up-to-date
  scheme.payments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  
  const today = startOfDay(new Date());
  const schemeStartDate = startOfDay(parseISO(scheme.startDate));

  if (isFuture(schemeStartDate)) return 'Upcoming';

  const allPaymentsMade = scheme.payments.every(p => p.status === 'Paid');
  if (allPaymentsMade) return 'Completed';

  const hasOverduePayment = scheme.payments.some(p => p.status === 'Overdue');
  if (hasOverduePayment) return 'Overdue';
  
  // If scheme duration has passed and not all payments made, it's effectively Overdue from a scheme perspective.
  const lastPayment = scheme.payments[scheme.payments.length - 1];
  if (lastPayment && isPast(startOfDay(parseISO(lastPayment.dueDate))) && !allPaymentsMade) {
    return 'Overdue';
  }

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
