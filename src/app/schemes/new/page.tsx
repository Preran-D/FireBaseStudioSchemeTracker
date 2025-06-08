
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Correct import for App Router
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SchemeForm } from '@/components/forms/SchemeForm';
import type { Scheme } from '@/types/scheme';
import { addMockScheme, updateMockSchemePayment } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { formatISO } from 'date-fns';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function NewSchemePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [newlyCreatedScheme, setNewlyCreatedScheme] = useState<Scheme | null>(null);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState<string>('');

  const handleSubmit = (data: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'>) => {
    setIsLoading(true); // For initial scheme creation
    try {
      const newScheme = addMockScheme(data);
      setNewlyCreatedScheme(newScheme);
      if (newScheme.payments.length > 0) {
        setFirstPaymentAmount(newScheme.payments[0].amountExpected.toString());
      }
      toast({
        title: 'Scheme Created',
        description: `Scheme for ${newScheme.customerName} created. You can now record the first payment.`,
      });
      setIsAlertOpen(true);
      setIsLoading(false); // Scheme creation done, form is no longer loading
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create scheme. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleRecordFirstPayment = () => {
    if (!newlyCreatedScheme || newlyCreatedScheme.payments.length === 0) return;
    
    const amountToPay = parseFloat(firstPaymentAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) {
        toast({ title: 'Invalid Amount', description: 'Please enter a valid positive amount for the payment.', variant: 'destructive'});
        return; // Don't proceed if amount is invalid
    }
    
    setIsLoading(true); // Indicate processing for payment recording

    const firstPayment = newlyCreatedScheme.payments[0];
    const updatedScheme = updateMockSchemePayment(newlyCreatedScheme.id, firstPayment.id, {
      amountPaid: amountToPay,
      paymentDate: formatISO(new Date()), // Record as today
    });

    if (updatedScheme) {
      toast({ title: 'First Payment Recorded', description: `Payment of ${formatCurrency(amountToPay)} for ${newlyCreatedScheme.customerName} recorded.` });
    } else {
      toast({ title: 'Payment Recording Failed', description: 'Could not record the first payment.', variant: 'destructive' });
    }
    setIsAlertOpen(false);
    router.push(`/schemes/${newlyCreatedScheme.id}`);
    setIsLoading(false); 
  };

  const handleSkipFirstPayment = () => {
    if (!newlyCreatedScheme) return;
    setIsAlertOpen(false);
    router.push(`/schemes/${newlyCreatedScheme.id}`);
    setIsLoading(false); 
  };

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Add New Scheme</CardTitle>
            <CardDescription>Enter the details for the new customer scheme.</CardDescription>
          </CardHeader>
          <CardContent>
            <SchemeForm onSubmit={handleSubmit} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>

      {newlyCreatedScheme && newlyCreatedScheme.payments.length > 0 && (
        <AlertDialog 
            open={isAlertOpen} 
            onOpenChange={(open) => {
                if (!open && newlyCreatedScheme) { // Dialog dismissed (e.g. Esc, click outside)
                    // Only navigate if not already handled by button clicks
                    // Check if still loading (which means a button action is in progress)
                    if (!isLoading) {
                         handleSkipFirstPayment();
                    }
                }
                // setIsAlertOpen(open); // Not strictly needed if we always navigate
            }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Record First Payment for {newlyCreatedScheme.customerName}?</AlertDialogTitle>
              <AlertDialogDescription>
                The first payment (Month 1) is due on {formatDate(newlyCreatedScheme.payments[0].dueDate)}.
                Expected amount: {formatCurrency(newlyCreatedScheme.payments[0].amountExpected)}.
                <br />
                You can record it now or do it later from the scheme details page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="firstPaymentAmount">Amount Paid (INR)</Label>
              <Input
                id="firstPaymentAmount"
                type="number"
                value={firstPaymentAmount}
                onChange={(e) => setFirstPaymentAmount(e.target.value)}
                placeholder={`e.g., ${newlyCreatedScheme.payments[0].amountExpected}`}
                disabled={isLoading}
              />
              {parseFloat(firstPaymentAmount) > 0 && parseFloat(firstPaymentAmount) % 500 !== 0 && newlyCreatedScheme.payments[0].amountExpected % 500 !== 0 && (
                 <p className="text-xs text-muted-foreground">Consider amounts in multiples of 500 for simpler tracking, if appropriate for this scheme.</p>
               )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleSkipFirstPayment} disabled={isLoading}>Skip & View Scheme</AlertDialogCancel>
              <AlertDialogAction onClick={handleRecordFirstPayment} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Record
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
