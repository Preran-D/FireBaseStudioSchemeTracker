
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate } from '@/lib/utils';
import type { Scheme } from '@/types/scheme';
import { formatISO, parseISO } from 'date-fns';

const schemeFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  startDate: z.date({ required_error: 'Scheme start date is required.' }),
  monthlyPaymentAmount: z.coerce.number().min(1, { message: 'Monthly payment amount must be positive.' }),
  groupOption: z.enum(['none', 'existing', 'new']).default('none'),
  existingGroupName: z.string().optional(),
  newGroupName: z.string().optional(),
}).refine(data => {
  if (data.groupOption === 'existing') {
    return !!data.existingGroupName && data.existingGroupName.trim() !== '';
  }
  if (data.groupOption === 'new') {
    return !!data.newGroupName && data.newGroupName.trim() !== '';
  }
  return true;
}, {
  message: "Please select an existing group or provide a new group name if that option is chosen.",
  path: ['existingGroupName'], 
});

type SchemeFormValues = z.infer<typeof schemeFormSchema>;

interface SchemeFormProps {
  onSubmit: (data: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'> & { customerGroupName?: string }) => void;
  initialData?: Partial<Scheme>;
  isLoading?: boolean;
  existingGroupNames?: string[];
}

export function SchemeForm({ onSubmit, initialData, isLoading, existingGroupNames = [] }: SchemeFormProps) {
  const form = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema),
    defaultValues: {
      customerName: initialData?.customerName || '',
      startDate: initialData?.startDate ? parseISO(initialData.startDate) : new Date(),
      monthlyPaymentAmount: initialData?.monthlyPaymentAmount ?? '',
      groupOption: initialData?.customerGroupName 
        ? (existingGroupNames.includes(initialData.customerGroupName) ? 'existing' : 'new') 
        : (existingGroupNames.length > 0 ? 'none' : 'none'), // Default to 'none'
      existingGroupName: initialData?.customerGroupName && existingGroupNames.includes(initialData.customerGroupName) ? initialData.customerGroupName : (existingGroupNames.length > 0 ? '' : undefined),
      newGroupName: initialData?.customerGroupName && !existingGroupNames.includes(initialData.customerGroupName) ? initialData.customerGroupName : '',
    },
  });

  const groupOption = form.watch('groupOption');

  const handleFormSubmit = (values: SchemeFormValues) => {
    let finalCustomerGroupName: string | undefined = undefined;
    if (values.groupOption === 'existing') {
      finalCustomerGroupName = values.existingGroupName;
    } else if (values.groupOption === 'new' && values.newGroupName) {
      finalCustomerGroupName = values.newGroupName.trim();
    }

    onSubmit({
      customerName: values.customerName,
      startDate: formatISO(values.startDate),
      monthlyPaymentAmount: values.monthlyPaymentAmount,
      customerGroupName: finalCustomerGroupName,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
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
          name="groupOption"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Customer Group Assignment</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Reset other fields when option changes
                    if (value !== 'existing') form.setValue('existingGroupName', '');
                    if (value !== 'new') form.setValue('newGroupName', '');
                  }}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="none" />
                    </FormControl>
                    <FormLabel className="font-normal">No Group</FormLabel>
                  </FormItem>
                  {existingGroupNames.length > 0 && (
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="existing" />
                      </FormControl>
                      <FormLabel className="font-normal">Assign to Existing Group</FormLabel>
                    </FormItem>
                  )}
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="new" />
                    </FormControl>
                    <FormLabel className="font-normal">Create New Group & Assign</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {groupOption === 'existing' && existingGroupNames.length > 0 && (
          <FormField
            control={form.control}
            name="existingGroupName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Existing Group</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {existingGroupNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {groupOption === 'new' && (
          <FormField
            control={form.control}
            name="newGroupName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Group Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter new group name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
                    disabled={(date) => date < new Date('1900-01-01')}
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
