
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SchemeForm } from '@/components/forms/SchemeForm';
import type { Scheme, PaymentMode } from '@/types/scheme';
import { addMockScheme, updateMockSchemePayment, getMockSchemes, getUniqueGroupNames } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { formatISO } from 'date-fns';
import { formatCurrency, formatDate } from '@/lib/utils';

type NewSchemeFormData = Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths' | 'closureDate'> & {
  customerGroupName?: string;
  monthlyPaymentAmount: number; 
};

type SchemeFormInitialValues = Omit<NewSchemeFormData, 'monthlyPaymentAmount' | 'startDate'> & {
  monthlyPaymentAmount?: string | number; 
  startDate?: Date;
  groupOption?: 'none' | 'existing' | 'new';
  existingGroupName?: string;
  newGroupName?: string;
};

const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

export default function NewSchemePage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false); 
  const [isFormLoading, setIsFormLoading] = useState(false);
  
  const [isFirstPaymentAlertOpen, setIsFirstPaymentAlertOpen] = useState(false);
  const [newlyCreatedScheme, setNewlyCreatedScheme] = useState<Scheme | null>(null);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState<string>('');
  const [firstPaymentModeOfPayment, setFirstPaymentModeOfPayment] = useState<PaymentMode[]>(['Cash']);


  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);

  useEffect(() => {
    setExistingGroupNames(getUniqueGroupNames());
  }, []);

  const formDefaultValues = useMemo(() => {
    const customerNameParam = searchParams.get('customerName');
    const groupNameParam = searchParams.get('customerGroupName');
    const amountParam = searchParams.get('monthlyPaymentAmount');

    let groupOption: 'none' | 'existing' | 'new' = 'none';
    let existingGroupVal = '';
    let newGroupVal = '';

    if (groupNameParam) {
        if (existingGroupNames.includes(groupNameParam)) {
            groupOption = 'existing';
            existingGroupVal = groupNameParam;
        } else {
            groupOption = 'new';
            newGroupVal = groupNameParam;
        }
    } else {
        groupOption = 'none';
    }
    
    const initialValues: SchemeFormInitialValues = {
        customerName: customerNameParam || '',
        startDate: new Date(), 
        monthlyPaymentAmount: amountParam || '', 
        groupOption: groupOption,
        existingGroupName: existingGroupVal,
        newGroupName: newGroupVal,
        customerPhone: searchParams.get('customerPhone') || '',
        customerAddress: searchParams.get('customerAddress') || '',
    };
    return initialValues;
  }, [searchParams, existingGroupNames]);


  const handleSubmit = (data: NewSchemeFormData) => {
    setIsFormLoading(true);
    const allSchemes = getMockSchemes();
    const trimmedNewCustomerName = data.customerName.trim().toLowerCase();
    
    const customerExists = allSchemes.some(
      (s) => s.customerName.trim().toLowerCase() === trimmedNewCustomerName
    );

    const customerNameFromParams = searchParams.get('customerName');
    const trimmedCustomerNameFromParams = customerNameFromParams?.trim().toLowerCase();

    // Prevent creating a new customer if name exists AND
    // (we didn't navigate from their details page OR the name was changed from the pre-filled one to another existing name)
    if (customerExists && (!trimmedCustomerNameFromParams || trimmedCustomerNameFromParams !== trimmedNewCustomerName)) {
      toast({
        title: 'Duplicate Customer Name',
        description: `A customer named '${data.customerName}' already exists. Please use a different name, or add a new scheme for this customer via their details page.`,
        variant: 'destructive',
      });
      setIsFormLoading(false);
      return;
    }
    
    if (customerExists && trimmedCustomerNameFromParams && trimmedCustomerNameFromParams === trimmedNewCustomerName) {
      toast({
        title: 'Existing Customer',
        description: `Creating new scheme for existing customer: ${data.customerName}.`,
      });
    }
    
    try {
      const newScheme = addMockScheme({
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        startDate: data.startDate, 
        monthlyPaymentAmount: data.monthlyPaymentAmount,
        customerGroupName: data.customerGroupName,
      });
      setNewlyCreatedScheme(newScheme);
      if (newScheme.payments.length > 0) {
        setFirstPaymentAmount(newScheme.payments[0].amountExpected.toString());
      }
      setFirstPaymentModeOfPayment(['Cash']); // Reset mode of payment for new dialog
      toast({
        title: 'Scheme Created',
        description: `Scheme for ${newScheme.customerName} (ID: ${newScheme.id.toUpperCase()}) ${newScheme.customerGroupName ? `(Group: ${newScheme.customerGroupName})` : ''} created. You can now record the first payment.`,
      });
      setIsFirstPaymentAlertOpen(true);
    } catch (error) {
      toast({
        title: 'Error Creating Scheme',
        description: (error as Error).message || 'Failed to create scheme. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsFormLoading(false);
    }
  };


  const handleRecordFirstPayment = () => {
    if (!newlyCreatedScheme || newlyCreatedScheme.payments.length === 0) return;
    
    const amountToPay = parseFloat(firstPaymentAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) {
        toast({ title: 'Invalid Amount', description: 'Please enter a valid positive amount for the payment.', variant: 'destructive'});
        return;
    }
    if (firstPaymentModeOfPayment.length === 0) {
        toast({ title: 'Mode of Payment Required', description: 'Please select at least one mode of payment.', variant: 'destructive'});
        return;
    }
    
    setIsLoading(true); 

    const firstPayment = newlyCreatedScheme.payments[0];
    const updatedScheme = updateMockSchemePayment(newlyCreatedScheme.id, firstPayment.id, {
      amountPaid: amountToPay,
      paymentDate: formatISO(new Date()),
      modeOfPayment: firstPaymentModeOfPayment, 
    });

    if (updatedScheme) {
      toast({ title: 'First Payment Recorded', description: `Payment of ${formatCurrency(amountToPay)} for ${newlyCreatedScheme.customerName} recorded.` });
    } else {
      toast({ title: 'Payment Recording Failed', description: 'Could not record the first payment.', variant: 'destructive' });
    }
    setIsFirstPaymentAlertOpen(false);
    const schemeIdToNav = newlyCreatedScheme.id;
    setNewlyCreatedScheme(null); // Clear the scheme after handling
    router.push(`/schemes/${updatedScheme ? updatedScheme.id : schemeIdToNav}`);
  };

  const handleSkipFirstPayment = () => {
    if (!newlyCreatedScheme) return;
    setIsFirstPaymentAlertOpen(false);
    const schemeIdToNav = newlyCreatedScheme.id;
    setNewlyCreatedScheme(null); // Clear the scheme after handling
    router.push(`/schemes/${schemeIdToNav}`);
  };

  const isConfirmButtonDisabled = isLoading || 
                                  (parseFloat(firstPaymentAmount) > 0 && firstPaymentModeOfPayment.length === 0) ||
                                  (parseFloat(firstPaymentAmount) <= 0 && firstPaymentAmount !== '');


  return (
    <>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Add New Scheme</CardTitle>
            <CardDescription>
              Enter the details for the scheme. You can assign it to an existing group, create a new one, or leave it ungrouped. 
              Multiple schemes can be created for the same customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchemeForm 
              onSubmit={handleSubmit} 
              isLoading={isFormLoading} 
              existingGroupNames={existingGroupNames}
              defaultValuesOverride={formDefaultValues}
            />
          </CardContent>
        </Card>
      </div>

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
                The first payment (Month 1) for scheme ID {newlyCreatedScheme.id.toUpperCase()} is due on {formatDate(newlyCreatedScheme.payments[0].dueDate)}.
                Expected amount: {formatCurrency(newlyCreatedScheme.payments[0].amountExpected)}.
                {newlyCreatedScheme.customerGroupName && ` This scheme is part of group: ${newlyCreatedScheme.customerGroupName}.`}
                <br />
                You can record it now or do it later from the scheme details page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="firstPaymentAmount">Amount Paid (INR)</Label>
                <Input
                  id="firstPaymentAmount"
                  type="number"
                  value={firstPaymentAmount}
                  onChange={(e) => setFirstPaymentAmount(e.target.value)}
                  placeholder={`e.g., ${newlyCreatedScheme.payments[0].amountExpected}`}
                  disabled={isLoading}
                  className="mt-1"
                />
                {parseFloat(firstPaymentAmount) > 0 && parseFloat(firstPaymentAmount) !== newlyCreatedScheme.payments[0].amountExpected && newlyCreatedScheme.monthlyPaymentAmount % 500 !== 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Consider amounts in multiples of 500 INR for simpler tracking, if appropriate for this scheme type.</p>
                )}
              </div>
              <div>
                <Label>Mode of Payment</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                  {availablePaymentModes.map((mode) => (
                    <div key={mode} className="flex items-center space-x-2">
                      <Checkbox
                        id={`first-payment-mop-${mode}`}
                        checked={firstPaymentModeOfPayment.includes(mode)}
                        onCheckedChange={(checked) => {
                          setFirstPaymentModeOfPayment(prev => 
                            checked ? [...prev, mode] : prev.filter(m => m !== mode)
                          );
                        }}
                        disabled={isLoading}
                      />
                      <Label htmlFor={`first-payment-mop-${mode}`} className="font-normal">{mode}</Label>
                    </div>
                  ))}
                </div>
                {parseFloat(firstPaymentAmount) > 0 && firstPaymentModeOfPayment.length === 0 && (
                    <p className="text-xs text-destructive mt-1">Please select at least one mode of payment.</p>
                )}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleSkipFirstPayment} disabled={isLoading}>Skip & View Scheme</AlertDialogCancel>
              <AlertDialogAction onClick={handleRecordFirstPayment} disabled={isConfirmButtonDisabled}>
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

