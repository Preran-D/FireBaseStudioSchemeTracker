
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
  // If scheme is trashed, its status is 'Trashed'
  if (scheme.isTrashed === true) {
    return 'Trashed';
  }

  // If the scheme is already marked as 'Archived', its status should remain 'Archived'.
  // This check should come after 'Trashed' because a trashed scheme might have been archived prior.
  if (scheme.status === 'Archived') {
    return 'Archived';
  }

  // Ensure all individual payment statuses are up-to-date for accurate calculation
  // Only consider non-archived payments for status updates (except for the initial check)
  const activePayments = scheme.payments.filter(p => p.isArchived !== true);
  activePayments.forEach(p => p.status = getPaymentStatus(p, scheme.startDate));
  
  // If a scheme has a closureDate, it is considered 'Closed' by manual action.
  if (scheme.closureDate) {
    return 'Closed';
  }
  
  // Check against activePayments for completion
  const allPaymentsPaid = activePayments.length > 0 && activePayments.every(p => p.status === 'Paid');
  // Also, ensure the number of active (non-archived) payments matches the scheme duration,
  // otherwise, if some payments were archived, it might incorrectly appear 'Fully Paid'.
  // This assumes durationMonths refers to the number of installments expected to be paid.
  const expectedActivePaymentCount = scheme.durationMonths; // This might need adjustment if duration can change

  if (allPaymentsPaid && activePayments.length === expectedActivePaymentCount) {
    return 'Fully Paid'; // All *active* payments made, and no expected payments were archived unpaid.
  }

  const schemeStartDate = startOfDay(parseISO(scheme.startDate));
  if (isFuture(schemeStartDate)) return 'Upcoming';

  // Check for overdue among active payments
  const hasOverduePayment = activePayments.some(p => p.status === 'Overdue');
  if (hasOverduePayment) return 'Overdue';
  
  // If there are no active payments left and it's not Fully Paid (e.g., all were archived),
  // it might be considered 'Closed' implicitly or needs a specific status.
  // For now, if not Fully Paid, Upcoming, or Overdue, it's Active (implying payments are pending).
  // If activePayments.length is 0 and not fully paid, it's a strange state, possibly 'Closed' or error.
  // However, the 'Closed' status is primarily driven by closureDate.
  // If all payments are archived, and it's not manually closed, what is its status?
  // This logic implies it would be 'Active' if start date is past and no overdue, which seems wrong if no payments are left.
  // Let's refine: if all active payments are paid, but count is less than duration, it's still 'Active' (or needs review).
  // If activePayments.length === 0 AND it wasn't caught by allPaymentsPaid & count check, it's likely an edge case.
  // For now, the existing 'Active' fallback is kept.
  return 'Active';
}


export function calculateSchemeTotals(scheme: Scheme): Partial<Scheme> {
  const nonArchivedPayments = scheme.payments.filter(p => p.isArchived !== true);

  const totalCollected = nonArchivedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  // Total expected should consider all original payments, regardless of archival,
  // unless archival means it's written off. For current scope, assume totalExpected is fixed.
  // If an archived payment was expected, it still contributes to the original total expectation.
  // However, totalRemaining should reflect what's left of non-archived expected payments.
  const totalExpectedFromNonArchived = nonArchivedPayments.reduce((sum, p) => sum + p.amountExpected, 0);

  // Let's clarify totalExpected: Does it mean sum of all original installments or only non-archived?
  // For now, let's assume totalExpected is based on all original payments to reflect the scheme's full value.
  // But remaining should be based on what's actively being pursued.
  const schemeFullValue = scheme.payments.reduce((sum, p) => sum + p.amountExpected, 0);

  const paymentsMadeCount = nonArchivedPayments.filter(p => p.status === 'Paid').length;

  return {
    totalCollected, // Sum of actually paid amounts from non-archived payments
    totalRemaining: totalExpectedFromNonArchived - totalCollected, // What's left to be collected from active/pending non-archived payments
    paymentsMadeCount, // Count of non-archived payments that are 'Paid'
    // schemeFullValue, // Optional: if we want to store the original full value separately
  };
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 6); // Generates a 6-character string
}

