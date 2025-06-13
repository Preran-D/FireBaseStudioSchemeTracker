
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, DollarSign, Loader2, CalendarIcon as CalendarIconLucide, Users2, PlusCircle, FileWarning, ListOrdered, Info, Pencil, ArrowLeft, CheckCircle, Plus, Minus, CreditCard, Landmark, Smartphone, History, UserCircle, Home, Phone, Trash2, Archive } from 'lucide-react'; // Added Archive
import type { Scheme, Payment, PaymentMode, SchemeStatus } from '@/types/scheme';
// import { getMockSchemeById, updateMockSchemePayment, closeMockScheme, getMockSchemes, getUniqueGroupNames, updateSchemeGroup, updateMockCustomerDetails, deleteFullMockScheme, archiveMockScheme } from '@/lib/mock-data'; // Replaced
import {
  getSupabaseSchemeById,
  getSupabaseSchemes,
  getUniqueSupabaseGroupNames,
  updateSupabasePayment,
  closeSupabaseScheme,
  updateSupabaseScheme,
  updateSupabaseSchemeGroup,
  archiveSupabaseScheme // Added archiveSupabaseScheme
  /* other Supabase functions will be imported later */
} from '@/lib/supabase-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { useToast } from '@/hooks/use-toast';
import { isPast, parseISO, formatISO, startOfDay, format as formatDateFns, isValid as isValidDate } from 'date-fns';
import { SchemeCompletionArc } from '@/components/shared/SchemeCompletionArc';
import { Label } from '@/components/ui/label';
import { AssignGroupDialog } from '@/components/dialogs/AssignGroupDialog';
import { EditCustomerDetailsDialog, type EditCustomerDetailsFormValues } from '@/components/dialogs/EditCustomerDetailsDialog';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel as HookFormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from "@/components/ui/badge";
import * as z from 'zod';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';


const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];
const paymentModeIcons: Record<PaymentMode, React.ElementType> = {
  'Card': CreditCard,
  'Cash': Landmark,
  'UPI': Smartphone,
  'System Closure': FileWarning,
  'Imported': FileWarning,
};

const inlinePaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
});
type InlinePaymentFormValues = z.infer<typeof inlinePaymentFormSchema>;


export default function SchemeDetailsPage() {
  const router = useRouter();
  const urlParams = useParams();
  const { toast } = useToast();
  const schemeIdFromUrl = urlParams.id as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [otherCustomerSchemes, setOtherCustomerSchemes] = useState<Scheme[]>([]);
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

  const [inlineMonthsToPay, setInlineMonthsToPay] = useState(1);
  const [inlinePaymentModes, setInlinePaymentModes] = useState<PaymentMode[]>(['Cash']);
  const [isInlinePaymentProcessing, setIsInlinePaymentProcessing] = useState(false);

  // Renamed state variables for archiving
  const [isConfirmingArchiveScheme, setIsConfirmingArchiveScheme] = useState(false);
  const [isArchivingScheme, setIsArchivingScheme] = useState(false);

  const inlinePaymentForm = useForm<InlinePaymentFormValues>({
    resolver: zodResolver(inlinePaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
    },
    mode: 'onTouched',
  });

  const loadSchemeData = useCallback(async (currentSchemeIdToLoad?: string) => {
    const idToLoad = currentSchemeIdToLoad || schemeIdFromUrl;
    if (idToLoad) {
      setIsLoading(true);
      try {
        const fetchedScheme = await getSupabaseSchemeById(idToLoad);

        if (fetchedScheme) {
          setScheme(fetchedScheme);
          const initialMonths = (fetchedScheme.durationMonths - (fetchedScheme.paymentsMadeCount || 0)) > 0 ? 1 : 0;
          setInlineMonthsToPay(initialMonths);
          setInlinePaymentModes(['Cash']); // Default, consider persisting user choice if needed
          inlinePaymentForm.reset({ paymentDate: new Date() });

          // Fetch other schemes by the same customer (if customerName is present)
          if (fetchedScheme.customerName) {
            const allSystemSchemes = await getSupabaseSchemes({ includeArchived: true }); // Fetch all, including archived for this view
            const schemesForThisCustomer = allSystemSchemes
              .filter(s => s.customerName === fetchedScheme.customerName)
              .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
            setOtherCustomerSchemes(schemesForThisCustomer);
          } else {
            setOtherCustomerSchemes([]);
          }

          const groupNames = await getUniqueSupabaseGroupNames();
          setExistingGroupNames(groupNames);

        } else {
          setScheme(null);
          setOtherCustomerSchemes([]);
          toast({ title: "Scheme Not Found", description: `Scheme with ID ${idToLoad} could not be found.`, variant: "destructive" });
          // Optionally redirect: router.push('/schemes');
        }
      } catch (error) {
        console.error("Error fetching scheme data:", error);
        toast({ title: "Error", description: "Failed to load scheme details. Please try again.", variant: "destructive" });
        setScheme(null); // Clear scheme on error
        setOtherCustomerSchemes([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [schemeIdFromUrl, inlinePaymentForm, toast]); // Added toast to dependencies

  useEffect(() => {
    loadSchemeData();
  }, [loadSchemeData]); // schemeIdFromUrl is already a dependency of loadSchemeData

  const openManualCloseDialog = (targetScheme: Scheme) => {
    if (targetScheme.status === 'Closed') return;
    setSchemeForManualCloseDialog(targetScheme);
    setManualClosureDate(startOfDay(new Date()));
    setIsManualCloseDialogOpen(true);
  };

  const handleConfirmManualCloseScheme = () => {
    if (!schemeForManualCloseDialog || !manualClosureDate || !isValidDate(manualClosureDate)) {
        toast({title: "Invalid Date", description: "Please select a valid closure date.", variant: "destructive"});
        return;
    };
    setIsProcessingManualClose(true);

    const closureOptions = {
      closureDate: formatISO(manualClosureDate),
      type: 'partial_closure' as 'partial_closure', 
    };

    try {
      const closedSchemeResult = await closeSupabaseScheme(schemeForManualCloseDialog.id, closureOptions.closureDate);
      if (closedSchemeResult) {
        toast({ title: 'Scheme Manually Closed', description: `${closedSchemeResult.customerName}'s scheme (ID: ${closedSchemeResult.id.toUpperCase()}) has been marked as 'Closed'.` });
        await loadSchemeData(closedSchemeResult.id); // Reloads data
      } else {
        toast({ title: 'Error', description: 'Failed to manually close scheme.', variant: 'destructive' });
      }
    } catch (error) {
      console.error("Error manually closing scheme:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred while closing the scheme.', variant: 'destructive' });
    } finally {
      setIsManualCloseDialogOpen(false);
      setIsProcessingManualClose(false);
      setSchemeForManualCloseDialog(null);
    }
  };
    setIsProcessingManualClose(false);
    setSchemeForManualCloseDialog(null);
  };

  const handleAssignGroupSubmit = async (updatedSchemeId: string, groupName?: string) => {
    setIsUpdatingGroup(true);
    try {
      const updatedScheme = await updateSupabaseSchemeGroup(updatedSchemeId, groupName);
      if (updatedScheme) {
        toast({
          title: "Group Updated",
          description: `Scheme for ${updatedScheme.customerName} has been ${groupName ? `assigned to group "${groupName}"` : 'removed from group'}.`,
        });
        await loadSchemeData(updatedScheme.id); // Reloads data
      } else {
        toast({ title: "Error", description: "Failed to update scheme group.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating scheme group:", error);
      toast({ title: "Error", description: "An unexpected error occurred while updating group.", variant: "destructive" });
    } finally {
      setIsAssignGroupDialogOpen(false);
      setIsUpdatingGroup(false);
    }
  };
  
  // Updated to handle more general scheme edits, not just customer details
  const handleEditSchemeDetailsSubmit = async (
    // originalName: string, // No longer needed if scheme.id is used as primary key
    updatedDetails: EditCustomerDetailsFormValues // This type will be expanded in EditCustomerDetailsDialog.tsx
  ) => {
    if (!scheme) return;
    setIsUpdatingCustomerDetails(true); // Keep this state name for now, or rename to isUpdatingSchemeDetails

    // Prepare the payload for updateSupabaseScheme
    // EditCustomerDetailsFormValues will now include more fields
    const schemeUpdates: Partial<Omit<Scheme, 'id' | 'payments' | 'totalAmountExpected' | 'totalAmountPaid' | 'totalBalance' | 'paymentsMadeCount' | 'paymentsPendingCount' | 'nextDueDate' | 'isOverdue' | 'daysOverdue'>> = {
      customerName: updatedDetails.customerName,
      customerPhone: updatedDetails.customerPhone,
      customerAddress: updatedDetails.customerAddress,
      customerGroupName: updatedDetails.customerGroupName,
      // Ensure startDate is correctly formatted if changed. The form should provide Date object.
      startDate: updatedDetails.startDate ? formatISO(updatedDetails.startDate, { representation: 'date' }) : undefined,
      monthlyPaymentAmount: updatedDetails.monthlyPaymentAmount,
      durationMonths: updatedDetails.durationMonths,
      // 'status' might be updatable too if the form allows it, but typically it's derived or set by other actions.
    };

    // Filter out undefined values to only send actual changes
    Object.keys(schemeUpdates).forEach(key => {
        if ((schemeUpdates as any)[key] === undefined) {
            delete (schemeUpdates as any)[key];
        }
    });


    try {
      const result = await updateSupabaseScheme(scheme.id, schemeUpdates);
      if (result) {
        toast({
          title: 'Scheme Details Updated',
          description: `Details for scheme ${result.customerName} (ID: ${result.id.toUpperCase()}) have been updated.`,
        });
        await loadSchemeData(scheme.id); // Reloads data
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update scheme details.',
          variant: 'destructive',
        });
      }
    } catch (error) {
       console.error("Error updating scheme details:", error);
       toast({
        title: 'Error',
        description: 'An unexpected error occurred while updating scheme details.',
        variant: 'destructive',
      });
    } finally {
      setIsEditCustomerDetailsDialogOpen(false);
      setIsUpdatingCustomerDetails(false);
    }
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
    if (!scheme || inlineMonthsToPay <= 0 || inlinePaymentModes.length === 0 || !formData.paymentDate || !isValidDate(formData.paymentDate)) {
      toast({ title: "Invalid Payment Details", description: "Ensure months to pay, a valid payment date, and mode are set.", variant: "destructive" });
      return;
    }

    setIsInlinePaymentProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    // Identify target payments upfront
    const pendingPayments = scheme.payments
      .filter(p => getPaymentStatus(p, scheme.startDate) !== 'Paid')
      .sort((a, b) => a.monthNumber - b.monthNumber);

    const paymentsToUpdate = pendingPayments.slice(0, inlineMonthsToPay);

    if (paymentsToUpdate.length === 0 && inlineMonthsToPay > 0) {
        toast({ title: "No Payments Due", description: "All due payments seem to be paid already.", variant: "info" });
        setIsInlinePaymentProcessing(false);
        return;
    }
    if (paymentsToUpdate.length < inlineMonthsToPay) {
        toast({ title: "Attention", description: `Only ${paymentsToUpdate.length} payment(s) are pending, less than ${inlineMonthsToPay} selected.`, variant: "info" });
    }


    for (const payment of paymentsToUpdate) {
      const paymentDataForSupabase = {
        amountPaid: scheme.monthlyPaymentAmount, // Assuming full payment for each installment
        paymentDate: formatISO(formData.paymentDate), // Ensure ISO string
        modeOfPayment: inlinePaymentModes,
      };

      try {
        const updatedPayment = await updateSupabasePayment(payment.id, paymentDataForSupabase);
        if (updatedPayment) {
          successCount++;
        } else {
          errorCount++;
          // Decide if we should break or continue trying other payments
          // For now, let's continue to give feedback on each if possible,
          // but a single failure might indicate a larger issue.
        }
      } catch (err) {
        console.error(`Error updating payment ID ${payment.id} via Supabase:`, err);
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      toast({ title: "Payments Recorded", description: `${successCount} payment installment(s) successfully recorded for ${scheme.customerName}.` });
    }
    if (errorCount > 0) {
      toast({ title: "Payment Recording Issues", description: `${errorCount} payment installment(s) could not be recorded. Please check details or try again.`, variant: "destructive" });
    }

    // Always reload data if any attempt was made, to reflect partial successes or to get latest state.
    if (paymentsToUpdate.length > 0) {
        await loadSchemeData(scheme.id);
    }
    
    setIsInlinePaymentProcessing(false);
  };

  const canRecordPayment = useMemo(() => {
    if (!scheme) return false;
    return scheme.status !== 'Closed' && scheme.status !== 'Completed' && maxInlineMonthsToPay > 0;
  }, [scheme, maxInlineMonthsToPay]);

  // Renamed handler for opening archive dialog
  const handleOpenArchiveSchemeDialog = () => {
    // Allow opening dialog for any status except 'Archived'
    if (scheme && scheme.status === 'Archived') {
        toast({
            title: "Already Archived",
            description: "This scheme is already in the trash.",
            variant: "default"
        });
        return;
    }
    if (scheme) { // Check if scheme exists before opening dialog
        setIsConfirmingArchiveScheme(true);
    }
  };

  // Renamed handler for confirming archive
  const handleConfirmArchiveScheme = async () => {
    if (!scheme) { // Basic guard
        setIsConfirmingArchiveScheme(false);
        return;
    }
    // No longer need to check for 'Closed' status here, archiveMockScheme handles it.
    // The button's disabled state (scheme.status === 'Archived') and handleOpenArchiveSchemeDialog prevent re-archiving.

    setIsArchivingScheme(true);
    try {
      const archivedSchemeResult = await archiveSupabaseScheme(scheme.id);

      if (archivedSchemeResult) {
        toast({
          title: "Scheme Moved to Trash",
          description: `Scheme ID ${scheme.id.toUpperCase()} for ${scheme.customerName} has been moved to trash.`,
        });

        // After archiving, try to fetch remaining schemes to decide navigation
        // This logic can remain, as getSupabaseSchemes is already used.
        const allSchemesFromSupabase = await getSupabaseSchemes({ includeArchived: false });
        const remainingSchemesForCustomer = allSchemesFromSupabase.filter(s => s.customerName === scheme.customerName && s.id !== scheme.id);

        if (remainingSchemesForCustomer.length > 0) {
          router.push(`/schemes/${remainingSchemesForCustomer[0].id}`);
        } else if (scheme.customerGroupName) {
          const groupStillExists = allSchemesFromSupabase.some(s => s.customerGroupName === scheme.customerGroupName);
          if (groupStillExists) {
            router.push(`/groups/${encodeURIComponent(scheme.customerGroupName)}`);
          } else {
            router.push('/schemes');
          }
        } else {
          router.push('/schemes');
        }
      } else {
        toast({
          title: "Error Moving to Trash",
          description: `Could not move scheme ID ${scheme.id.toUpperCase()} to trash.`,
          variant: "destructive",
        });
        setIsArchivingScheme(false); // Only set to false on error, success leads to navigation
      }
    } catch (error) {
      console.error("Error archiving scheme:", error);
      toast({
        title: "Error Moving to Trash",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      setIsArchivingScheme(false);
    } finally {
      setIsConfirmingArchiveScheme(false); // Close dialog regardless
      // No need to setIsArchivingScheme(false) on success if navigation occurs, but good for robustness if nav fails.
      // If navigation is guaranteed on success, this might not be strictly needed.
      // However, if staying on page (e.g. error during nav decision), ensure state is clean.
      if (!archivedScheme) setIsArchivingScheme(false); // If not navigated away due to error in nav logic.
    }
  };


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

      {/* Customer Details Card */}
      <Card className="glassmorphism">
        <CardHeader className="flex flex-row justify-between items-start">
            <div>
                <CardTitle className="font-headline text-3xl mb-1.5 text-foreground flex items-center">
                    <UserCircle className="mr-3 h-8 w-8 text-primary"/>
                    {scheme.customerName}
                </CardTitle>
                <CardDescription className="space-y-0.5 text-sm ml-11">
                    {scheme.customerPhone && <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground"/> {scheme.customerPhone}</span>}
                    {scheme.customerAddress && <span className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground"/> {scheme.customerAddress}</span>}
                    {!scheme.customerPhone && !scheme.customerAddress && <span>No contact details available.</span>}
                </CardDescription>
            </div>
            <Button
              onClick={() => setIsEditCustomerDetailsDialogOpen(true)}
              variant="outline"
              size="sm"
              disabled={isUpdatingGroup || isUpdatingCustomerDetails || isProcessingManualClose || isInlinePaymentProcessing || isArchivingScheme}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit Details
            </Button>
        </CardHeader>
      </Card>

      {/* Other Schemes by Customer Section */}
      {otherCustomerSchemes.length > 1 && (
        <Card className="glassmorphism">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Other Schemes by {scheme.customerName}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex space-x-4 pb-4">
                {otherCustomerSchemes.map((otherScheme) => {
                  const isCurrentScheme = otherScheme.id === scheme.id;
                  return (
                    <Link href={`/schemes/${otherScheme.id}`} key={otherScheme.id} className="block">
                      <Card
                        className={cn(
                          "min-w-[220px] w-[220px] transition-all hover:shadow-lg",
                          isCurrentScheme ? "border-primary ring-2 ring-primary shadow-xl bg-primary/5" : "bg-card/80 hover:bg-card",
                          "glassmorphism"
                        )}
                      >
                        <CardHeader className="pb-2 pt-3 px-3">
                          <CardTitle className="text-lg font-bold tracking-tight text-primary truncate">
                            SCHEME-{otherScheme.id.toUpperCase().substring(0,4)}
                          </CardTitle>
                          <CardDescription className="text-xs">{formatDate(otherScheme.startDate, 'MMM yyyy')}</CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">
                          <SchemeStatusBadge status={otherScheme.status} />
                          <p className="text-sm font-medium">
                            {otherScheme.paymentsMadeCount || 0} / {otherScheme.durationMonths} Paid
                          </p>
                           <p className="text-xs text-muted-foreground">
                            Amt: {formatCurrency(otherScheme.monthlyPaymentAmount)}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main Scheme Overview & Progress Card */}
      <Card className={cn(
        "glassmorphism overflow-hidden",
        scheme.status === 'Active' && "ring-2 ring-offset-2 ring-offset-background ring-[hsl(var(--positive-value))]",
        scheme.status === 'Completed' && "ring-2 ring-offset-2 ring-offset-background ring-[hsl(var(--positive-value))]",
        scheme.status === 'Overdue' && "ring-2 ring-offset-2 ring-offset-background ring-orange-500 dark:ring-orange-400",
        scheme.status === 'Upcoming' && "ring-2 ring-offset-2 ring-offset-background ring-yellow-500 dark:ring-yellow-400",
        scheme.status === 'Closed' && "ring-2 ring-offset-2 ring-offset-background ring-[hsl(var(--destructive))]"
      )}>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="font-headline text-2xl mb-1 text-foreground">Scheme Details: {scheme.id.toUpperCase()}</CardTitle>
            <CardDescription className="text-sm">
              {scheme.customerGroupName && (<span>Group: <Link href={`/groups/${encodeURIComponent(scheme.customerGroupName)}`} className="text-primary hover:underline font-medium">{scheme.customerGroupName}</Link></span>)}
              {!scheme.customerGroupName && (<span>Not assigned to any group.</span>)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
             <Button onClick={handleAddNewSchemeForCustomer} variant="outline" size="sm" disabled={isInlinePaymentProcessing}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Scheme for {scheme.customerName.split(' ')[0]}
            </Button>
            <Button onClick={() => setIsAssignGroupDialogOpen(true)} variant="outline"size="sm" disabled={isUpdatingGroup || isUpdatingCustomerDetails || isProcessingManualClose || isInlinePaymentProcessing}>
              <Users2 className="mr-2 h-4 w-4" /> Manage Group
            </Button>
             <Button
                onClick={() => setIsHistoryPanelOpen(true)}
                variant="outline"
                size="sm"
                disabled={isInlinePaymentProcessing || isArchivingScheme}
              >
                <History className="mr-2 h-4 w-4" /> View History
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-1 flex flex-col items-center justify-center">
             <SchemeCompletionArc 
                paymentsMadeCount={scheme.paymentsMadeCount || 0} 
                durationMonths={scheme.durationMonths}
                status={scheme.status}
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
            {scheme.status === 'Completed' && !scheme.closureDate && (
              <div className="col-span-2">
                <Badge variant="default" className="bg-positive-value/80 text-primary-foreground hover:bg-positive-value/70">
                  All Payments Made
                </Badge>
              </div>
            )}
             {scheme.status === 'Completed' && scheme.closureDate && ( 
                <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">This fully paid scheme was manually closed on {formatDate(scheme.closureDate)}.</p>
                </div>
             )}
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canRecordPayment && (
          <Card className="lg:col-span-2 glassmorphism">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2 text-xl">
                <DollarSign className="h-5 w-5 text-primary" /> Record Payment(s)
              </CardTitle>
              <CardDescription>Select payment date, number of months, and mode of payment for this scheme.</CardDescription>
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
                    {maxInlineMonthsToPay === 0 && scheme.status !== 'Closed' && scheme.status !== 'Completed' && <FormDescription className="text-green-600 dark:text-green-500 mt-1">All due payments made for this scheme.</FormDescription>}
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
                variant="outline" // Changed from destructive to outline for less prominence than delete
                className="w-full"
                onClick={() => openManualCloseDialog(scheme)}
                disabled={scheme.status === 'Closed' || isUpdatingGroup || isProcessingManualClose || isInlinePaymentProcessing || isArchivingScheme || isUpdatingCustomerDetails}
            >
                <FileWarning className="mr-2 h-4 w-4" /> Close Manually
            </Button>
             <p className="text-xs text-muted-foreground px-1">
                Manually closing a scheme will mark it as 'Closed'. This is an administrative action.
            </p>
            <Button
                size="lg"
                variant="destructive"
                className="w-full mt-3"
                onClick={handleOpenArchiveSchemeDialog}
                disabled={isLoading || scheme.status === 'Archived' || isArchivingScheme || isUpdatingGroup || isProcessingManualClose || isInlinePaymentProcessing || isUpdatingCustomerDetails}
            >
                {isArchivingScheme ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Move to Trash
            </Button>
            <p className="text-xs text-muted-foreground px-1">
                {scheme.status === 'Archived'
                    ? "This scheme is already in the trash."
                    : "Move this scheme to the archive. It can be restored or permanently deleted from Archive Management."}
            </p>
          </CardContent>
        </Card>
      </div>

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
                                disabled={(date) => (date ? date > new Date() : true) || (schemeForManualCloseDialog?.startDate ? (date ? date < parseISO(schemeForManualCloseDialog.startDate) : true) : false) || isProcessingManualClose}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                     {!manualClosureDate && (
                        <p className="text-xs text-destructive mt-1">Please select a closure date.</p>
                    )}
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
                disabled={isProcessingManualClose || !manualClosureDate || !isValidDate(manualClosureDate)}
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

      {/* Archive Scheme Confirmation Dialog */}
      {isConfirmingArchiveScheme && scheme && (
        <AlertDialog open={isConfirmingArchiveScheme} onOpenChange={(open) => { if(!isArchivingScheme) setIsConfirmingArchiveScheme(open);}}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Move to Trash</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to move scheme <span className="font-semibold text-foreground">{scheme.id.toUpperCase()}</span> for <span className="font-semibold text-foreground">{scheme.customerName}</span> to trash?
                It can be restored or permanently deleted from Archive Management.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsConfirmingArchiveScheme(false)} disabled={isArchivingScheme}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmArchiveScheme} disabled={isArchivingScheme || scheme.status === 'Archived'} className="bg-destructive hover:bg-destructive/80">
                {isArchivingScheme ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Move to Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
