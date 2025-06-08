
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon } from 'lucide-react';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import type { Payment, PaymentMode } from '@/types/scheme';
import { formatISO, parseISO } from 'date-fns';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

const recordPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  amountPaid: z.coerce.number().min(0.01, { message: 'Amount paid must be greater than 0.' }),
  modeOfPayment: z.array(z.enum(paymentModes)).min(1, { message: 'Select at least one payment mode.' }),
});

type RecordPaymentFormValues = z.infer<typeof recordPaymentFormSchema>;

interface RecordPaymentFormProps {
  payment: Payment;
  onSubmit: (data: { paymentDate: string; amountPaid: number, modeOfPayment: PaymentMode[] }) => void;
  isLoading?: boolean;
  isEdit?: boolean; // To slightly change button text if needed
}

export function RecordPaymentForm({ payment, onSubmit, isLoading, isEdit = false }: RecordPaymentFormProps) {
  const form = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentFormSchema),
    defaultValues: {
      paymentDate: payment.paymentDate ? parseISO(payment.paymentDate) : new Date(),
      amountPaid: payment.amountPaid || payment.amountExpected,
      modeOfPayment: payment.modeOfPayment || [],
    },
  });

  const handleSubmit = (values: RecordPaymentFormValues) => {
    onSubmit({
      paymentDate: formatISO(values.paymentDate),
      amountPaid: values.amountPaid,
      modeOfPayment: values.modeOfPayment,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {!isEdit && (
          <FormDescription>
            Recording payment for Month {payment.monthNumber} (Due: {formatDate(payment.dueDate)}).
            Expected amount: {formatCurrency(payment.amountExpected)}.
          </FormDescription>
        )}
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
                <Input type="number" step="0.01" placeholder="e.g., 1000" {...field} />
              </FormControl>
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
                <FormDescription>Select one or more payment modes.</FormDescription>
              </div>
              <div className="flex flex-wrap gap-4">
                {paymentModes.map((mode) => (
                  <FormField
                    key={mode}
                    control={form.control}
                    name="modeOfPayment"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={mode}
                          className="flex flex-row items-start space-x-2 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(mode)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), mode])
                                  : field.onChange(
                                      (field.value || []).filter(
                                        (value) => value !== mode
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {mode}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Saving...' : (isEdit ? 'Update Payment' : 'Record Payment')}
        </Button>
      </form>
    </Form>
  );
}
