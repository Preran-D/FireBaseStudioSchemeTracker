'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Loader2, Search, Plus, Minus, ExternalLink, AlertCircle } from 'lucide-react';
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { formatISO, parseISO, format } from 'date-fns';
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';
import Link from 'next/link';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const recordIndividualPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(paymentModes)).min(1, { message: 'Select at least one payment mode.' }),
});

type RecordIndividualPaymentFormValues = z.infer<typeof recordIndividualPaymentFormSchema>;

export interface IndividualPaymentDetails {
  schemeId: string;
  paymentDate: string; // ISO
  modeOfPayment: PaymentMode[];
  numberOfMonths: number;
}

interface RecordIndividualPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allRecordableSchemes: Scheme[];
  onSubmit: (details: IndividualPaymentDetails) => void;
  isLoading?: boolean;
}

export function RecordIndividualPaymentDialog({
  isOpen,
  onClose,
  allRecordableSchemes,
  onSubmit,
  isLoading,
}: RecordIndividualPaymentDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [installmentsPerScheme, setInstallmentsPerScheme] = useState<{ [schemeId: string]: number }>({});

  const form = useForm<RecordIndividualPaymentFormValues>({
    resolver: zodResolver(recordIndividualPaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      modeOfPayment: [],
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ paymentDate: new Date(), modeOfPayment: [] });
      setSelectedSchemeIds([]);
      setInstallmentsPerScheme({});
      setSearchTerm('');
    }
  }, [isOpen, form]);

  const filteredSchemes = useMemo(() => {
    if (!searchTerm) return allRecordableSchemes;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allRecordableSchemes.filter(
      (s) =>
        s.customerName.toLowerCase().includes(lowerSearchTerm) ||
        s.id.toLowerCase().includes(lowerSearchTerm)
    );
  }, [allRecordableSchemes, searchTerm]);

  const handleSchemeSelectionToggle = (schemeId: string, checked: boolean) => {
    setSelectedSchemeIds((prevIds) =>
      checked ? [...prevIds, schemeId] : prevIds.filter((id) => id !== schemeId)
    );
    setInstallmentsPerScheme((prevInstallments) => {
      const newInstallments = { ...prevInstallments };
      if (checked) {
        if (!newInstallments[schemeId]) { // Only set to 1 if not already set (e.g. re-selecting)
            const scheme = allRecordableSchemes.find(s => s.id === schemeId);
            const maxMonths = scheme ? (scheme.durationMonths - (scheme.paymentsMadeCount || 0)) : 1;
            newInstallments[schemeId] = maxMonths > 0 ? 1 : 0;
        }
      } else {
        delete newInstallments[schemeId];
      }
      return newInstallments;
    });
  };

  const handleInstallmentChange = (schemeId: string, delta: number) => {
    const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
    if (!scheme) return;

    setInstallmentsPerScheme((prevInstallments) => {
      const currentInstallments = prevInstallments[schemeId] || 0;
      let newInstallmentsCount = currentInstallments + delta;
      const maxMonths = scheme.durationMonths - (scheme.paymentsMadeCount || 0);

      if (newInstallmentsCount < 1 && maxMonths > 0) newInstallmentsCount = 1;
      if (newInstallmentsCount < 0 && maxMonths <=0 ) newInstallmentsCount = 0; // Can't go below 0 if no months to record
      if (newInstallmentsCount > maxMonths) newInstallmentsCount = maxMonths;
      
      return { ...prevInstallments, [schemeId]: newInstallmentsCount };
    });
  };
  
  const totalAmountForSelectedSchemes = useMemo(() => {
    return selectedSchemeIds.reduce((total, schemeId) => {
      const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
      const installments = installmentsPerScheme[schemeId] || 0;
      if (scheme && installments > 0) {
        return total + scheme.monthlyPaymentAmount * installments;
      }
      return total;
    }, 0);
  }, [selectedSchemeIds, installmentsPerScheme, allRecordableSchemes]);

  const handleSubmit = (values: RecordIndividualPaymentFormValues) => {
    selectedSchemeIds.forEach((schemeId) => {
      const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
      const numberOfMonths = installmentsPerScheme[schemeId];
      if (scheme && numberOfMonths > 0) {
        onSubmit({
          schemeId: scheme.id,
          paymentDate: formatISO(values.paymentDate),
          modeOfPayment: values.modeOfPayment,
          numberOfMonths: numberOfMonths,
        });
      }
    });
     if (selectedSchemeIds.length > 0 && selectedSchemeIds.every(id => (installmentsPerScheme[id] || 0) === 0)) {
        // If schemes are selected but all have 0 installments
        // This case should ideally be prevented by disabling the submit button
        console.warn("Submit called with selected schemes but zero installments for all.");
        return;
    }
    // onClose(); // Consider if dialog should close automatically or wait for toast/user
  };

  if (!isOpen) return null;
  
  const noSchemesSelectedOrNoInstallments = selectedSchemeIds.length === 0 || selectedSchemeIds.every(id => (installmentsPerScheme[id] || 0) === 0);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Individual Payment(s)</DialogTitle>
          <DialogDescription>
            Search, select schemes, and specify payment details. Checked schemes will be processed.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or scheme ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            disabled={isLoading}
          />
        </div>

        <ScrollArea className="flex-grow border rounded-md p-1 min-h-[200px] max-h-[calc(90vh-350px)]">
          {filteredSchemes.length === 0 && (
            <p className="text-center text-muted-foreground py-6">
              {searchTerm ? "No matching schemes found." : "No recordable schemes available."}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
            {filteredSchemes.map((scheme) => {
              const isSelected = selectedSchemeIds.includes(scheme.id);
              const currentInstallments = installmentsPerScheme[scheme.id] || 0;
              const maxMonthsForThisScheme = scheme.durationMonths - (scheme.paymentsMadeCount || 0);
              const nextPayment = scheme.payments.find(p => getPaymentStatus(p, scheme.startDate) !== 'Paid' && 
                                  scheme.payments.slice(0, p.monthNumber - 1).every(prevP => getPaymentStatus(prevP, scheme.startDate) === 'Paid'));

              return (
                <div
                  key={scheme.id}
                  className={cn(
                    "p-3 border rounded-lg transition-all",
                    isSelected ? "bg-primary/10 border-primary shadow-md" : "bg-card",
                    isLoading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <Checkbox
                      id={`scheme-select-${scheme.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSchemeSelectionToggle(scheme.id, !!checked)}
                      disabled={isLoading || maxMonthsForThisScheme <= 0}
                      className="mt-1"
                    />
                    <label htmlFor={`scheme-select-${scheme.id}`} className="flex-grow cursor-pointer">
                        <div className="flex justify-between items-start mb-0.5">
                            <Link href={`/schemes/${scheme.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} 
                                className="font-medium text-primary hover:underline text-sm flex items-center">
                            {scheme.customerName} <ExternalLink className="h-3 w-3 ml-1"/>
                            </Link>
                            <span className="font-mono text-xs text-muted-foreground">{scheme.id.toUpperCase()}</span>
                        </div>
                        {nextPayment && (
                            <p className="text-xs text-muted-foreground">
                                Next Due: {formatDate(nextPayment.dueDate, 'dd MMM')}, Amt: {formatCurrency(nextPayment.amountExpected)}
                            </p>
                        )}
                    </label>
                  </div>
                  
                  <div className="my-1.5">
                    <SegmentedProgressBar scheme={scheme} paidMonthsCount={scheme.paymentsMadeCount || 0} monthsToRecord={isSelected ? currentInstallments : 0} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-0.5 text-center">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths} paid</p>
                  </div>

                  {isSelected && maxMonthsForThisScheme > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-2 p-2 border-t border-primary/20">
                      <span className="text-xs font-medium">Installments:</span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" type="button" onClick={() => handleInstallmentChange(scheme.id, -1)} disabled={currentInstallments <= 1 || isLoading}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center font-semibold text-xs tabular-nums">{currentInstallments}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" type="button" onClick={() => handleInstallmentChange(scheme.id, 1)} disabled={currentInstallments >= maxMonthsForThisScheme || isLoading}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                       <span className="text-xs font-medium">Total: {formatCurrency(scheme.monthlyPaymentAmount * currentInstallments)}</span>
                    </div>
                  )}
                  {isSelected && maxMonthsForThisScheme <= 0 && (
                     <p className="text-xs text-green-600 font-medium text-center p-1.5 border-t border-green-500/20 bg-green-500/5 rounded-b-md">All installments paid!</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 pt-3 border-t mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            type="button"
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
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01") || isLoading}
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
                    <FormLabel>Mode of Payment (for all selected)</FormLabel>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
                      {paymentModes.map((mode) => (
                        <FormField
                          key={mode}
                          control={form.control}
                          name="modeOfPayment"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-1.5 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(mode)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), mode]
                                      : (field.value || []).filter((value) => value !== mode);
                                    field.onChange(newValue);
                                  }}
                                  disabled={isLoading}
                                />
                              </FormControl>
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
            
            {selectedSchemeIds.length > 0 && !noSchemesSelectedOrNoInstallments && (
                 <div className="text-right font-semibold mt-2 pr-1">
                    Total for All Selected: {formatCurrency(totalAmountForSelectedSchemes)}
                 </div>
            )}
            {selectedSchemeIds.length === 0 && (
                 <div className="text-center text-muted-foreground py-2 flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4"/> Please select one or more schemes to record payments.
                 </div>
            )}


            <DialogFooter className="pt-3">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading || noSchemesSelectedOrNoInstallments}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Record Payment(s)
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
