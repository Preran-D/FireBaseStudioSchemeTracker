
export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Upcoming';
export type PaymentMode = 'Card' | 'Cash' | 'UPI';

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
}

export type SchemeStatus = 'Active' | 'Completed' | 'Overdue' | 'Upcoming';

export interface Scheme {
  id: string;
  customerName: string;
  customerGroupName?: string; // Added for grouping customers
  startDate: string; // ISO Date string
  monthlyPaymentAmount: number;
  durationMonths: 12;
  status: SchemeStatus;
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
}
