
'use client';

import { useEffect } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Pencil } from 'lucide-react';

const editCustomerDetailsSchema = z.object({
  customerName: z.string().min(1, "Customer name cannot be empty."),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
});

export type EditCustomerDetailsFormValues = z.infer<typeof editCustomerDetailsSchema>;

interface EditCustomerDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  originalCustomerName: string;
  currentPhone?: string;
  currentAddress?: string;
  onSubmit: (originalName: string, newDetails: EditCustomerDetailsFormValues) => void;
  isLoading?: boolean;
}

export function EditCustomerDetailsDialog({
  isOpen,
  onClose,
  originalCustomerName,
  currentPhone,
  currentAddress,
  onSubmit,
  isLoading,
}: EditCustomerDetailsDialogProps) {
  const form = useForm<EditCustomerDetailsFormValues>({
    resolver: zodResolver(editCustomerDetailsSchema),
    defaultValues: {
      customerName: originalCustomerName || '',
      customerPhone: currentPhone || '',
      customerAddress: currentAddress || '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        customerName: originalCustomerName || '',
        customerPhone: currentPhone || '',
        customerAddress: currentAddress || '',
      });
    }
  }, [isOpen, originalCustomerName, currentPhone, currentAddress, form]);

  const handleSubmit = (values: EditCustomerDetailsFormValues) => {
    onSubmit(originalCustomerName, values);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Details for {originalCustomerName}
          </DialogTitle>
          <DialogDescription>
            Update the name, phone number, and address for this customer. Name changes apply to all their schemes and must be unique.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
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
                    <Textarea placeholder="Enter full address (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
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
