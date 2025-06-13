
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SchemeForm } from '@/components/forms/SchemeForm';
import type { Scheme, PaymentMode } from '@/types/scheme';
// import { addMockScheme, updateMockSchemePayment, getMockSchemes, getUniqueGroupNames } from '@/lib/mock-data'; // Replaced
import { addSupabaseScheme, getUniqueSupabaseGroupNames } from '@/lib/supabase-data'; // Added addSupabaseScheme
import { useToast } from '@/hooks/use-toast';
// AlertDialog for first payment will be removed for now to simplify Supabase integration.
// import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft } from 'lucide-react';
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
  // const [isLoading, setIsLoading] = useState(false); // This was for first payment dialog, removing
  const [isFormLoading, setIsFormLoading] = useState(false);
  
  // States for "Record First Payment" dialog - removing these
  // const [isFirstPaymentAlertOpen, setIsFirstPaymentAlertOpen] = useState(false);
  // const [newlyCreatedScheme, setNewlyCreatedScheme] = useState<Scheme | null>(null);
  // const [firstPaymentAmount, setFirstPaymentAmount] = useState<string>('');
  // const [firstPaymentModeOfPayment, setFirstPaymentModeOfPayment] = useState<PaymentMode[]>(['Cash']);


  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchGroupNames = async () => {
      try {
        const names = await getUniqueSupabaseGroupNames();
        setExistingGroupNames(names);
      } catch (error) {
        console.error("Failed to fetch group names:", error);
        toast({ title: "Error", description: "Could not fetch existing group names.", variant: "destructive" });
      }
    };
    fetchGroupNames();
  }, [toast]);

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


  const handleSubmit = async (data: NewSchemeFormData) => {
    setIsFormLoading(true);
    // const allSchemes = getMockSchemes(); // Not fetching all schemes for client-side duplicate check anymore. DB will handle constraints if any.
    // const trimmedNewCustomerName = data.customerName.trim().toLowerCase();
    
    // Duplicate customer check can be removed or handled differently.
    // For now, focusing on Supabase integration. The DB might have its own constraints.
    // The previous duplicate check was:
    // const customerExists = allSchemes.some(
    //   (s) => s.customerName.trim().toLowerCase() === trimmedNewCustomerName
    // );
    // ...toast for duplicate...

    try {
      // Data needs to be shaped for addSupabaseScheme
      // addSupabaseScheme expects Omit<Scheme, 'id' | 'payments' | 'status' | ...calculatedFields>
      // Ensure startDate is in ISO format. data.startDate is already a string from the form.
      // If it were a Date object: startDate: formatISO(data.startDate as Date)
      // For now, assuming data.startDate from form is 'yyyy-MM-dd' and needs to be ISO string.
      // The form should ideally provide it in a way that's easily convertible or already ISO.
      // For `addSupabaseScheme`, `durationMonths` is part of the input type.
      // The `NewSchemeFormData` omits `durationMonths`, so we'll use a default or ensure form provides it.
      // Assuming a default durationMonths if not provided by form, e.g., 12, or it's part of `data`

      const schemePayload = {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        startDate: data.startDate, // Ensure this is an ISO string. SchemeForm should handle this.
        monthlyPaymentAmount: Number(data.monthlyPaymentAmount), // Ensure it's a number
        durationMonths: 12, // Defaulting to 12 as it's not in NewSchemeFormData. Or add it to form.
                            // For now, let's assume it's part of `data` or a fixed default is acceptable.
                            // If `data.durationMonths` is available from form, use `data.durationMonths`.
        customerGroupName: data.customerGroupName, // This is optional
        // closureDate and archivedDate are not set on creation
      };

      const newScheme = await addSupabaseScheme(schemePayload);

      if (newScheme && newScheme.id) {
        toast({
          title: 'Scheme Created Successfully',
          description: `Scheme for ${newScheme.customerName} ${newScheme.customerGroupName ? `(Group: ${newScheme.customerGroupName})` : ''} created.`,
        });
        router.push(`/schemes/${newScheme.id}`); // Redirect to the new scheme's detail page
      } else {
        throw new Error("Scheme creation failed or returned no data."); // Triggers catch block
      }
    } catch (error) {
      console.error("Error creating scheme:", error);
      toast({
        title: 'Error Creating Scheme',
        description: (error instanceof Error ? error.message : null) || 'Failed to create scheme. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsFormLoading(false);
    }
  };

  // Removed handleRecordFirstPayment, handleSkipFirstPayment, and isConfirmButtonDisabled
  // as the first payment dialog is removed.

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
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

      {/* First Payment AlertDialog removed */}
    </>
  );
}
