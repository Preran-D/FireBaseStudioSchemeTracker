
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { formatISO, parseISO } from 'date-fns';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const batchRecordPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(paymentModes)).min(1, { message: 'Select at least one payment mode.' }),
});

type BatchRecordPaymentFormValues = z.infer<typeof batchRecordPaymentFormSchema>;

interface RecordablePaymentInfo extends Payment {
  schemeCustomerName: string;
  schemeId: string;
  schemeStartDate: string;
}

interface BatchRecordPaymentDialogProps {
  customerName: string;
  customerSchemes: Scheme[]; // All schemes for this customer
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: { paymentDate: string; modeOfPayment: PaymentMode[] }) => void;
  isLoading?: boolean;
}

export function BatchRecordPaymentDialog({
  customerName,
  customerSchemes,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: BatchRecordPaymentDialogProps) {
  const form = useForm<BatchRecordPaymentFormValues>({
    resolver: zodResolver(batchRecordPaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      modeOfPayment: [],
    },
  });

  const recordablePayments = useMemo(() => {
    const payments: RecordablePaymentInfo[] = [];
    customerSchemes.forEach(scheme => {
      if (scheme.status === 'Active' || scheme.status === 'Overdue') {
        let firstUnpaidIndex = -1;
        for (let i = 0; i < scheme.payments.length; i++) {
          if (getPaymentStatus(scheme.payments[i], scheme.startDate) !== 'Paid') {
             // Check if all previous are paid
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
            schemeId: scheme.id, // Already in payment, but for clarity
            schemeStartDate: scheme.startDate,
          });
        }
      }
    });
    return payments.sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  }, [customerSchemes]);

  const totalBatchAmount = useMemo(() => {
    return recordablePayments.reduce((sum, p) => sum + p.amountExpected, 0);
  }, [recordablePayments]);

  const handleSubmit = (values: BatchRecordPaymentFormValues) => {
    onSubmit({
      paymentDate: formatISO(values.paymentDate),
      modeOfPayment: values.modeOfPayment,
    });
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Batch Payments for {customerName}</DialogTitle>
          <DialogDescription>
            The following next due payments will be recorded with the details you provide below.
          </DialogDescription>
        </DialogHeader>

        {recordablePayments.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground flex flex-col items-center gap-2">
            <AlertTriangle className="w-10 h-10 text-orange-400" />
            <p>No recordable payments found for {customerName} at this time.</p>
            <p className="text-xs">(All payments might be up-to-date, or waiting for prior installments.)</p>
          </div>
        ) : (
          <>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 my-4">
              <h4 className="font-semibold">Payments to be Recorded:</h4>
              <ul className="space-y-2 text-sm">
                {recordablePayments.map(p => (
                  <li key={p.id} className="p-2 border rounded-md bg-muted/50">
                    Scheme <Button variant="link" asChild className="p-0 h-auto"><a href={`/schemes/${p.schemeId}`} target="_blank" rel="noopener noreferrer" className="truncate max-w-[100px] sm:max-w-xs inline-block">{p.schemeId.substring(0,8)}...</a></Button>
                    - Month {p.monthNumber} <br/>
                    Due: {formatDate(p.dueDate)}, Amount: {formatCurrency(p.amountExpected)}
                  </li>
                ))}
              </ul>
              <p className="font-semibold text-right">Total for this Batch: {formatCurrency(totalBatchAmount)}</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 border-t pt-4">
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Payment Date (for all listed)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                            >
                              {field.value ? formatDate(field.value.toISOString()) : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
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
                        <FormLabel>Mode of Payment (for all listed)</FormLabel>
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
                  <Button type="submit" disabled={isLoading || recordablePayments.length === 0}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm & Record Batch
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
