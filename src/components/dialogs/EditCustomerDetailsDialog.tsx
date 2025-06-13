
'use client';

import { useEffect, useState } from 'react'; // Added useState
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { getUniqueSupabaseGroupNames } from '@/lib/supabase-data'; // For group name suggestions
import { useToast } from '@/hooks/use-toast'; // For error handling if group names fetch fails
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // For DatePicker
import { Calendar } from '@/components/ui/calendar'; // For DatePicker
import { CalendarIcon, Users2 } from 'lucide-react'; // For DatePicker icon & GroupName
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription, // Added for more complex field descriptions
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // For group selection


// Expanded schema for general scheme details
const editSchemeDetailsSchema = z.object({
  customerName: z.string().min(1, "Customer name cannot be empty."),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerGroupName: z.string().optional(),
  startDate: z.date({ required_error: "Start date is required." }),
  monthlyPaymentAmount: z.coerce.number().positive({ message: "Monthly amount must be positive." }),
  durationMonths: z.coerce.number().int().positive({ message: "Duration must be a positive whole number of months." }),
});

export type EditCustomerDetailsFormValues = z.infer<typeof editSchemeDetailsSchema>; // Renaming to EditSchemeDetailsFormValues would be clearer but keeping for subtask consistency

interface EditCustomerDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Pass the whole scheme or individual editable fields
  schemeToEdit: {
    id: string; // Not directly editable, but useful for context
    customerName: string;
    customerPhone?: string;
    customerAddress?: string;
    customerGroupName?: string;
    startDate: string; // ISO string
    monthlyPaymentAmount: number;
    durationMonths: number;
  };
  onSubmit: (updatedDetails: EditCustomerDetailsFormValues) => void; // originalName no longer needed
  isLoading?: boolean;
}

export function EditCustomerDetailsDialog({ // Consider renaming to EditSchemeDetailsDialog
  isOpen,
  onClose,
  schemeToEdit,
  onSubmit,
  isLoading,
}: EditCustomerDetailsDialogProps) {
  const { toast } = useToast();
  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchGroupNames = async () => {
        try {
          const names = await getUniqueSupabaseGroupNames();
          setExistingGroupNames(names);
        } catch (error) {
          console.error("Failed to fetch group names for dialog:", error);
          toast({ title: "Error", description: "Could not load group name suggestions.", variant: "destructive" });
        }
      };
      fetchGroupNames();
    }
  }, [isOpen, toast]);

  const form = useForm<EditCustomerDetailsFormValues>({
    resolver: zodResolver(editSchemeDetailsSchema),
    defaultValues: {
      customerName: schemeToEdit.customerName || '',
      customerPhone: schemeToEdit.customerPhone || '',
      customerAddress: schemeToEdit.customerAddress || '',
      customerGroupName: schemeToEdit.customerGroupName || '',
      startDate: schemeToEdit.startDate ? parseISO(schemeToEdit.startDate) : new Date(),
      monthlyPaymentAmount: schemeToEdit.monthlyPaymentAmount || 0,
      durationMonths: schemeToEdit.durationMonths || 12,
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (isOpen && schemeToEdit) {
      form.reset({
        customerName: schemeToEdit.customerName || '',
        customerPhone: schemeToEdit.customerPhone || '',
        customerAddress: schemeToEdit.customerAddress || '',
        customerGroupName: schemeToEdit.customerGroupName || '',
        startDate: schemeToEdit.startDate ? parseISO(schemeToEdit.startDate) : new Date(),
        monthlyPaymentAmount: schemeToEdit.monthlyPaymentAmount || 0,
        durationMonths: schemeToEdit.durationMonths || 12,
      });
    }
  }, [isOpen, schemeToEdit, form]);

  const handleSubmit = (values: EditCustomerDetailsFormValues) => {
    onSubmit(values); // Pass all values; parent will decide what to use for updateSupabaseScheme
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg"> {/* Increased width for more fields */}
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Scheme Details for {schemeToEdit.customerName}
          </DialogTitle>
          <DialogDescription>
            Update the scheme's core information below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-2">
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
                  <FormLabel>Customer Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Enter phone number (optional)" {...field} />
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
                  <FormLabel>Customer Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter full address (optional)" {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerGroupName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Users2 className="h-4 w-4 text-muted-foreground" /> Customer Group Name (Optional)
                  </FormLabel>
                  <FormControl>
                     <Input list="group-names-list" placeholder="Assign to a group or type new" {...field} />
                  </FormControl>
                   <datalist id="group-names-list">
                      {existingGroupNames.map(name => <option key={name} value={name} />)}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:col-span-2">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? format(field.value, 'dd MMM yyyy') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="monthlyPaymentAmount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Monthly Amount (INR)</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="e.g., 1000" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="durationMonths"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Duration (Months)</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="e.g., 12" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading || !form.formState.isDirty}> {/* Disable if not dirty */}
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
