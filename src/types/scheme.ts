
export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Upcoming';
export type PaymentMode = 'Card' | 'Cash' | 'UPI' | 'System Closure' | 'Imported';

export interface Payment {
  id: string; // Payment ID can remain string, as it's not the primary ID being changed
  schemeId: number;
  monthNumber: number; // 1-12
  dueDate: string; // ISO Date string
  paymentDate?: string; // ISO Date string
  amountExpected: number;
  amountPaid?: number;
  status: PaymentStatus;
  modeOfPayment?: PaymentMode[];
  deletedDate?: string; // Added for soft delete
}

export type SchemeStatus = 'Active' | 'Fully Paid' | 'Overdue' | 'Upcoming' | 'Closed' | 'Archived';

export interface Scheme {
  id: number;
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
  payments: Payment[];
  deletedDate?: string; // Added for soft delete
  isArchived?: boolean; // Added for archive feature
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
