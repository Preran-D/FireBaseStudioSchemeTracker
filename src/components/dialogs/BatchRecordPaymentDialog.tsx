
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Loader2, AlertTriangle, ListChecks, ExternalLink } from 'lucide-react'; // Added ExternalLink
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme'; // Added GroupDetail
import { formatISO, parseISO } from 'date-fns';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input'; // For group search if needed later
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const batchRecordPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(paymentModes)).min(1, { message: 'Select at least one payment mode.' }),
  // Group selection will be handled outside the RHF form for this dialog if multiple groups are possible
});

type BatchRecordPaymentFormValues = z.infer<typeof batchRecordPaymentFormSchema>;

interface RecordablePaymentInfo extends Payment {
  schemeCustomerName: string; 
  schemeId: string;
  schemeStartDate: string;
}

interface BatchRecordPaymentDialogProps {
  // Option 1: Pass a specific group
  groupDisplayName?: string; 
  schemesInGroup?: Scheme[]; 
  // Option 2: Pass all eligible groups for selection within the dialog
  allEligibleGroups?: GroupDetail[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: { paymentDate: string; modeOfPayment: PaymentMode[]; schemeIdsToRecord: string[]; groupName?: string }) => void;
  isLoading?: boolean;
}

export function BatchRecordPaymentDialog({
  groupDisplayName: initialGroupDisplayName, // Use this if a group is pre-selected
  schemesInGroup: initialSchemesInGroup,     // Use this if a group is pre-selected
  allEligibleGroups = [],                   // Provide all eligible groups if selection is needed
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: BatchRecordPaymentDialogProps) {
  
  const [currentSelectedGroup, setCurrentSelectedGroup] = useState<GroupDetail | null>(null);
  const [schemesForCurrentGroup, setSchemesForCurrentGroup] = useState<Scheme[]>([]);

  const form = useForm<BatchRecordPaymentFormValues>({
    resolver: zodResolver(batchRecordPaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      modeOfPayment: [],
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ paymentDate: new Date(), modeOfPayment: [] });
      if (initialGroupDisplayName && initialSchemesInGroup) {
        const groupDetail: GroupDetail = {
          groupName: initialGroupDisplayName,
          schemes: initialSchemesInGroup,
          customerNames: Array.from(new Set(initialSchemesInGroup.map(s => s.customerName))),
          totalSchemesInGroup: initialSchemesInGroup.length,
          recordableSchemeCount: initialSchemesInGroup.filter(s => {
            const firstUnpaid = s.payments.find(p => getPaymentStatus(p, s.startDate) !== 'Paid' && s.payments.slice(0,p.monthNumber-1).every(prev => getPaymentStatus(prev,s.startDate) === 'Paid'));
            return !!firstUnpaid;
          }).length,
        };
        setCurrentSelectedGroup(groupDetail);
        setSchemesForCurrentGroup(initialSchemesInGroup);
      } else if (allEligibleGroups.length > 0) {
        // If no specific group is passed, but eligible groups are, select the first one by default.
        // Or, better yet, leave it null and prompt user to select.
        // For now, let's default to the first if one exists and is unique
        if (allEligibleGroups.length === 1) {
             setCurrentSelectedGroup(allEligibleGroups[0]);
             setSchemesForCurrentGroup(allEligibleGroups[0].schemes);
        } else {
            setCurrentSelectedGroup(null); // Requires user to pick a group
            setSchemesForCurrentGroup([]);
        }
      } else {
         setCurrentSelectedGroup(null);
         setSchemesForCurrentGroup([]);
      }
    }
  }, [isOpen, initialGroupDisplayName, initialSchemesInGroup, allEligibleGroups, form]);


  const recordablePayments = useMemo(() => {
    if (!currentSelectedGroup) return [];
    const payments: RecordablePaymentInfo[] = [];
    schemesForCurrentGroup.forEach(scheme => {
      if (scheme.status === 'Active' || scheme.status === 'Overdue') {
        let firstUnpaidIndex = -1;
        for (let i = 0; i < scheme.payments.length; i++) {
          if (getPaymentStatus(scheme.payments[i], scheme.startDate) !== 'Paid') {
            let allPreviousPaid = true;
            for (let j = 0; j < i; j++) {
              if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') {
                allPreviousPaid = false;
                break;
              }
            }
            if (allPreviousPaid) {
              firstUnpaidIndex = i;
              break;
            }
          }
        }
        if (firstUnpaidIndex !== -1) {
          payments.push({
            ...scheme.payments[firstUnpaidIndex],
            schemeCustomerName: scheme.customerName,
            schemeId: scheme.id, 
            schemeStartDate: scheme.startDate,
          });
        }
      }
    });
    return payments.sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  }, [currentSelectedGroup, schemesForCurrentGroup]);

  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);

  useEffect(() => {
    // Default all recordable payments to selected when currentSelectedGroup changes or dialog opens
    setSelectedSchemeIds(recordablePayments.map(p => p.schemeId));
  }, [recordablePayments, currentSelectedGroup]); // Rerun when group changes
  
  const totalBatchAmount = useMemo(() => {
    return recordablePayments
      .filter(p => selectedSchemeIds.includes(p.schemeId))
      .reduce((sum, p) => sum + p.amountExpected, 0);
  }, [recordablePayments, selectedSchemeIds]);

  const handleSelectAllToggle = (checked: boolean) => {
    if (checked) {
      setSelectedSchemeIds(recordablePayments.map(p => p.schemeId));
    } else {
      setSelectedSchemeIds([]);
    }
  };

  const handleSchemeSelectionToggle = (schemeId: string, checked: boolean) => {
    if (checked) {
      setSelectedSchemeIds(prev => [...prev, schemeId]);
    } else {
      setSelectedSchemeIds(prev => prev.filter(id => id !== schemeId));
    }
  };
  
  const handleGroupSelect = (groupName: string) => {
    const selectedGroup = allEligibleGroups.find(g => g.groupName === groupName);
    if (selectedGroup) {
      setCurrentSelectedGroup(selectedGroup);
      setSchemesForCurrentGroup(selectedGroup.schemes);
      // form.reset() // Keep date/mode if user changes group mid-way? Or reset? Let's keep for now.
    }
  };


  const handleSubmit = (values: BatchRecordPaymentFormValues) => {
    onSubmit({
      paymentDate: formatISO(values.paymentDate),
      modeOfPayment: values.modeOfPayment,
      schemeIdsToRecord: selectedSchemeIds,
      groupName: currentSelectedGroup?.groupName
    });
  };
  
  if (!isOpen) return null;

  const allSelected = recordablePayments.length > 0 && selectedSchemeIds.length === recordablePayments.length;

  const displayGroupSelector = !initialGroupDisplayName && allEligibleGroups.length > 1;
  const effectiveDisplayName = currentSelectedGroup?.groupName || initialGroupDisplayName || "N/A";


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Batch Payments for Group: {effectiveDisplayName}</DialogTitle>
          <DialogDescription>
            {displayGroupSelector ? "Select a group, then select schemes and provide payment details." : "Select schemes and provide payment details. Only selected schemes will have their next due payment recorded."}
          </DialogDescription>
        </DialogHeader>

        {displayGroupSelector && (
          <div className="my-3">
            <FormLabel>Select Group</FormLabel>
            <Select onValueChange={handleGroupSelect} value={currentSelectedGroup?.groupName || ""}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Choose a group to process..." />
              </SelectTrigger>
              <SelectContent>
                {allEligibleGroups.map(group => (
                  <SelectItem key={group.groupName} value={group.groupName}>
                    {group.groupName} ({group.recordableSchemeCount} recordable)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}


        {!currentSelectedGroup && !initialGroupDisplayName && allEligibleGroups.length === 0 && (
             <div className="py-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                <AlertTriangle className="w-10 h-10 text-orange-400" />
                <p>No groups with recordable payments found.</p>
                <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>Close</Button></DialogClose>
                </DialogFooter>
            </div>
        )}
        {(!currentSelectedGroup && !initialGroupDisplayName && allEligibleGroups.length > 1) && (
             <div className="py-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                <ListChecks className="w-10 h-10 text-primary" />
                <p>Please select a group above to view schemes for batch payment.</p>
                 <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>Close</Button></DialogClose>
                </DialogFooter>
            </div>
        )}

        {(currentSelectedGroup || (initialGroupDisplayName && initialSchemesInGroup)) && (
          <>
            {recordablePayments.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                <AlertTriangle className="w-10 h-10 text-orange-400" />
                <p>No recordable payments found for group "{effectiveDisplayName}" at this time.</p>
                <p className="text-xs">(All payments might be up-to-date, or waiting for prior installments.)</p>
                 <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>Close</Button></DialogClose>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="my-4 border-t border-b py-3">
                  <div className="flex items-center space-x-3 px-1 mb-2">
                    <Checkbox
                      id="select-all-schemes-batch"
                      checked={allSelected}
                      onCheckedChange={handleSelectAllToggle}
                      aria-label="Select all schemes for batch payment"
                      disabled={recordablePayments.length === 0 || isLoading}
                    />
                    <label
                      htmlFor="select-all-schemes-batch"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Select / Deselect All ({selectedSchemeIds.length} of {recordablePayments.length} selected)
                    </label>
                  </div>
                  <ScrollArea className="h-[200px] pr-3">
                    <ul className="space-y-2 text-sm">
                      {recordablePayments.map(p => (
                        <li key={p.id} className="p-2.5 border rounded-md bg-muted/30 hover:bg-muted/60 flex items-start gap-3">
                           <Checkbox
                            id={`batch-scheme-${p.schemeId}`}
                            checked={selectedSchemeIds.includes(p.schemeId)}
                            onCheckedChange={(checked) => handleSchemeSelectionToggle(p.schemeId, !!checked)}
                            className="mt-1"
                            disabled={isLoading}
                          />
                          <label htmlFor={`batch-scheme-${p.schemeId}`} className="flex-grow cursor-pointer">
                            For {p.schemeCustomerName} - Scheme 
                            <Button variant="link" asChild className="p-0 h-auto inline ml-1">
                                <Link href={`/schemes/${p.schemeId}`} target="_blank" rel="noopener noreferrer" className="truncate max-w-[80px] sm:max-w-xs inline-block">
                                    {p.schemeId.toUpperCase()} <ExternalLink className="h-3 w-3 inline-block ml-0.5" />
                                </Link>
                            </Button>
                            - Month {p.monthNumber} <br/>
                            Due: {formatDate(p.dueDate)}, Amount: {formatCurrency(p.amountExpected)}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                  <p className="font-semibold text-right mt-3">Total for Selected: {formatCurrency(totalBatchAmount)}</p>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="paymentDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Payment Date (for all selected)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                                  disabled={isLoading}
                                >
                                  {field.value ? format(field.value, 'dd MMM yyyy') : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date() || date < new Date('1900-01-01') || isLoading}
                                initialFocus
                              />
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
                          <div className="mb-2">
                            <FormLabel>Mode of Payment (for all selected)</FormLabel>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {paymentModes.map((mode) => (
                              <FormField
                                key={mode}
                                control={form.control}
                                name="modeOfPayment"
                                render={({ field }) => (
                                  <FormItem key={mode} className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(mode)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), mode])
                                            : field.onChange((field.value || []).filter((value) => value !== mode));
                                        }}
                                        disabled={isLoading}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">{mode}</FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="pt-2">
                      <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                      </DialogClose>
                      <Button type="submit" disabled={isLoading || selectedSchemeIds.length === 0}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm & Record Batch
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
