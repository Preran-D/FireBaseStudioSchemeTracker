
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Scheme } from '@/types/scheme';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Printer, Info } from 'lucide-react';
import React from 'react';

interface PrintLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scheme: Scheme;
}

export function PrintLabelDialog({ isOpen, onClose, scheme }: PrintLabelDialogProps) {
  const printableContentRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printableContentRef.current) {
      // Temporarily populate the hidden div for printing
      const nameEl = printableContentRef.current.querySelector<HTMLHeadingElement>("#print-customer-name");
      const idEl = printableContentRef.current.querySelector<HTMLParagraphElement>("#print-scheme-id");
      const startDateEl = printableContentRef.current.querySelector<HTMLParagraphElement>("#print-start-date");
      const amountEl = printableContentRef.current.querySelector<HTMLParagraphElement>("#print-amount");

      if (nameEl) nameEl.textContent = scheme.customerName;
      if (idEl) idEl.textContent = `ID: ${scheme.id.toUpperCase()}`;
      if (startDateEl) startDateEl.textContent = `Starts: ${formatDate(scheme.startDate)}`;
      if (amountEl) amountEl.textContent = `Amount: ${formatCurrency(scheme.monthlyPaymentAmount)}`;
      
      window.print();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Print Label for Scheme {scheme.id.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Preview the label information below. Click "Print This Label" to open your browser's print dialog.
            Ensure your Brother QL-810W printer is selected and paper size is correctly set (e.g., 62mm x 29mm).
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4">
          <p className="text-sm font-semibold mb-2">Label Preview:</p>
          <div className="border p-4 w-[235px] h-[110px] bg-white text-black font-sans rounded-md shadow-lg overflow-hidden flex flex-col justify-center items-start box-content" style={{ width: '62mm', height: '29mm', boxSizing: 'content-box' }}>
            <h3 className="text-sm font-bold mb-0.5 truncate" style={{ fontSize: '10pt', margin: '0 0 2px 0' }}>{scheme.customerName}</h3>
            <div className="space-y-0.5 text-xs" style={{ fontSize: '8pt' }}>
              <p className="my-0.5"><span className="font-semibold">ID:</span> {scheme.id.toUpperCase()}</p>
              <p className="my-0.5"><span className="font-semibold">Starts:</span> {formatDate(scheme.startDate)}</p>
              <p className="my-0.5"><span className="font-semibold">Amount:</span> {formatCurrency(scheme.monthlyPaymentAmount)}</p>
            </div>
          </div>
        </div>

        <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary"/>
            <span>
                The actual print output depends on your printer driver settings. You may need to adjust margins or scaling in the system print dialog for best results.
            </span>
        </div>

        {/* Hidden div for actual printing */}
        <div id="printableLabelArea" ref={printableContentRef} className="hidden">
          <h3 id="print-customer-name" style={{ fontSize: '10pt', fontWeight: 'bold', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}></h3>
          <p id="print-scheme-id" style={{ fontSize: '8pt', margin: '1px 0' }}></p>
          <p id="print-start-date" style={{ fontSize: '8pt', margin: '1px 0' }}></p>
          <p id="print-amount" style={{ fontSize: '8pt', margin: '1px 0' }}></p>
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print This Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
