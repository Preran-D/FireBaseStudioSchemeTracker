
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { formatISO } from 'date-fns';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const quickIndividualBatchSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(paymentModes)).min(1, { message: 'Select at least one payment mode.' }),
});

export type QuickIndividualBatchSubmitDetails = z.infer<typeof quickIndividualBatchSchema>;

interface QuickIndividualBatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: QuickIndividualBatchSubmitDetails) => void;
  isLoading?: boolean;
  scheme: Scheme;
  firstPaymentToRecord: Payment;
  numberOfMonthsToRecord: number;
}

export function QuickIndividualBatchDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  scheme,
  firstPaymentToRecord,
  numberOfMonthsToRecord,
}: QuickIndividualBatchDialogProps) {
  const form = useForm<QuickIndividualBatchSubmitDetails>({
    resolver: zodResolver(quickIndividualBatchSchema),
    defaultValues: {
      paymentDate: new Date(),
      modeOfPayment: [],
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        paymentDate: new Date(),
        modeOfPayment: [],
      });
    }
  }, [isOpen, form]);

  const handleSubmit = (values: QuickIndividualBatchSubmitDetails) => {
    onSubmit(values);
  };

  if (!isOpen) return null;

  // Calculate total amount for the selected number of months
  let totalAmount = 0;
  const firstPaymentIndex = scheme.payments.findIndex(p => p.id === firstPaymentToRecord.id);
  if (firstPaymentIndex !== -1) {
    for (let i = 0; i < numberOfMonthsToRecord; i++) {
      const paymentIndex = firstPaymentIndex + i;
      if (paymentIndex < scheme.payments.length) {
        totalAmount += scheme.payments[paymentIndex].amountExpected;
      } else {
        break; 
      }
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Payment(s)</DialogTitle>
          <DialogDescription>
            Recording {numberOfMonthsToRecord} payment(s) for <strong>{scheme.customerName}</strong> (Scheme: {scheme.id.toUpperCase()}).
            <br />
            Starting with Month {firstPaymentToRecord.monthNumber} (Due: {formatDate(firstPaymentToRecord.dueDate)}).
            <br />
            Total Amount: <strong>{formatCurrency(totalAmount)}</strong>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
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
                    <FormLabel>Mode of Payment</FormLabel>
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
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
