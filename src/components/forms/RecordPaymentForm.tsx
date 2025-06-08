'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types/scheme';
import { formatISO, parseISO } from 'date-fns';

const recordPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  amountPaid: z.coerce.number().min(0, { message: 'Amount paid must be non-negative.' }),
});

type RecordPaymentFormValues = z.infer<typeof recordPaymentFormSchema>;

interface RecordPaymentFormProps {
  payment: Payment; // The payment to be recorded
  onSubmit: (data: { paymentDate: string; amountPaid: number }) => void;
  isLoading?: boolean;
}

export function RecordPaymentForm({ payment, onSubmit, isLoading }: RecordPaymentFormProps) {
  const form = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentFormSchema),
    defaultValues: {
      paymentDate: payment.paymentDate ? parseISO(payment.paymentDate) : new Date(),
      amountPaid: payment.amountPaid || payment.amountExpected,
    },
  });

  const handleSubmit = (values: RecordPaymentFormValues) => {
    onSubmit({
      paymentDate: formatISO(values.paymentDate),
      amountPaid: values.amountPaid,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormDescription>
          Recording payment for Month {payment.monthNumber} (Due: {formatDate(payment.dueDate)}).
          Expected amount: {formatCurrency(payment.amountExpected)}.
        </FormDescription>
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
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
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
          name="amountPaid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount Paid (INR)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 1000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Saving...' : 'Record Payment'}
        </Button>
      </form>
    </Form>
  );
}
