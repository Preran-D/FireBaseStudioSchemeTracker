
'use client';

import { useEffect } from 'react'; 
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
import { cn } from '@/lib/utils'; // Removed formatDate
import type { Scheme } from '@/types/scheme';
import { formatISO, parseISO, format } from 'date-fns'; // Added date-fns/format

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

type SchemeFormValues = z.infer<typeof schemeFormSchema>;

type SchemeFormInputValues = Omit<SchemeFormValues, 'monthlyPaymentAmount' | 'startDate'> & {
  monthlyPaymentAmount?: string | number;
  startDate?: Date; 
};


interface SchemeFormProps {
  onSubmit: (data: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths' | 'closureDate'> & { customerGroupName?: string }) => void;
  initialData?: Partial<Scheme>; 
  isLoading?: boolean;
  existingGroupNames?: string[];
  defaultValuesOverride?: Partial<SchemeFormInputValues>; 
}

export function SchemeForm({ onSubmit, initialData, isLoading, existingGroupNames = [], defaultValuesOverride }: SchemeFormProps) {
  
  const getResolvedDefaultValues = (): SchemeFormInputValues => {
    let resolvedStartDate = new Date();
    if (defaultValuesOverride?.startDate) {
      // Assuming if startDate is in defaultValuesOverride, it's already a Date object
      resolvedStartDate = defaultValuesOverride.startDate;
    } else if (initialData?.startDate) {
      const parsed = parseISO(initialData.startDate);
      if (!isNaN(parsed.getTime())) {
        resolvedStartDate = parsed;
      }
      // If parsing fails, resolvedStartDate remains new Date()
    }

    if (defaultValuesOverride && Object.keys(defaultValuesOverride).length > 0) {
      return {
        customerName: defaultValuesOverride.customerName || '',
        customerPhone: defaultValuesOverride.customerPhone || '',
        customerAddress: defaultValuesOverride.customerAddress || '',
        startDate: resolvedStartDate, // Use processed start date
        monthlyPaymentAmount: defaultValuesOverride.monthlyPaymentAmount ?? '',
        groupOption: defaultValuesOverride.groupOption || (existingGroupNames.length > 0 ? 'none' : 'new'),
        existingGroupName: defaultValuesOverride.existingGroupName || '',
        newGroupName: defaultValuesOverride.newGroupName || '',
      };
    }
    if (initialData) { 
      return {
        customerName: initialData.customerName || '',
        customerPhone: initialData.customerPhone || '',
        customerAddress: initialData.customerAddress || '',
        startDate: resolvedStartDate, // Use processed start date
        monthlyPaymentAmount: initialData.monthlyPaymentAmount ?? '',
        groupOption: initialData.customerGroupName 
          ? (existingGroupNames.includes(initialData.customerGroupName) ? 'existing' : 'new') 
          : (existingGroupNames.length > 0 ? 'none' : 'new'),
        existingGroupName: initialData.customerGroupName && existingGroupNames.includes(initialData.customerGroupName) ? initialData.customerGroupName : '',
        newGroupName: initialData.customerGroupName && !existingGroupNames.includes(initialData.customerGroupName) ? initialData.customerGroupName : '',
      };
    }
    return {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      startDate: resolvedStartDate, // Use processed start date (which is new Date() here)
      monthlyPaymentAmount: '',
      groupOption: existingGroupNames.length > 0 ? 'none' : 'new',
      existingGroupName: '',
      newGroupName: '',
    };
  };
  
  const form = useForm<SchemeFormValues>({ 
    resolver: zodResolver(schemeFormSchema),
    defaultValues: getResolvedDefaultValues(),
    mode: 'onTouched',
  });
  
  useEffect(() => {
    form.reset(getResolvedDefaultValues());
  }, [defaultValuesOverride, initialData, existingGroupNames, form.reset]); 

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
                  value={field.value} 
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
                  value={field.value || ""} 
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
                <Input 
                  type="number" 
                  placeholder="e.g., 1000" 
                  {...field} 
                  onChange={event => field.onChange(event.target.value === '' ? undefined : event.target.value)} 
                  value={field.value ?? ''} 
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
