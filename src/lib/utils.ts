
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
  // If the scheme is already marked as 'Archived', its status should remain 'Archived'.
  if (scheme.status === 'Archived') {
    return 'Archived';
  }

  // Filter out archived payments for status calculation logic that depends on payment states
  const nonArchivedPayments = scheme.payments.filter(p => !p.isArchived);

  // Ensure all individual non-archived payment statuses are up-to-date for accurate calculation
  nonArchivedPayments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  
  // If a scheme has a closureDate, it is considered 'Closed' by manual action.
  if (scheme.closureDate) {
    return 'Closed';
  }
  
  // Check conditions based on non-archived payments
  const allPaymentsPaid = nonArchivedPayments.length > 0 && nonArchivedPayments.every(p => p.status === 'Paid');
  if (allPaymentsPaid) {
    return 'Fully Paid'; // All non-archived payments made, but not yet manually 'Closed'.
  }

  const schemeStartDate = startOfDay(parseISO(scheme.startDate));
  if (isFuture(schemeStartDate) && nonArchivedPayments.every(p => p.status === 'Upcoming')) {
    // If scheme start date is in future, and all non-archived payments are upcoming
    return 'Upcoming';
  }

  const hasOverduePayment = nonArchivedPayments.some(p => p.status === 'Overdue');
  if (hasOverduePayment) return 'Overdue';
  
  // If there are no non-archived payments (e.g., all payments were archived)
  // and the scheme is not closed or fully paid based on original intent,
  // its status might be ambiguous or default to 'Active' if start date is past.
  // Or, it could be a new status like 'AttentionNeeded' or similar if all payments archived.
  // For now, if not 'Upcoming', 'Overdue', 'Fully Paid', 'Closed', 'Archived', it's 'Active'.
  if (isPast(schemeStartDate)) return 'Active';

  // Default fallback, though scenarios like all payments being upcoming but scheme start date is past
  // should be handled by 'Active' or specific logic.
  return 'Active';
}


export function calculateSchemeTotals(scheme: Scheme): Partial<Scheme> {
  const nonArchivedPayments = scheme.payments.filter(p => !p.isArchived);

  const totalCollected = nonArchivedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  // Total expected should consider all original payments unless explicitly stated otherwise.
  // If archiving a payment means it's no longer expected, then filter here too.
  // For now, assuming totalExpected is based on the original full scheme value.
  const totalExpected = scheme.payments.reduce((sum, p) => sum + p.amountExpected, 0);
  const paymentsMadeCount = nonArchivedPayments.filter(p => p.status === 'Paid').length;
  return {
    totalCollected,
    totalRemaining: totalExpected - totalCollected, // This might need refinement based on how archived payments affect expectation
    paymentsMadeCount,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 6); // Generates a 6-character string
}

