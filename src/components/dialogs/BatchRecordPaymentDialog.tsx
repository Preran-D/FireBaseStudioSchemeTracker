'use client';

import { useEffect, useState } from 'react'; // useMemo no longer needed for totalAmount
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
// Input removed as individual scheme amounts are not set here.
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Loader2, AlertCircle, CreditCard, Landmark, Smartphone } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils'; // getPaymentStatus removed
import type { PaymentMode } from '@/types/scheme';
import { formatISO, format } from 'date-fns';
// Removed imports related to individual scheme display in dialog: SegmentedProgressBar, Link, SchemeHistoryPanel, Search, Plus, Minus, ExternalLink, Users

const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];
const paymentModeIcons: Record<PaymentMode, React.ElementType> = {
  'Card': CreditCard,
  'Cash': Landmark, 
  'UPI': Smartphone,
  'System Closure': AlertCircle, // Should not be selectable by user
};

// Schema for the batch payment form (date and mode of payment)
const batchRecordPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
  modeOfPayment: z.array(z.enum(availablePaymentModes)).min(1, { message: 'Select at least one payment mode.' }),
});

type BatchRecordPaymentFormValues = z.infer<typeof batchRecordPaymentFormSchema>;

interface BatchRecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  recordableSchemesCount: number; // Number of schemes in the group that can receive payment
  onSubmitBatch: (paymentDate: string, modeOfPayment: PaymentMode[]) => Promise<{ successCount: number; errorCount: number; details: any[] }>;
  isLoading?: boolean;
}

export function BatchRecordPaymentDialog({
  isOpen,
  onClose,
  groupName,
  recordableSchemesCount,
  onSubmitBatch,
  isLoading,
}: BatchRecordPaymentDialogProps) {

  const form = useForm<BatchRecordPaymentFormValues>({
    resolver: zodResolver(batchRecordPaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      modeOfPayment: ['Cash'], // Default mode
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        paymentDate: new Date(),
        modeOfPayment: ['Cash'],
      });
    }
  }, [isOpen, form]);
  
  const handleSubmit = async (values: BatchRecordPaymentFormValues) => {
    await onSubmitBatch(formatISO(values.paymentDate), values.modeOfPayment);
    // Dialog closing and feedback will be handled by the parent component (page.tsx) based on promise result
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Record Batch Payment for Group: {groupName}</DialogTitle>
          <DialogDescription>
            This will attempt to record the next due payment for all eligible schemes in this group
            ({recordableSchemesCount} scheme(s) can receive payments).
            Set a common payment date and mode of payment.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-2">
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
                          type="button"
                          variant={'outline'}
                          className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          disabled={isLoading}
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
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01") || isLoading}
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
                    <FormMessage /> {/* For modeOfPayment validation errors */}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {availablePaymentModes.filter(mode => mode !== 'System Closure' && mode !== 'Imported').map((mode) => {
                       const Icon = paymentModeIcons[mode];
                       return(
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
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-1.5 cursor-pointer">
                                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                                {mode}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />
            {recordableSchemesCount === 0 && (
                 <div className="text-center text-muted-foreground py-2 flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4"/> No schemes in this group are currently eligible for payment recording.
                 </div>
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading || recordableSchemesCount === 0 || !form.formState.isValid}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Record Batch Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    {/* SchemeHistoryPanel removed as it's not relevant for a simple batch payment dialog */}
    </>
  );
}