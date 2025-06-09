
'use client';

import { useEffect } from 'react'; // Added useEffect
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
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

// This is the Zod-validated type
type SchemeFormValues = z.infer<typeof schemeFormSchema>;

// This type represents the raw values the form might hold or receive as defaults,
// where numbers might be strings.
type SchemeFormInputValues = Omit<SchemeFormValues, 'monthlyPaymentAmount' | 'startDate'> & {
  monthlyPaymentAmount?: string | number;
  startDate?: Date; // Date object for the picker
};


interface SchemeFormProps {
  onSubmit: (data: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths' | 'closureDate'> & { customerGroupName?: string }) => void;
  initialData?: Partial<Scheme>; // For editing existing scheme
  isLoading?: boolean;
  existingGroupNames?: string[];
  defaultValuesOverride?: Partial<SchemeFormInputValues>; // For pre-filling new scheme
}

export function SchemeForm({ onSubmit, initialData, isLoading, existingGroupNames = [], defaultValuesOverride }: SchemeFormProps) {
  
  // Determine initial form values by prioritizing defaultValuesOverride, then initialData, then empty/defaults
  const getResolvedDefaultValues = (): SchemeFormInputValues => {
    if (defaultValuesOverride && Object.keys(defaultValuesOverride).length > 0) {
      return {
        customerName: defaultValuesOverride.customerName || '',
        customerPhone: defaultValuesOverride.customerPhone || '',
        customerAddress: defaultValuesOverride.customerAddress || '',
        startDate: defaultValuesOverride.startDate || new Date(),
        monthlyPaymentAmount: defaultValuesOverride.monthlyPaymentAmount ?? '',
        groupOption: defaultValuesOverride.groupOption || (existingGroupNames.length > 0 ? 'none' : 'new'),
        existingGroupName: defaultValuesOverride.existingGroupName || '',
        newGroupName: defaultValuesOverride.newGroupName || '',
      };
    }
    if (initialData) { // Editing existing scheme
      return {
        customerName: initialData.customerName || '',
        customerPhone: initialData.customerPhone || '',
        customerAddress: initialData.customerAddress || '',
        startDate: initialData.startDate ? parseISO(initialData.startDate) : new Date(),
        monthlyPaymentAmount: initialData.monthlyPaymentAmount ?? '',
        groupOption: initialData.customerGroupName 
          ? (existingGroupNames.includes(initialData.customerGroupName) ? 'existing' : 'new') 
          : (existingGroupNames.length > 0 ? 'none' : 'new'),
        existingGroupName: initialData.customerGroupName && existingGroupNames.includes(initialData.customerGroupName) ? initialData.customerGroupName : '',
        newGroupName: initialData.customerGroupName && !existingGroupNames.includes(initialData.customerGroupName) ? initialData.customerGroupName : '',
      };
    }
    // Default for a completely new, un-prefilled scheme
    return {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      startDate: new Date(),
      monthlyPaymentAmount: '',
      groupOption: existingGroupNames.length > 0 ? 'none' : 'new',
      existingGroupName: '',
      newGroupName: '',
    };
  };
  
  const form = useForm<SchemeFormValues>({ // Use Zod validated type here
    resolver: zodResolver(schemeFormSchema),
    defaultValues: getResolvedDefaultValues(),
    mode: 'onTouched',
  });
  
  useEffect(() => {
    // Reset form if defaultValuesOverride or initialData changes.
    // This ensures pre-filling works correctly when navigating
    // to /new with query params or when initialData for editing is loaded.
    form.reset(getResolvedDefaultValues());
  }, [defaultValuesOverride, initialData, existingGroupNames, form.reset]); // form.reset is stable

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
      customerPhone: values.customerPhone,
      customerAddress: values.customerAddress,
      startDate: formatISO(values.startDate), // startDate from form is Date object
      monthlyPaymentAmount: values.monthlyPaymentAmount, // This is a number after Zod coercion
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
          name="customerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Phone (Optional)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="Enter phone number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customerAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Address (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter full address" {...field} />
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
                    if (value !== 'existing') form.setValue('existingGroupName', '');
                    if (value !== 'new') form.setValue('newGroupName', '');
                  }}
                  value={field.value} // Controlled component
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
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || ""} // Controlled component
                >
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
                {/* The field value will be a number after Zod coercion for submission, 
                    but react-hook-form stores it based on input (can be string).
                    The input type="number" helps, but value can still be stringish.
                    Zod's coerce.number() is key here. */}
                <Input 
                  type="number" 
                  placeholder="e.g., 1000" 
                  {...field} 
                  onChange={event => field.onChange(event.target.value === '' ? undefined : event.target.value)} // Handle empty string for optional number
                  value={field.value ?? ''} // Ensure value is string or number for input
                />
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
