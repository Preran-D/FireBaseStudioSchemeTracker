
'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SchemeForm } from '@/components/forms/SchemeForm';
import type { Scheme } from '@/types/scheme';
import { addMockScheme, updateMockSchemePayment, getMockSchemes, getUniqueGroupNames } from '@/lib/mock-data'; // Added getUniqueGroupNames
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { formatISO } from 'date-fns';
import { formatCurrency, formatDate } from '@/lib/utils';

type NewSchemeFormData = Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'> & {
  customerGroupName?: string;
  monthlyPaymentAmount: number; 
};


export default function NewSchemePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false); // For form submission only
  
  const [isFirstPaymentAlertOpen, setIsFirstPaymentAlertOpen] = useState(false);
  const [newlyCreatedScheme, setNewlyCreatedScheme] = useState<Scheme | null>(null);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState<string>('');

  const [isCustomerExistsAlertOpen, setIsCustomerExistsAlertOpen] = useState(false);
  const [formDataForConfirmation, setFormDataForConfirmation] = useState<NewSchemeFormData | null>(null);

  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);

  useEffect(() => {
    setExistingGroupNames(getUniqueGroupNames());
  }, []);


  const proceedWithSchemeCreation = (data: NewSchemeFormData) => {
    setIsFormLoading(true); 
    try {
      const newScheme = addMockScheme({
        customerName: data.customerName,
        startDate: data.startDate,
        monthlyPaymentAmount: data.monthlyPaymentAmount,
        customerGroupName: data.customerGroupName, 
      });
      setNewlyCreatedScheme(newScheme);
      if (newScheme.payments.length > 0) {
        setFirstPaymentAmount(newScheme.payments[0].amountExpected.toString());
      }
      toast({
        title: 'Scheme Created',
        description: `Scheme for ${newScheme.customerName} ${newScheme.customerGroupName ? `(Group: ${newScheme.customerGroupName})` : ''} created. You can now record the first payment.`,
      });
      setIsFirstPaymentAlertOpen(true);
      setIsFormLoading(false); 
    } catch (error) {
      toast({
        title: 'Error Creating Scheme',
        description: 'Failed to create scheme. Please try again.',
        variant: 'destructive',
      });
      setIsFormLoading(false);
    }
  };

  const handleSubmit = (data: NewSchemeFormData) => {
    setIsFormLoading(true); 
    const allSchemes = getMockSchemes();
    const customerExists = allSchemes.some(
      (s) => s.customerName.trim().toLowerCase() === data.customerName.trim().toLowerCase()
    );

    if (customerExists) {
      setFormDataForConfirmation(data);
      setIsCustomerExistsAlertOpen(true);
      setIsFormLoading(false); 
    } else {
      proceedWithSchemeCreation(data);
    }
  };

  const handleCustomerExistsConfirmation = () => {
    if (formDataForConfirmation) {
      proceedWithSchemeCreation(formDataForConfirmation);
    }
    setIsCustomerExistsAlertOpen(false);
    setFormDataForConfirmation(null);
  };

  const handleRecordFirstPayment = () => {
    if (!newlyCreatedScheme || newlyCreatedScheme.payments.length === 0) return;
    
    const amountToPay = parseFloat(firstPaymentAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) {
        toast({ title: 'Invalid Amount', description: 'Please enter a valid positive amount for the payment.', variant: 'destructive'});
        return;
    }
    
    setIsLoading(true); 

    const firstPayment = newlyCreatedScheme.payments[0];
    const updatedScheme = updateMockSchemePayment(newlyCreatedScheme.id, firstPayment.id, {
      amountPaid: amountToPay,
      paymentDate: formatISO(new Date()),
      modeOfPayment: ['Cash'], 
    });

    if (updatedScheme) {
      toast({ title: 'First Payment Recorded', description: `Payment of ${formatCurrency(amountToPay)} for ${newlyCreatedScheme.customerName} recorded.` });
    } else {
      toast({ title: 'Payment Recording Failed', description: 'Could not record the first payment.', variant: 'destructive' });
    }
    setIsFirstPaymentAlertOpen(false);
    router.push(`/schemes/${newlyCreatedScheme.id}`);
    setIsLoading(false); 
  };

  const handleSkipFirstPayment = () => {
    if (!newlyCreatedScheme) return;
    setIsFirstPaymentAlertOpen(false);
    router.push(`/schemes/${newlyCreatedScheme.id}`);
    setIsLoading(false); 
  };

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Add New Scheme</CardTitle>
            <CardDescription>Enter the details for the new customer scheme. You can assign it to an existing group or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <SchemeForm 
              onSubmit={handleSubmit} 
              isLoading={isFormLoading} 
              existingGroupNames={existingGroupNames}
            />
          </CardContent>
        </Card>
      </div>

      {formDataForConfirmation && (
        <AlertDialog open={isCustomerExistsAlertOpen} onOpenChange={setIsCustomerExistsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Customer Exists</AlertDialogTitle>
              <AlertDialogDescription>
                A customer named '{formDataForConfirmation.customerName}' already exists. 
                Do you want to create a new scheme for this customer?
                {formDataForConfirmation.customerGroupName && ` This new scheme will be part of group: ${formDataForConfirmation.customerGroupName}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsCustomerExistsAlertOpen(false);
                setFormDataForConfirmation(null);
              }}>Cancel / Change Name</AlertDialogCancel>
              <AlertDialogAction onClick={handleCustomerExistsConfirmation}>
                Yes, Create Scheme
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {newlyCreatedScheme && newlyCreatedScheme.payments.length > 0 && (
        <AlertDialog 
            open={isFirstPaymentAlertOpen} 
            onOpenChange={(open) => {
                if (!open && newlyCreatedScheme) {
                    if (!isLoading) { 
                         handleSkipFirstPayment();
                    }
                }
            }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Record First Payment for {newlyCreatedScheme.customerName}?</AlertDialogTitle>
              <AlertDialogDescription>
                The first payment (Month 1) is due on {formatDate(newlyCreatedScheme.payments[0].dueDate)}.
                Expected amount: {formatCurrency(newlyCreatedScheme.payments[0].amountExpected)}.
                {newlyCreatedScheme.customerGroupName && ` This scheme is part of group: ${newlyCreatedScheme.customerGroupName}.`}
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
              {parseFloat(firstPaymentAmount) > 0 && parseFloat(firstPaymentAmount) !== newlyCreatedScheme.payments[0].amountExpected && newlyCreatedScheme.monthlyPaymentAmount % 500 !== 0 && (
                 <p className="text-xs text-muted-foreground">Consider amounts in multiples of 500 INR for simpler tracking, if appropriate for this scheme type.</p>
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
