
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
  const [monthsToPayPerScheme, setMonthsToPayPerScheme] = useState<{ [schemeId: string]: number }>({});

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
      setMonthsToPayPerScheme({});
      setSearchTerm('');
    }
  }, [isOpen, form]);

  const filteredSchemes = useMemo(() => {
    const selectedItems = allRecordableSchemes
      .filter(s => selectedSchemeIds.includes(s.id))
      .sort((a,b) => { // Keep selected items sorted by original order for stability
        const indexA = allRecordableSchemes.findIndex(scheme => scheme.id === a.id);
        const indexB = allRecordableSchemes.findIndex(scheme => scheme.id === b.id);
        return indexA - indexB;
      });
      
    const unselectedItems = allRecordableSchemes.filter(s => !selectedSchemeIds.includes(s.id));

    let filteredUnselectedItems = unselectedItems;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredUnselectedItems = unselectedItems.filter(
        (s) =>
          s.customerName.toLowerCase().includes(lowerSearchTerm) ||
          s.id.toLowerCase().includes(lowerSearchTerm)
      );
    }
    // Sort unselected items by customer name, then by start date
    filteredUnselectedItems.sort((a,b) => {
      const nameCompare = a.customerName.localeCompare(b.customerName);
      if (nameCompare !== 0) return nameCompare;
      return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
    });

    return [...selectedItems, ...filteredUnselectedItems];
  }, [allRecordableSchemes, searchTerm, selectedSchemeIds]);

  const handleSchemeSelectionToggle = (schemeId: string, checked: boolean) => {
    setSelectedSchemeIds((prevIds) =>
      checked ? [...prevIds, schemeId] : prevIds.filter((id) => id !== schemeId)
    );
    setMonthsToPayPerScheme((prevMonths) => {
      const newMonths = { ...prevMonths };
      if (checked) {
        if (!newMonths[schemeId]) { 
            const scheme = allRecordableSchemes.find(s => s.id === schemeId);
            const maxMonths = scheme ? (scheme.durationMonths - (scheme.paymentsMadeCount || 0)) : 1;
            newMonths[schemeId] = maxMonths > 0 ? 1 : 0;
        }
      } else {
        delete newMonths[schemeId];
      }
      return newMonths;
    });
  };

  const handleMonthsToPayChange = (schemeId: string, delta: number) => {
    const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
    if (!scheme) return;

    setMonthsToPayPerScheme((prevMonths) => {
      const currentMonths = prevMonths[schemeId] || 0;
      let newMonthsCount = currentMonths + delta;
      const maxMonths = scheme.durationMonths - (scheme.paymentsMadeCount || 0);

      if (newMonthsCount < 1 && maxMonths > 0) newMonthsCount = 1;
      if (newMonthsCount < 0 && maxMonths <=0 ) newMonthsCount = 0; 
      if (newMonthsCount > maxMonths) newMonthsCount = maxMonths;
      
      return { ...prevMonths, [schemeId]: newMonthsCount };
    });
  };
  
  const totalAmountForSelectedSchemes = useMemo(() => {
    return selectedSchemeIds.reduce((total, schemeId) => {
      const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
      const months = monthsToPayPerScheme[schemeId] || 0;
      if (scheme && months > 0) {
        return total + scheme.monthlyPaymentAmount * months;
      }
      return total;
    }, 0);
  }, [selectedSchemeIds, monthsToPayPerScheme, allRecordableSchemes]);

  const handleSubmit = (values: RecordIndividualPaymentFormValues) => {
    selectedSchemeIds.forEach((schemeId) => {
      const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
      const numberOfMonths = monthsToPayPerScheme[schemeId];
      if (scheme && numberOfMonths > 0) {
        onSubmit({
          schemeId: scheme.id,
          paymentDate: formatISO(values.paymentDate),
          modeOfPayment: values.modeOfPayment,
          numberOfMonths: numberOfMonths,
        });
      }
    });
     if (selectedSchemeIds.length > 0 && selectedSchemeIds.every(id => (monthsToPayPerScheme[id] || 0) === 0)) {
        console.warn("Submit called with selected schemes but zero months for all.");
        return;
    }
  };

  if (!isOpen) return null;
  
  const noSchemesSelectedOrNoMonths = selectedSchemeIds.length === 0 || selectedSchemeIds.every(id => (monthsToPayPerScheme[id] || 0) === 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Individual Payment(s)</DialogTitle>
          <DialogDescription>
            Search, select schemes, and specify payment details. Checked schemes will be processed.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-3 flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or scheme ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            disabled={isLoading}
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-md p-1"> {/* Changed classes here */}
          {filteredSchemes.length === 0 && (
            <p className="text-center text-muted-foreground py-6">
              {searchTerm ? "No matching schemes found." : "No recordable schemes available."}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
            {filteredSchemes.map((scheme) => {
              const isSelected = selectedSchemeIds.includes(scheme.id);
              const currentMonthsToPay = monthsToPayPerScheme[scheme.id] || 0;
              const maxMonthsForThisScheme = scheme.durationMonths - (scheme.paymentsMadeCount || 0);

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
                      className="mt-1 flex-shrink-0"
                    />
                    <label htmlFor={`scheme-select-${scheme.id}`} className="flex-grow cursor-pointer">
                        <div className="flex justify-between items-start mb-0.5">
                            <Link href={`/schemes/${scheme.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} 
                                className="font-medium text-primary hover:underline text-sm flex items-center">
                            {scheme.customerName} <ExternalLink className="h-3 w-3 ml-1"/>
                            </Link>
                            <span className="font-mono text-xs text-muted-foreground">{scheme.id.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Start Date: {formatDate(scheme.startDate, 'dd MMM yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Monthly Amt: {formatCurrency(scheme.monthlyPaymentAmount)}
                        </p>
                    </label>
                  </div>
                  
                  <div className="my-1.5">
                    <SegmentedProgressBar scheme={scheme} paidMonthsCount={scheme.paymentsMadeCount || 0} monthsToRecord={isSelected ? currentMonthsToPay : 0} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-0.5 text-center">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths} paid</p>
                  </div>

                  {isSelected && maxMonthsForThisScheme > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-2 p-2 border-t border-primary/20">
                      <span className="text-xs font-medium">Months to Pay:</span>
                      <div className="flex items-center gap-1.5">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6 rounded-full flex-shrink-0" onClick={() => handleMonthsToPayChange(scheme.id, -1)} disabled={currentMonthsToPay <= 1 || isLoading}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center font-semibold text-xs tabular-nums">{currentMonthsToPay}</span>
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6 rounded-full flex-shrink-0" onClick={() => handleMonthsToPayChange(scheme.id, 1)} disabled={currentMonthsToPay >= maxMonthsForThisScheme || isLoading}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                       <span className="text-xs font-medium">Total: {formatCurrency(scheme.monthlyPaymentAmount * currentMonthsToPay)}</span>
                    </div>
                  )}
                  {isSelected && maxMonthsForThisScheme <= 0 && (
                     <p className="text-xs text-green-600 font-medium text-center p-1.5 border-t border-green-500/20 bg-green-500/5 rounded-b-md">All payments made!</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 pt-3 border-t mt-3 flex-shrink-0">
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
                            type="button"
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
            
            {selectedSchemeIds.length > 0 && !noSchemesSelectedOrNoMonths && (
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
              <Button type="submit" disabled={isLoading || noSchemesSelectedOrNoMonths}>
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
    
