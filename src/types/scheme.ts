export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Upcoming';
export type PaymentMode = 'Card' | 'Cash' | 'UPI' | 'System Closure' | 'Imported';

export interface Payment {
  id: string;
  schemeId: string;
  monthNumber: number; // 1-12
  dueDate: string; // ISO Date string
  paymentDate?: string; // ISO Date string
  amountExpected: number;
  amountPaid?: number;
  status: PaymentStatus;
  modeOfPayment?: PaymentMode[];
  isArchived?: boolean;
  archivedDate?: string; // ISO Date string
}

export type SchemeStatus = 'Active' | 'Fully Paid' | 'Overdue' | 'Upcoming' | 'Closed' | 'Archived' | 'Trashed';

export interface Scheme {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGroupName?: string; // Added for grouping customers
  startDate: string; // ISO Date string
  monthlyPaymentAmount: number;
  durationMonths: 12;
  status: SchemeStatus;
  closureDate?: string; // ISO Date string, set when scheme is manually closed
  archivedDate?: string; // ISO Date string, set when scheme is archived
  isTrashed?: boolean; // Added for soft delete functionality
  payments: Payment[];
  // Calculated fields (optional, can be derived)
  totalCollected?: number;
  totalRemaining?: number;
  paymentsMadeCount?: number;
}

export interface GroupDetail {
  groupName: string;
  schemes: Scheme[];
  customerNames: string[];
  totalSchemesInGroup: number;
  recordableSchemeCount: number; // Number of schemes in this group with a next payment due
  hasOverdueSchemeInGroup: boolean; // Indicates if any scheme in the group is overdue
}

export interface MockGroup {
  groupName: string;
  isArchived?: boolean;
  archivedDate?: string; // ISO Date string
}
