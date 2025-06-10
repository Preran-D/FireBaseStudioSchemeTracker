
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, DollarSign, Loader2, PieChart, Eye, CalendarIcon as CalendarIconLucide, Users2, PlusCircle, FileWarning, ListOrdered, Info, Pencil, ArrowLeft, CheckCircle, Plus, Minus, CreditCard, Landmark, Smartphone } from 'lucide-react';
import type { Scheme, Payment, PaymentMode, SchemeStatus } from '@/types/scheme';
import { getMockSchemeById, updateMockSchemePayment, closeMockScheme, getMockSchemes, getUniqueGroupNames, updateSchemeGroup, updateMockCustomerDetails } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { useToast } from '@/hooks/use-toast';
import { isPast, parseISO, formatISO, startOfDay, format as formatDateFns } from 'date-fns';
import { SchemeCompletionArc } from '@/components/shared/SchemeCompletionArc';
import { Label } from '@/components/ui/label';
import { AssignGroupDialog } from '@/components/dialogs/AssignGroupDialog';
import { EditCustomerDetailsDialog, type EditCustomerDetailsFormValues } from '@/components/dialogs/EditCustomerDetailsDialog';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel as HookFormLabel, FormMessage, FormDescription } from '@/components/ui/form'; // Using react-hook-form for inline payment
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';


const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];
const paymentModeIcons: Record<PaymentMode, React.ElementType> = {
  'Card': CreditCard,
  'Cash': Landmark,
  'UPI': Smartphone,
  'System Closure': FileWarning, // Or some other appropriate icon
  'Imported': FileWarning,
};

const inlinePaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  // monthsToPay will be managed by separate state, not part of this RHF schema directly for +/- buttons
  // modeOfPayment also by separate state for direct checkbox interaction
});
type InlinePaymentFormValues = z.infer<typeof inlinePaymentFormSchema>;


export default function SchemeDetailsPage() {
  const router = useRouter();
  const urlParams = useParams();
  const { toast } = useToast();
  const schemeIdFromUrl = urlParams.id as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isManualCloseDialogOpen, setIsManualCloseDialogOpen] = useState(false);
  const [schemeForManualCloseDialog, setSchemeForManualCloseDialog] = useState<Scheme | null>(null);
  const [manualClosureDate, setManualClosureDate] = useState<Date | undefined>(new Date());
  const [isProcessingManualClose, setIsProcessingManualClose] = useState(false);

  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);
  const [isAssignGroupDialogOpen, setIsAssignGroupDialogOpen] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  
  const [isEditCustomerDetailsDialogOpen, setIsEditCustomerDetailsDialogOpen] = useState(false);
  const [isUpdatingCustomerDetails, setIsUpdatingCustomerDetails] = useState(false);

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

  // State for Inline Payment Card
  const [inlineMonthsToPay, setInlineMonthsToPay] = useState(1);
  const [inlinePaymentModes, setInlinePaymentModes] = useState<PaymentMode[]>(['Cash']);
  const [isInlinePaymentProcessing, setIsInlinePaymentProcessing] = useState(false);

  const inlinePaymentForm = useForm<InlinePaymentFormValues>({
    resolver: zodResolver(inlinePaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
    },
    mode: 'onTouched',
  });


  const loadSchemeData = useCallback((currentSchemeId?: string) => {
    const idToLoad = currentSchemeId || schemeIdFromUrl;
    if (idToLoad) {
      setIsLoading(true);
      const fetchedScheme = getMockSchemeById(idToLoad);
      if (fetchedScheme) {
        setScheme(fetchedScheme);
        // Reset inline payment form when scheme data loads/reloads
        const initialMonths = (fetchedScheme.durationMonths - (fetchedScheme.paymentsMadeCount || 0)) > 0 ? 1 : 0;
        setInlineMonthsToPay(initialMonths);
        setInlinePaymentModes(['Cash']);
        inlinePaymentForm.reset({ paymentDate: new Date() });

      } else {
        setScheme(null); // Scheme not found
      }
      setExistingGroupNames(getUniqueGroupNames());
      setIsLoading(false);
    }
  }, [schemeIdFromUrl, inlinePaymentForm]);

  useEffect(() => {
    loadSchemeData();
  }, [loadSchemeData]);


  const openManualCloseDialog = (targetScheme: Scheme) => {
    if (targetScheme.status === 'Closed') return;
    setSchemeForManualCloseDialog(targetScheme);
    setManualClosureDate(startOfDay(new Date()));
    setIsManualCloseDialogOpen(true);
  };

  const handleConfirmManualCloseScheme = () => {
    if (!schemeForManualCloseDialog || !manualClosureDate) return;
    setIsProcessingManualClose(true);

    const closureOptions = {
      closureDate: formatISO(manualClosureDate),
      type: 'partial_closure' as 'partial_closure', 
    };

    const closedSchemeResult = closeMockScheme(schemeForManualCloseDialog.id, closureOptions);
    if (closedSchemeResult) {
      setScheme(closedSchemeResult); // Update current scheme state
      toast({ title: 'Scheme Manually Closed', description: `${closedSchemeResult.customerName}'s scheme (ID: ${closedSchemeResult.id.toUpperCase()}) has been marked as 'Closed'.` });
    } else {
      toast({ title: 'Error', description: 'Failed to manually close scheme.', variant: 'destructive' });
    }
    setIsManualCloseDialogOpen(false);
    setIsProcessingManualClose(false);
    setSchemeForManualCloseDialog(null);
  };


  const handleAssignGroupSubmit = (updatedSchemeId: string, groupName?: string) => {
    setIsUpdatingGroup(true);
    const updatedSchemeFromMock = updateSchemeGroup(updatedSchemeId, groupName);
    if (updatedSchemeFromMock) {
      setScheme(updatedSchemeFromMock); // Update current scheme state
      toast({
        title: "Group Updated",
        description: `Scheme for ${updatedSchemeFromMock.customerName} has been ${groupName ? `assigned to group "${groupName}"` : 'removed from group'}.`,
      });
    } else {
      toast({ title: "Error", description: "Failed to update scheme group.", variant: "destructive" });
    }
    setIsAssignGroupDialogOpen(false);
    setIsUpdatingGroup(false);
  };
  
  const handleEditCustomerDetailsSubmit = (
    originalName: string,
    newDetails: EditCustomerDetailsFormValues
  ) => {
    setIsUpdatingCustomerDetails(true);
    const result = updateMockCustomerDetails(originalName, newDetails);

    if (result.success && result.updatedSchemes) {
      toast({
        title: 'Customer Details Updated',
        description: `Details for ${newDetails.customerName} have been updated.`,
      });
      // If current scheme's customer name changed, reload its data
      if (newDetails.customerName !== originalName && scheme && result.updatedSchemes.some(s => s.id === scheme.id)) {
        loadSchemeData(scheme.id); 
      } else {
        // If name didn't change but other details might affect current scheme display (unlikely here but good practice)
        loadSchemeData();
      }
    } else {
      toast({
        title: 'Error',
        description: result.message || 'Failed to update customer details.',
        variant: 'destructive',
      });
    }
    setIsEditCustomerDetailsDialogOpen(false);
    setIsUpdatingCustomerDetails(false);
  };

  const handleAddNewSchemeForCustomer = () => {
    if (!scheme) return;
    const queryParams = new URLSearchParams();
    queryParams.append('customerName', scheme.customerName);
    if(scheme.customerPhone) queryParams.append('customerPhone', scheme.customerPhone);
    if(scheme.customerAddress) queryParams.append('customerAddress', scheme.customerAddress);
    if (scheme.customerGroupName) {
      queryParams.append('customerGroupName', scheme.customerGroupName);
    }
    queryParams.append('monthlyPaymentAmount', scheme.monthlyPaymentAmount.toString());
    router.push(`/schemes/new?${queryParams.toString()}`);
  };

  // Inline Payment Card Logic
  const maxInlineMonthsToPay = useMemo(() => {
    if (!scheme) return 0;
    return scheme.durationMonths - (scheme.paymentsMadeCount || 0);
  }, [scheme]);

  const handleInlinePaymentMonthsChange = (delta: number) => {
    setInlineMonthsToPay(prev => {
      let newMonths = prev + delta;
      if (newMonths < 1 && maxInlineMonthsToPay > 0) newMonths = 1;
      if (newMonths <= 0 && maxInlineMonthsToPay <=0) newMonths = 0;
      if (newMonths > maxInlineMonthsToPay) newMonths = maxInlineMonthsToPay;
      return newMonths;
    });
  };

  const handleInlinePaymentModeChange = (mode: PaymentMode, checked: boolean) => {
    setInlinePaymentModes(prev => {
      const newModes = checked
        ? [...prev, mode]
        : prev.filter(m => m !== mode);
      return newModes;
    });
  };

  const totalInlinePaymentAmount = useMemo(() => {
    if (!scheme || inlineMonthsToPay <= 0) return 0;
    return scheme.monthlyPaymentAmount * inlineMonthsToPay;
  }, [scheme, inlineMonthsToPay]);

  const handleConfirmInlinePayment = async (formData: InlinePaymentFormValues) => {
    if (!scheme || inlineMonthsToPay <= 0 || inlinePaymentModes.length === 0 || !formData.paymentDate) {
      toast({ title: "Invalid Payment Details", description: "Ensure months to pay, payment date, and mode are set.", variant: "destructive" });
      return;
    }

    setIsInlinePaymentProcessing(true);
    let successCount = 0;
    let errorCount = 0;
    let currentSchemeStateForLoop: Scheme | undefined = JSON.parse(JSON.stringify(scheme)); // Deep copy for loop processing

    for (let i = 0; i < inlineMonthsToPay; i++) {
      if (!currentSchemeStateForLoop) {
        errorCount++;
        break;
      }
      const nextPaymentToRecord = currentSchemeStateForLoop.payments.find(p => getPaymentStatus(p, currentSchemeStateForLoop!.startDate) !== 'Paid');
      
      if (!nextPaymentToRecord) {
        errorCount++;
        break; 
      }

      const paymentData = {
        paymentDate: formatISO(formData.paymentDate),
        amountPaid: currentSchemeStateForLoop.monthlyPaymentAmount,
        modeOfPayment: inlinePaymentModes,
      };

      const result = updateMockSchemePayment(currentSchemeStateForLoop.id, nextPaymentToRecord.id, paymentData);
      if (result) {
        successCount++;
        currentSchemeStateForLoop = result; // Update scheme state for the next iteration
      } else {
        errorCount++;
        break; 
      }
    }
    
    if (successCount > 0) {
      toast({ title: "Payments Recorded", description: `${successCount} payment installment(s) recorded for ${scheme.customerName}.` });
      loadSchemeData(); // Reload to get fresh scheme data and reset inline form
    } else if (errorCount > 0) {
      toast({ title: "Error Recording Payments", description: `Could not record ${errorCount} payment installments.`, variant: "destructive" });
    }
    
    setIsInlinePaymentProcessing(false);
  };

  const canRecordPayment = useMemo(() => {
    if (!scheme) return false;
    return scheme.status !== 'Closed' && scheme.status !== 'Completed' && maxInlineMonthsToPay > 0;
  }, [scheme, maxInlineMonthsToPay]);


  if (isLoading || !scheme) {
    return (
        <div className="flex flex-col gap-6 items-center justify-center min-h-[calc(100vh-200px)]">
            {isLoading ? (
                 <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : (
                <Card className="w-full max-w-md glassmorphism">
                    <CardHeader className="items-center">
                        <FileWarning className="h-10 w-10 text-destructive mb-3" />
                        <CardTitle className="font-headline text-2xl">Scheme Not Found</CardTitle>
                        <CardDescription>The requested scheme ID could not be found or is invalid.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Button onClick={() => router.push('/schemes')}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to All Schemes
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
  }
  
  return (
    <div key={scheme.id} className="flex flex-col gap-6">
      <div className="mb-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/schemes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to All Schemes
        </Button>
      </div>

      {/* Scheme Overview & Progress Card */}
      <Card className="glassmorphism overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="font-headline text-3xl mb-1.5 text-foreground">{scheme.customerName}</CardTitle>
            <CardDescription className="space-y-0.5 text-sm">
              <span>ID: <span className="font-medium text-foreground/90">{scheme.id.toUpperCase()}</span></span><br/>
              {scheme.customerPhone && <span>Phone: <span className="font-medium text-foreground/90">{scheme.customerPhone}</span></span>}<br/>
              {scheme.customerAddress && <span>Address: <span className="font-medium text-foreground/90">{scheme.customerAddress}</span></span>}<br/>
              {scheme.customerGroupName && (<span>Group: <Link href={`/groups/${encodeURIComponent(scheme.customerGroupName)}`} className="text-primary hover:underline font-medium">{scheme.customerGroupName}</Link><br/></span>)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
             <Button onClick={() => setIsEditCustomerDetailsDialogOpen(true)} variant="outline" size="sm" disabled={isUpdatingGroup || isUpdatingCustomerDetails || isProcessingManualClose || isInlinePaymentProcessing}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Details
            </Button>
             <Button onClick={handleAddNewSchemeForCustomer} variant="outline" size="sm" disabled={isInlinePaymentProcessing}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Scheme for {scheme.customerName.split(' ')[0]}
            </Button>
            <Button onClick={() => setIsAssignGroupDialogOpen(true)} variant="outline"size="sm" disabled={isUpdatingGroup || isUpdatingCustomerDetails || isProcessingManualClose || isInlinePaymentProcessing}>
              <Users2 className="mr-2 h-4 w-4" /> Manage Group
            </Button>
             <Button onClick={() => setIsHistoryPanelOpen(true)} variant="outline" size="sm" disabled={isInlinePaymentProcessing}>
                <ListOrdered className="mr-2 h-4 w-4" /> View History
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-1 flex flex-col items-center justify-center">
             <SchemeCompletionArc 
                paymentsMadeCount={scheme.paymentsMadeCount || 0} 
                durationMonths={scheme.durationMonths}
                size={200}
                strokeWidth={20}
             />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Start Date</p>
              <p className="font-semibold text-base text-foreground">{formatDate(scheme.startDate)}</p>
            </div>
             <div className="space-y-0.5">
              <p className="text-muted-foreground">Monthly Amount</p>
              <p className="font-semibold text-base text-foreground">{formatCurrency(scheme.monthlyPaymentAmount)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Duration</p>
              <p className="font-semibold text-base text-foreground">{scheme.durationMonths} Months</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Status</p>
              <SchemeStatusBadge status={scheme.status} />
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Total Collected</p>
              <p className="font-semibold text-base text-green-600 dark:text-green-500">{formatCurrency(scheme.totalCollected)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Total Remaining</p>
              <p className="font-semibold text-base text-orange-600 dark:text-orange-500">{formatCurrency(scheme.totalRemaining)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Inline Payment Recording & Scheme Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canRecordPayment && (
          <Card className="lg:col-span-2 glassmorphism">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2 text-xl">
                <DollarSign className="h-5 w-5 text-primary" /> Record Payment(s) for this Scheme
              </CardTitle>
              <CardDescription>Select payment date, number of months, and mode of payment.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...inlinePaymentForm}>
                <form onSubmit={inlinePaymentForm.handleSubmit(handleConfirmInlinePayment)} className="space-y-5">
                  <FormField
                    control={inlinePaymentForm.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <HookFormLabel>Payment Date</HookFormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant={'outline'}
                                className={cn('w-full sm:w-[260px] pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                                disabled={isInlinePaymentProcessing}
                              >
                                {field.value ? formatDateFns(field.value, 'dd MMM yyyy') : <span>Pick a date</span>}
                                <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date() || date < new Date("1900-01-01") || isInlinePaymentProcessing}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <HookFormLabel>Number of Months to Pay ({inlineMonthsToPay} / {maxInlineMonthsToPay} remaining)</HookFormLabel>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => handleInlinePaymentMonthsChange(-1)} disabled={inlineMonthsToPay <= 1 || isInlinePaymentProcessing || maxInlineMonthsToPay === 0}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input 
                        type="text" 
                        readOnly 
                        value={inlineMonthsToPay} 
                        className="w-16 h-9 text-center font-semibold text-base" 
                        disabled={maxInlineMonthsToPay === 0}
                        />
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => handleInlinePaymentMonthsChange(1)} disabled={inlineMonthsToPay >= maxInlineMonthsToPay || isInlinePaymentProcessing || maxInlineMonthsToPay === 0}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {maxInlineMonthsToPay === 0 && <FormDescription className="text-green-600 dark:text-green-500 mt-1">All due payments made for this scheme.</FormDescription>}
                  </div>

                  <div>
                    <HookFormLabel>Mode of Payment</HookFormLabel>
                    <div className="flex flex-wrap gap-x-6 gap-y-3 mt-2">
                      {availablePaymentModes.map((mode) => {
                        const Icon = paymentModeIcons[mode];
                        return (
                          <div key={mode} className="flex items-center space-x-2">
                            <Checkbox
                              id={`inline-mop-${mode}`}
                              checked={inlinePaymentModes.includes(mode)}
                              onCheckedChange={(checked) => handleInlinePaymentModeChange(mode, !!checked)}
                              disabled={isInlinePaymentProcessing || inlineMonthsToPay === 0}
                            />
                            <label htmlFor={`inline-mop-${mode}`} className="font-normal text-sm flex items-center gap-1.5 cursor-pointer">
                               {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                               {mode}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                     {inlineMonthsToPay > 0 && inlinePaymentModes.length === 0 && (
                        <p className="text-xs text-destructive mt-1.5">Please select at least one payment mode.</p>
                    )}
                  </div>
                  
                  <div className="border-t pt-4 space-y-3">
                     {inlineMonthsToPay > 0 && (
                        <div className="text-lg font-semibold text-right">
                            Total to Record: {formatCurrency(totalInlinePaymentAmount)}
                        </div>
                     )}
                    <Button 
                        type="submit" 
                        disabled={isInlinePaymentProcessing || inlineMonthsToPay === 0 || inlinePaymentModes.length === 0 || !inlinePaymentForm.formState.isValid} 
                        className="w-full"
                        size="lg"
                    >
                      {isInlinePaymentProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                      Confirm & Record Payment(s)
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {(!canRecordPayment && scheme.status !== 'Closed' && scheme.status !== 'Completed') && (
           <Card className="lg:col-span-2 glassmorphism flex items-center justify-center">
            <CardContent className="text-center py-10">
                <Info className="h-10 w-10 text-primary mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground">No Payments Due</p>
                <p className="text-muted-foreground">There are no pending payments for this scheme currently.</p>
            </CardContent>
           </Card>
        )}

        {(scheme.status === 'Closed' || scheme.status === 'Completed') && (
             <Card className="lg:col-span-2 glassmorphism flex items-center justify-center">
                <CardContent className="text-center py-10">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-foreground">
                        Scheme {scheme.status}
                    </p>
                    <p className="text-muted-foreground">
                        {scheme.status === 'Closed' ? `This scheme was manually closed on ${formatDate(scheme.closureDate!)}.` : 'All payments for this scheme have been completed.'}
                    </p>
                     {scheme.status === 'Completed' && !scheme.closureDate && (
                         <p className="text-xs text-muted-foreground mt-1">You can still manually close it via Scheme Actions.</p>
                     )}
                </CardContent>
             </Card>
        )}

        <Card className="lg:col-span-1 glassmorphism">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2 text-xl">
                <FileWarning className="h-5 w-5 text-primary"/> Scheme Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
                size="lg"
                variant="destructive"
                className="w-full"
                onClick={() => openManualCloseDialog(scheme)}
                disabled={scheme.status === 'Closed' || isUpdatingGroup || isProcessingManualClose || isInlinePaymentProcessing}
            >
                <FileWarning className="mr-2 h-4 w-4" /> Close Manually
            </Button>
            <p className="text-xs text-muted-foreground">
                Manually closing a scheme will mark it as 'Closed' on a selected date. This is an administrative action and does not automatically reconcile pending payments.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs for actions */}
      {isManualCloseDialogOpen && schemeForManualCloseDialog && (
        <AlertDialog open={isManualCloseDialogOpen} onOpenChange={(open) => {
            if (!open) {
                setIsManualCloseDialogOpen(false);
                if (!isProcessingManualClose) {
                    setSchemeForManualCloseDialog(null);
                }
            }
        }}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Manually Close Scheme: {schemeForManualCloseDialog.customerName}</AlertDialogTitle>
              <AlertDialogDescription>Scheme ID: {schemeForManualCloseDialog.id.toUpperCase()}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
                <div>
                    <Label htmlFor="manual-closure-date">Closure Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                             <Button
                                id="manual-closure-date"
                                variant={'outline'}
                                className={cn('w-full justify-start text-left font-normal mt-1', !manualClosureDate && 'text-muted-foreground')}
                                disabled={isProcessingManualClose}
                            >
                                <CalendarIconLucide className="mr-2 h-4 w-4" />
                                {manualClosureDate ? formatDateFns(manualClosureDate, "dd MMM yyyy") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                             <Calendar
                                mode="single"
                                selected={manualClosureDate}
                                onSelect={(date) => setManualClosureDate(date)}
                                disabled={(date) => date > new Date() || (schemeForManualCloseDialog?.startDate ? date < parseISO(schemeForManualCloseDialog.startDate) : false) }
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                 <AlertDialogDescription className="text-xs pt-2">
                    This action will mark the scheme as 'Closed' on the selected date. 
                    Any pending payments will remain as they are. This is an administrative closure.
                </AlertDialogDescription>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsManualCloseDialogOpen(false); setSchemeForManualCloseDialog(null);}} disabled={isProcessingManualClose}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmManualCloseScheme} 
                disabled={isProcessingManualClose || !manualClosureDate}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isProcessingManualClose ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Manual Closure
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {scheme && isAssignGroupDialogOpen && (
        <AssignGroupDialog
          isOpen={isAssignGroupDialogOpen}
          onClose={() => setIsAssignGroupDialogOpen(false)}
          scheme={scheme}
          existingGroupNames={existingGroupNames}
          onSubmit={handleAssignGroupSubmit}
          isLoading={isUpdatingGroup}
        />
      )}
      {scheme && isEditCustomerDetailsDialogOpen && (
        <EditCustomerDetailsDialog
          isOpen={isEditCustomerDetailsDialogOpen}
          onClose={() => setIsEditCustomerDetailsDialogOpen(false)}
          originalCustomerName={scheme.customerName}
          currentPhone={scheme.customerPhone}
          currentAddress={scheme.customerAddress}
          onSubmit={handleEditCustomerDetailsSubmit}
          isLoading={isUpdatingCustomerDetails}
        />
      )}
      <SchemeHistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        scheme={scheme}
      />
    </div>
  );
}
    
