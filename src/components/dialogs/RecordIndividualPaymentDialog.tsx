
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
import { CalendarIcon, Loader2, Search, Plus, Minus, ExternalLink } from 'lucide-react';
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { formatISO, parseISO, format } from 'date-fns';
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';
import Link from 'next/link';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const recordIndividualPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(paymentModes)).min(1, { message: 'Select at least one payment mode.' }),
  // numberOfMonths and schemeId will be managed outside the form, but submitted with it
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
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const [numberOfMonthsToPay, setNumberOfMonthsToPay] = useState(1);

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
      setSelectedScheme(null);
      setNumberOfMonthsToPay(1);
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

  const handleSchemeSelect = (scheme: Scheme) => {
    setSelectedScheme(scheme);
    setNumberOfMonthsToPay(1); // Reset months when a new scheme is selected
    form.resetField("paymentDate", {defaultValue: new Date()}); // Reset date for new selection
    form.resetField("modeOfPayment", {defaultValue: []}); // Reset mode for new selection
  };

  const handleChangeMonthsToPay = (delta: number) => {
    if (!selectedScheme) return;
    const paymentsMade = selectedScheme.paymentsMadeCount || 0;
    const maxMonths = selectedScheme.durationMonths - paymentsMade;
    let newMonths = numberOfMonthsToPay + delta;
    if (newMonths < 1) newMonths = 1;
    if (newMonths > maxMonths) newMonths = maxMonths;
    if (maxMonths <= 0) newMonths = 0;
    setNumberOfMonthsToPay(newMonths);
  };

  const totalAmountForSelectedMonths = useMemo(() => {
    if (!selectedScheme || numberOfMonthsToPay === 0) return 0;
    return selectedScheme.monthlyPaymentAmount * numberOfMonthsToPay;
  }, [selectedScheme, numberOfMonthsToPay]);

  const handleSubmit = (values: RecordIndividualPaymentFormValues) => {
    if (!selectedScheme || numberOfMonthsToPay === 0) return;
    onSubmit({
      schemeId: selectedScheme.id,
      paymentDate: formatISO(values.paymentDate),
      modeOfPayment: values.modeOfPayment,
      numberOfMonths: numberOfMonthsToPay,
    });
  };

  if (!isOpen) return null;
  
  const maxMonthsToRecordForSelected = selectedScheme ? (selectedScheme.durationMonths - (selectedScheme.paymentsMadeCount || 0)) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Individual Payment</DialogTitle>
          <DialogDescription>
            Search for a scheme, select it, then specify payment details and number of installments.
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

        <ScrollArea className="flex-grow border rounded-md p-1 min-h-[200px] max-h-[300px]">
          {filteredSchemes.length === 0 && (
            <p className="text-center text-muted-foreground py-6">
              {searchTerm ? "No matching schemes found." : "No recordable schemes available."}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
            {filteredSchemes.map((scheme) => {
              const nextPayment = scheme.payments.find(p => getPaymentStatus(p, scheme.startDate) !== 'Paid' && 
                                  scheme.payments.slice(0, p.monthNumber - 1).every(prevP => getPaymentStatus(prevP, scheme.startDate) === 'Paid'));
              const isCurrentlySelected = selectedScheme?.id === scheme.id;
              return (
                <button
                  key={scheme.id}
                  type="button" // Ensure these buttons don't submit any outer form
                  onClick={() => handleSchemeSelect(scheme)}
                  disabled={isLoading}
                  className={cn(
                    "p-3 border rounded-lg text-left hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary",
                    isCurrentlySelected ? "bg-primary/10 border-primary ring-2 ring-primary" : "bg-card",
                    isLoading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
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
                  <div className="my-1.5">
                    <SegmentedProgressBar scheme={scheme} paidMonthsCount={scheme.paymentsMadeCount || 0} monthsToRecord={0} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-0.5 text-center">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths} paid</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {selectedScheme && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-3 border-t mt-3">
              <h3 className="font-semibold text-md">
                Payment for: <span className="text-primary">{selectedScheme.customerName} ({selectedScheme.id.toUpperCase()})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Payment Date</FormLabel>
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
                            disabled={(date) => date > new Date() || date < parseISO(selectedScheme.startDate) || isLoading}
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
                      <FormLabel>Mode of Payment</FormLabel>
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

              {maxMonthsToRecordForSelected > 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border rounded-md bg-muted/40">
                    <div className="flex items-center gap-2">
                        <FormLabel className="text-sm">Installments to Pay:</FormLabel>
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" type="button" onClick={() => handleChangeMonthsToPay(-1)} disabled={numberOfMonthsToPay <= 1 || isLoading}><Minus className="h-3.5 w-3.5" /></Button>
                        <span className="w-6 text-center font-semibold text-sm tabular-nums">{numberOfMonthsToPay}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" type="button" onClick={() => handleChangeMonthsToPay(1)} disabled={numberOfMonthsToPay >= maxMonthsToRecordForSelected || isLoading}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    <p className="text-sm font-semibold">Total: {formatCurrency(totalAmountForSelectedMonths)}</p>
                </div>
               ) : (
                <p className="text-sm text-green-600 font-medium text-center p-3 border rounded-md bg-green-500/10">All installments paid for this scheme.</p>
               )}

              <DialogFooter className="pt-3">
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading || numberOfMonthsToPay === 0 || maxMonthsToRecordForSelected === 0}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm & Record Payment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
        {!selectedScheme && (
            <p className="text-center text-muted-foreground py-4">Select a scheme from the list above to enter payment details.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
