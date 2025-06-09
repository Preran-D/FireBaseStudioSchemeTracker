
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

  // Refs for the static elements within the printable area
  const customerNameRef = React.useRef<HTMLHeadingElement>(null);
  const schemeIdRef = React.useRef<HTMLParagraphElement>(null);
  const startDateRef = React.useRef<HTMLParagraphElement>(null);
  const amountRef = React.useRef<HTMLParagraphElement>(null);


  const handlePrint = () => {
    if (!printableContentRef.current || !customerNameRef.current || !schemeIdRef.current || !startDateRef.current || !amountRef.current) {
      console.error("PrintLabelDialog Error: One or more refs for printable content are null.");
      alert("Error: Printable area or its elements not found. Cannot print.");
      return;
    }
    if (!scheme) {
      console.error("PrintLabelDialog Error: Scheme data is missing.");
      alert("Error: Scheme data not available. Cannot print.");
      return;
    }

    // Populate the static elements
    customerNameRef.current.textContent = scheme.customerName;
    schemeIdRef.current.textContent = `ID: ${scheme.id.toUpperCase()}`;
    startDateRef.current.textContent = `Starts: ${formatDate(scheme.startDate)}`;
    amountRef.current.textContent = `Amount: ${formatCurrency(scheme.monthlyPaymentAmount)}`;
    
    console.log("PrintLabelDialog: HTML for printing:", printableContentRef.current.innerHTML);
    
    window.print();
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
            Preview the label information below.
            <strong className="block mt-1">Important: When your browser's print dialog opens, ensure your Brother QL-810W (or correct label printer) is selected as the "Destination". Also, verify the "Paper size" is correctly set to your label dimensions (e.g., 62mm x 29mm).</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4">
          <p className="text-sm font-semibold mb-2">Label Preview (approx. 62mm x 29mm):</p>
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

        {/* Div for actual printing - positioned off-screen by CSS for screen view */}
        <div id="printableLabelArea" ref={printableContentRef}>
          {/* Static elements to be populated by JS */}
          <h3 ref={customerNameRef}></h3>
          <p ref={schemeIdRef}></p>
          <p ref={startDateRef}></p>
          <p ref={amountRef}></p>
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
