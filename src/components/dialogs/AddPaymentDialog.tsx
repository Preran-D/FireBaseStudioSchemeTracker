
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Loader2, Search, ListChecks, Minus, Plus, AlertTriangle, History, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import {
  updateMockSchemePayment,
  recordNextDuePaymentsForCustomerGroup,
  getMockSchemes, // To get all schemes if not passed directly or for group details
} from '@/lib/mock-data';
import { cn, formatDate, formatCurrency, getPaymentStatus, calculateSchemeTotals, getSchemeStatus } from '@/lib/utils';
import { formatISO, parseISO } from 'date-fns';
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';

const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const addPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(availablePaymentModes)).min(1, { message: 'Select at least one payment mode.' }),
});

type AddPaymentFormValues = z.infer<typeof addPaymentFormSchema>;

interface EnhancedRecordableSchemeInfo {
  scheme: Scheme;
  firstRecordablePayment: Payment;
}

interface GroupWithRecordablePayments {
  groupName: string;
  schemes: Scheme[]; // All schemes in this group
  recordableSchemeCount: number; // Count of schemes in this group that have a next payment due
}

interface AddPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allSchemes: Scheme[]; // Pass all schemes from the parent
  onPaymentRecorded: () => void; // Callback to refresh data on parent
}

export function AddPaymentDialog({
  isOpen,
  onClose,
  allSchemes: parentSchemes,
  onPaymentRecorded,
}: AddPaymentDialogProps) {
  const { toast } = useToast();
  const [paymentRecordMode, setPaymentRecordMode] = useState<'individual' | 'batch'>('individual');
  
  const [individualSearchTerm, setIndividualSearchTerm] = useState('');
  const [batchGroupSearchTerm, setBatchGroupSearchTerm] = useState('');

  const [monthsToPayForScheme, setMonthsToPayForScheme] = useState<{ [schemeId: string]: number }>({});
  const [processingStates, setProcessingStates] = useState<{ [key: string]: boolean }>({}); // key: schemeId or groupName

  const form = useForm<AddPaymentFormValues>({
    resolver: zodResolver(addPaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      modeOfPayment: [],
    },
    mode: 'onTouched',
  });

  // Re-process schemes from props whenever they change (e.g., after a payment)
  const processedSchemes = useMemo(() => {
    return parentSchemes.map(s => {
      // Ensure calculations are fresh if not already done by parent
      const tempS = { ...s };
      tempS.payments.forEach(p => p.status = getPaymentStatus(p, tempS.startDate));
      const totals = calculateSchemeTotals(tempS);
      const status = getSchemeStatus(tempS);
      return { ...tempS, ...totals, status };
    });
  }, [parentSchemes]);


  const recordableIndividualSchemes = useMemo((): EnhancedRecordableSchemeInfo[] => {
    const searchTermLower = individualSearchTerm.toLowerCase().trim();
    if (!searchTermLower) return [];

    const result: EnhancedRecordableSchemeInfo[] = [];
    processedSchemes
      .filter(s =>
        s.customerName.toLowerCase().includes(searchTermLower) ||
        s.id.toLowerCase().includes(searchTermLower)
      )
      .forEach(s => {
        if (s.status === 'Active' || s.status === 'Overdue') {
          let firstUnpaidRecordableIndex = -1;
          for (let i = 0; i < s.payments.length; i++) {
            if (getPaymentStatus(s.payments[i], s.startDate) !== 'Paid') {
              let allPreviousPaid = true;
              for (let j = 0; j < i; j++) {
                if (getPaymentStatus(s.payments[j], s.startDate) !== 'Paid') {
                  allPreviousPaid = false;
                  break;
                }
              }
              if (allPreviousPaid) {
                firstUnpaidRecordableIndex = i;
                break;
              }
            }
          }
          if (firstUnpaidRecordableIndex !== -1) {
            result.push({
              scheme: s,
              firstRecordablePayment: s.payments[firstUnpaidRecordableIndex],
            });
          }
        }
    });
    return result.sort((a, b) => parseISO(a.firstRecordablePayment.dueDate).getTime() - parseISO(b.firstRecordablePayment.dueDate).getTime());
  }, [processedSchemes, individualSearchTerm]);

  const groupsWithRecordablePayments = useMemo((): GroupWithRecordablePayments[] => {
    const groupsMap = new Map<string, { schemes: Scheme[], recordableSchemeCount: number }>();
    processedSchemes.forEach(scheme => {
      if (scheme.customerGroupName && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
        let hasRecordablePaymentForThisScheme = false;
        // Logic to find if scheme has a recordable payment (first unpaid after all previous are paid)
        for (let i = 0; i < scheme.payments.length; i++) {
            const payment = scheme.payments[i];
            if (getPaymentStatus(payment, scheme.startDate) !== 'Paid') {
                let allPreviousPaid = true;
                for (let j = 0; j < i; j++) {
                    if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') {
                        allPreviousPaid = false; break;
                    }
                }
                if (allPreviousPaid) { hasRecordablePaymentForThisScheme = true; break; }
            }
        }
        const groupEntry = groupsMap.get(scheme.customerGroupName) || { schemes: [], recordableSchemeCount: 0 };
        groupEntry.schemes.push(scheme);
        if (hasRecordablePaymentForThisScheme) {
          groupEntry.recordableSchemeCount++;
        }
        groupsMap.set(scheme.customerGroupName, groupEntry);
      }
    });
    return Array.from(groupsMap.entries())
      .map(([groupName, data]) => ({ groupName, ...data }))
      .filter(g => g.recordableSchemeCount > 0 && (batchGroupSearchTerm.trim() === '' || g.groupName.toLowerCase().includes(batchGroupSearchTerm.toLowerCase())));
  }, [processedSchemes, batchGroupSearchTerm]);

  useEffect(() => {
    // Initialize or update monthsToPayForScheme when recordableIndividualSchemes change
    setMonthsToPayForScheme(prev => {
      const newMonthsToPay = { ...prev };
      recordableIndividualSchemes.forEach(({ scheme }) => {
        if (!(scheme.id in newMonthsToPay)) {
          newMonthsToPay[scheme.id] = 1;
        }
      });
      return newMonthsToPay;
    });
  }, [recordableIndividualSchemes]);

  const handleChangeMonthsToPay = (schemeId: string, schemeDuration: number, paymentsMade: number, delta: number) => {
    setMonthsToPayForScheme(prev => {
      const currentMonths = prev[schemeId] || 1;
      const maxMonths = schemeDuration - (paymentsMade || 0);
      let newMonths = currentMonths + delta;
      if (newMonths < 1) newMonths = 1;
      if (newMonths > maxMonths) newMonths = maxMonths;
      if (maxMonths <= 0) newMonths = 0;
      return { ...prev, [schemeId]: newMonths };
    });
  };

  const handleIndividualPayment = async (schemeInfo: EnhancedRecordableSchemeInfo, paymentData: AddPaymentFormValues) => {
    const schemeId = schemeInfo.scheme.id;
    setProcessingStates(prev => ({ ...prev, [schemeId]: true }));

    const numberOfMonths = monthsToPayForScheme[schemeId] || 1;
    let successfulRecords = 0;
    let totalAmountRecorded = 0;
    let errors = 0;

    const firstPaymentIndex = schemeInfo.scheme.payments.findIndex(p => p.id === schemeInfo.firstRecordablePayment.id);

    for (let i = 0; i < numberOfMonths; i++) {
      const paymentIndexToRecord = firstPaymentIndex + i;
      if (paymentIndexToRecord < schemeInfo.scheme.payments.length) {
        const paymentToRecord = schemeInfo.scheme.payments[paymentIndexToRecord];
        if (getPaymentStatus(paymentToRecord, schemeInfo.scheme.startDate) !== 'Paid') {
          const updatedScheme = updateMockSchemePayment(schemeId, paymentToRecord.id, {
            paymentDate: formatISO(paymentData.paymentDate),
            amountPaid: paymentToRecord.amountExpected,
            modeOfPayment: paymentData.modeOfPayment,
          });
          if (updatedScheme) { successfulRecords++; totalAmountRecorded += paymentToRecord.amountExpected; } else { errors++; }
        }
      } else { errors++; break; }
    }

    if (successfulRecords > 0) {
      toast({
        title: "Payments Recorded",
        description: `${successfulRecords} payment(s) totaling ${formatCurrency(totalAmountRecorded)} for ${schemeInfo.scheme.customerName} (Scheme: ${schemeId.toUpperCase()}) recorded. ${errors > 0 ? `${errors} error(s).` : ''}`
      });
      onPaymentRecorded(); // Refresh dashboard data
      setMonthsToPayForScheme(prev => ({ ...prev, [schemeId]: 1 })); // Reset counter for this scheme
    } else if (errors > 0) {
      toast({ title: "Error Recording Payments", description: `${errors} error(s) occurred. No payments were recorded.`, variant: "destructive" });
    } else {
      toast({ title: "No Payments Recorded", description: "No new payments were recorded for this scheme." });
    }
    setProcessingStates(prev => ({ ...prev, [schemeId]: false }));
  };

  const handleBatchGroupPayment = async (group: GroupWithRecordablePayments, paymentData: AddPaymentFormValues) => {
    setProcessingStates(prev => ({ ...prev, [group.groupName]: true }));
    const result = recordNextDuePaymentsForCustomerGroup(group.groupName, {
      paymentDate: formatISO(paymentData.paymentDate),
      modeOfPayment: paymentData.modeOfPayment,
      // schemeIdsToRecord: could be implemented with checkboxes per scheme in group
    });

    toast({
      title: "Batch Payment Processed",
      description: `Recorded ${result.paymentsRecordedCount} payment(s) for group "${group.groupName}", totaling ${formatCurrency(result.totalRecordedAmount)}.`,
    });
    onPaymentRecorded(); // Refresh dashboard data
    setProcessingStates(prev => ({ ...prev, [group.groupName]: false }));
  };
  
  const onSubmitCommonForm = (formData: AddPaymentFormValues) => {
    // This function is called when a specific pay button is clicked.
    // The actual scheme/group info is passed directly to the handlers.
    console.log("Common payment details validated:", formData);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Record Payment</DialogTitle>
          <DialogDescription>
            Select individual schemes or groups to record payments. Payment date and mode will apply to the selected action.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitCommonForm)} className="space-y-4 flex-grow flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-1 py-2 border-b">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date (for action)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? formatDate(field.value) : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date('1900-01-01')} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modeOfPayment"
                render={() => (
                  <FormItem>
                    <FormLabel>Mode of Payment (for action)</FormLabel>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                      {availablePaymentModes.map((mode) => (
                        <FormField
                          key={mode}
                          control={form.control}
                          name="modeOfPayment"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-1.5 space-y-0">
                              <FormControl><Checkbox checked={field.value?.includes(mode)} onCheckedChange={(checked) => {
                                return checked ? field.onChange([...(field.value || []), mode]) : field.onChange((field.value || []).filter(v => v !== mode));
                              }} /></FormControl>
                              <FormLabel className="font-normal text-sm">{mode}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <RadioGroup
              value={paymentRecordMode}
              onValueChange={(value: 'individual' | 'batch') => setPaymentRecordMode(value)}
              className="flex border-b pb-2"
            >
              <div className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-muted has-[[data-state=checked]]:bg-muted">
                <RadioGroupItem value="individual" id="individual-mode" />
                <Label htmlFor="individual-mode" className="cursor-pointer">Individual Scheme</Label>
              </div>
              <div className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-muted has-[[data-state=checked]]:bg-muted">
                <RadioGroupItem value="batch" id="batch-mode" />
                <Label htmlFor="batch-mode" className="cursor-pointer">Batch (Group)</Label>
              </div>
            </RadioGroup>

            <div className="flex-grow overflow-y-auto px-1 pr-3 space-y-4">
              {paymentRecordMode === 'individual' && (
                <div>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by customer name or scheme ID..." value={individualSearchTerm} onChange={(e) => setIndividualSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  {individualSearchTerm.trim() && recordableIndividualSchemes.length === 0 && <p className="text-muted-foreground text-center py-3">No matching recordable schemes.</p>}
                  {!individualSearchTerm.trim() && <p className="text-muted-foreground text-center py-3">Search to list recordable schemes.</p>}
                  
                  <ScrollArea className="h-[calc(90vh-400px)] min-h-[200px]"> {/* Adjust height as needed */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recordableIndividualSchemes.map((schemeInfo) => {
                      const { scheme } = schemeInfo;
                      const currentMonthsToPay = monthsToPayForScheme[scheme.id] || 1;
                      const paymentsMade = scheme.paymentsMadeCount || 0;
                      const maxMonthsToRecord = scheme.durationMonths - paymentsMade;
                      const liveTotalAmount = currentMonthsToPay * scheme.monthlyPaymentAmount;
                      const isProcessing = processingStates[scheme.id];

                      return (
                        <div key={scheme.id} className="p-3 border rounded-lg bg-card flex flex-col text-xs">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-mono text-xs sm:text-sm tracking-wider text-foreground/90 font-medium block">{scheme.id.toUpperCase()}</span>
                            {/* History button could be added if needed */}
                          </div>
                          <Link href={`/schemes/${scheme.id}`} target="_blank" rel="noopener noreferrer" className="block mb-1">
                            <p className="text-sm font-headline font-semibold text-primary hover:underline truncate" title={scheme.customerName}>{scheme.customerName}</p>
                          </Link>
                          <div className="flex justify-between items-baseline mt-1 text-xs">
                            <p className="text-muted-foreground">Starts: <span className="font-semibold text-foreground">{formatDate(scheme.startDate, 'dd MMM yy')}</span></p>
                            <p className="font-semibold text-foreground">{formatCurrency(scheme.monthlyPaymentAmount)}</p>
                          </div>
                          <div className="my-1.5">
                            <SegmentedProgressBar scheme={scheme} paidMonthsCount={paymentsMade} monthsToRecord={currentMonthsToPay} className="h-1.5" />
                            <p className="text-xs text-muted-foreground mt-0.5 text-center">{paymentsMade} / {scheme.durationMonths} paid</p>
                          </div>
                          {maxMonthsToRecord > 0 ? (
                            <div className="mt-auto space-y-1">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">Record:</span>
                                <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleChangeMonthsToPay(scheme.id, scheme.durationMonths, paymentsMade, -1)} disabled={currentMonthsToPay <= 1 || isProcessing}><Minus className="h-3 w-3" /></Button>
                                <span className="w-5 text-center font-semibold text-xs tabular-nums">{currentMonthsToPay}</span>
                                <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleChangeMonthsToPay(scheme.id, scheme.durationMonths, paymentsMade, 1)} disabled={currentMonthsToPay >= maxMonthsToRecord || isProcessing}><Plus className="h-3 w-3" /></Button>
                                <span className="text-xs text-muted-foreground">month(s)</span>
                              </div>
                              <Button size="sm" className="w-full font-semibold text-xs py-1 h-auto" onClick={() => form.handleSubmit(() => handleIndividualPayment(schemeInfo, form.getValues()))()} disabled={currentMonthsToPay === 0 || isProcessing || !form.formState.isValid}>
                                {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <ListChecks className="mr-1.5 h-3.5 w-3.5" />}
                                Pay ({formatCurrency(liveTotalAmount)})
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-auto text-center py-2">
                              <span className="text-xs font-medium text-green-600 dark:text-green-500 inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5"/>All Paid</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {paymentRecordMode === 'batch' && (
                <div>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by group name..." value={batchGroupSearchTerm} onChange={(e) => setBatchGroupSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  {batchGroupSearchTerm.trim() && groupsWithRecordablePayments.length === 0 && <p className="text-muted-foreground text-center py-3">No matching groups with recordable payments.</p>}
                  {!batchGroupSearchTerm.trim() && groupsWithRecordablePayments.length === 0 && <p className="text-muted-foreground text-center py-3">No groups eligible for batch payment.</p>}
                  
                  <ScrollArea className="h-[calc(90vh-400px)] min-h-[200px]"> {/* Adjust height as needed */}
                    <div className="space-y-2">
                    {groupsWithRecordablePayments.map(group => {
                      const isProcessing = processingStates[group.groupName];
                      return (
                        <div key={group.groupName} className="flex flex-col sm:flex-row justify-between sm:items-center p-2.5 border rounded-lg bg-card hover:shadow-sm">
                          <div>
                            <Link href={`/groups/${encodeURIComponent(group.groupName)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{group.groupName}</Link>
                            <p className="text-xs text-muted-foreground">{group.recordableSchemeCount} scheme(s) with next payment due.</p>
                          </div>
                          <Button size="sm" variant="outline" className="mt-1.5 sm:mt-0 text-xs py-1 h-auto" onClick={() => form.handleSubmit(() => handleBatchGroupPayment(group, form.getValues()))()} disabled={isProcessing || !form.formState.isValid}>
                            {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <ListChecks className="mr-1.5 h-3.5 w-3.5" />}
                            Record for Group
                          </Button>
                        </div>
                      );
                    })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t mt-auto">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              </DialogClose>
              {/* No global submit button, actions are per-item/group */}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

