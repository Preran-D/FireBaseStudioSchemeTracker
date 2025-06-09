
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Scheme } from '@/types/scheme';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Printer } from 'lucide-react';

interface PrintLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scheme: Scheme;
}

export function PrintLabelDialog({ isOpen, onClose, scheme }: PrintLabelDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Label Preview for Scheme {scheme.id.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            This is a preview of the information for the label. Use your Brother QL-810W software (e.g., P-touch Editor) to print the actual label using this data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-6">
          <div className="border p-4 w-full sm:w-80 h-auto bg-white text-black font-sans rounded-md shadow">
            <h3 className="text-xl font-bold mb-1 truncate">{scheme.customerName}</h3>
            <div className="space-y-0.5 text-sm">
              <p><span className="font-semibold">ID:</span> {scheme.id.toUpperCase()}</p>
              <p><span className="font-semibold">Starts:</span> {formatDate(scheme.startDate)}</p>
              <p><span className="font-semibold">Amount:</span> {formatCurrency(scheme.monthlyPaymentAmount)}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button type="button" onClick={onClose}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
