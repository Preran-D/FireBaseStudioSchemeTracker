
'use client';

import type { Scheme, Payment } from '@/types/scheme';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatCurrency, formatDate, getPaymentStatus } from '@/lib/utils'; // Ensure getPaymentStatus is imported
import { PaymentStatusBadge } from './PaymentStatusBadge';

interface SchemeHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  scheme: Scheme | null;
}

export function SchemeHistoryPanel({ isOpen, onClose, scheme }: SchemeHistoryPanelProps) {
  if (!scheme) {
    return null;
  }

  const paidPayments = scheme.payments.filter(p => p.status === 'Paid');
  const allPaymentsWithStatus = scheme.payments.map(p => ({
    ...p,
    // Ensure status is freshly calculated if not already done (though dashboard usually does this)
    currentStatus: getPaymentStatus(p, scheme.startDate) 
  }));


  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col z-[51]"> 
        <SheetHeader className="relative pr-8"> {/* Add padding to avoid overlap with close button */}
          <SheetTitle className="font-headline">Transaction History</SheetTitle>
          <SheetDescription>
            For {scheme.customerName} - Scheme ID: {scheme.id}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-grow my-4 pr-5">
          {allPaymentsWithStatus.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  {/* <TableHead>Status</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPaymentsWithStatus.map((payment) => (
                  <TableRow key={payment.id} className={payment.currentStatus === 'Paid' ? 'bg-green-500/5' : ''}>
                    <TableCell>{payment.monthNumber}</TableCell>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amountPaid ?? payment.amountExpected)}</TableCell>
                    <TableCell>{payment.modeOfPayment?.join(', ') || '-'}</TableCell>
                    <TableCell><PaymentStatusBadge status={payment.currentStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No payment history found for this scheme.</p>
          )}
        </ScrollArea>
         <div className="mt-auto border-t pt-4">
            <Button variant="outline" onClick={onClose} className="w-full">
                <X className="mr-2 h-4 w-4" /> Close Panel
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
