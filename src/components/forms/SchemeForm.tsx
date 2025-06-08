'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { Scheme } from '@/types/scheme';
import { formatISO, parseISO } from 'date-fns';

const schemeFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  startDate: z.date({ required_error: 'Scheme start date is required.' }),
  monthlyPaymentAmount: z.coerce.number().min(1, { message: 'Monthly payment amount must be positive.' }),
});

type SchemeFormValues = z.infer<typeof schemeFormSchema>;

interface SchemeFormProps {
  onSubmit: (data: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'>) => void;
  initialData?: Partial<Scheme>;
  isLoading?: boolean;
}

export function SchemeForm({ onSubmit, initialData, isLoading }: SchemeFormProps) {
  const form = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema),
    defaultValues: {
      customerName: initialData?.customerName || '',
      startDate: initialData?.startDate ? parseISO(initialData.startDate) : new Date(),
      monthlyPaymentAmount: initialData?.monthlyPaymentAmount ?? '', // Ensure defined value, empty string for undefined/null
    },
  });

  const handleSubmit = (values: SchemeFormValues) => {
    onSubmit({
      ...values,
      startDate: formatISO(values.startDate),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter customer name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Scheme Start Date</FormLabel>
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
                    disabled={(date) => date < new Date('1900-01-01')} // Example past disabling
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
          name="monthlyPaymentAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly Payment Amount (INR)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 1000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Saving...' : (initialData?.id ? 'Update Scheme' : 'Create Scheme')}
        </Button>
      </form>
    </Form>
  );
}
