
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

const editGroupNameSchema = z.object({
  newGroupName: z.string().min(1, { message: 'Group name cannot be empty.' }),
});

type EditGroupNameFormValues = z.infer<typeof editGroupNameSchema>;

interface EditGroupNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newGroupName: string) => void;
  currentGroupName: string;
  isLoading?: boolean;
}

export function EditGroupNameDialog({ isOpen, onClose, onSubmit, currentGroupName, isLoading }: EditGroupNameDialogProps) {
  const form = useForm<EditGroupNameFormValues>({
    resolver: zodResolver(editGroupNameSchema),
    defaultValues: {
      newGroupName: currentGroupName || '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ newGroupName: currentGroupName });
    }
  }, [isOpen, currentGroupName, form]);

  const handleSubmit = (values: EditGroupNameFormValues) => {
    onSubmit(values.newGroupName);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Group Name</DialogTitle>
          <DialogDescription>
            Change the name for the group: "{currentGroupName}". This will update all schemes in this group.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
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
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
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
