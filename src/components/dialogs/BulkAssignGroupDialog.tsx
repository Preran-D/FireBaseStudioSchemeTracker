
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users2 } from 'lucide-react';

const bulkAssignGroupSchema = z.object({
  assignmentType: z.enum(['existing', 'new', 'remove']),
  existingGroupName: z.string().optional(),
  newGroupName: z.string().optional(),
}).refine(data => {
  if (data.assignmentType === 'existing') {
    return !!data.existingGroupName && data.existingGroupName.trim() !== '';
  }
  if (data.assignmentType === 'new') {
    return !!data.newGroupName && data.newGroupName.trim() !== '';
  }
  return true; // 'remove' type is always valid
}, {
  message: "Please select an existing group or provide a new group name if that option is chosen.",
  path: ['existingGroupName'], 
});


type BulkAssignGroupFormValues = z.infer<typeof bulkAssignGroupSchema>;

interface BulkAssignGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSchemeCount: number;
  existingGroupNames: string[];
  onSubmit: (groupName?: string) => void;
  isLoading?: boolean;
}

export function BulkAssignGroupDialog({ 
    isOpen, 
    onClose, 
    selectedSchemeCount, 
    existingGroupNames, 
    onSubmit, 
    isLoading 
}: BulkAssignGroupDialogProps) {
  const form = useForm<BulkAssignGroupFormValues>({
    resolver: zodResolver(bulkAssignGroupSchema),
    defaultValues: {
      assignmentType: existingGroupNames.length > 0 ? 'existing' : 'new',
      existingGroupName: existingGroupNames.length > 0 ? existingGroupNames[0] : '',
      newGroupName: '',
    },
    mode: 'onTouched',
  });

  const assignmentType = form.watch('assignmentType');

  useEffect(() => {
    // Reset form when dialog opens or group names change, to ensure fresh defaults
    if (isOpen) {
      form.reset({
        assignmentType: existingGroupNames.length > 0 ? 'existing' : 'new',
        existingGroupName: existingGroupNames.length > 0 ? existingGroupNames[0] : '',
        newGroupName: '',
      });
    }
  }, [isOpen, existingGroupNames, form]);

  const handleSubmit = (values: BulkAssignGroupFormValues) => {
    let groupToAssign: string | undefined = undefined;
    if (values.assignmentType === 'existing' && values.existingGroupName) {
      groupToAssign = values.existingGroupName;
    } else if (values.assignmentType === 'new' && values.newGroupName) {
      groupToAssign = values.newGroupName.trim();
    }
    // If 'remove', groupToAssign remains undefined
    onSubmit(groupToAssign);
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            Bulk Assign Group
          </DialogTitle>
          <DialogDescription>
            You are about to change the group for {selectedSchemeCount} selected scheme(s).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="assignmentType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Action</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset other fields when type changes for cleaner UX
                        if (value !== 'existing') form.setValue('existingGroupName', '');
                        if (value !== 'new') form.setValue('newGroupName', '');
                      }}
                      value={field.value} // Use value from form state
                      className="flex flex-col space-y-1"
                    >
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
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="remove" />
                        </FormControl>
                        <FormLabel className="font-normal">Remove from Current Group</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {assignmentType === 'existing' && existingGroupNames.length > 0 && (
              <FormField
                control={form.control}
                name="existingGroupName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Existing Group</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || ""} // Controlled component needs a valid value or ""
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

            {assignmentType === 'new' && (
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
            
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading || selectedSchemeCount === 0}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
