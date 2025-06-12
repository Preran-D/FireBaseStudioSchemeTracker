
'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Scheme } from '@/types/scheme';

const assignGroupSchema = z.object({
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
  return true;
}, {
  message: "Please select a group or enter a new group name.",
  path: ['existingGroupName'], // You can point to a specific path or make it general
});


type AssignGroupFormValues = z.infer<typeof assignGroupSchema>;

interface AssignGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scheme: Scheme;
  existingGroupNames: string[];
  onSubmit: (schemeId: number, groupName?: string) => void;
  isLoading?: boolean;
}

export function AssignGroupDialog({ isOpen, onClose, scheme, existingGroupNames, onSubmit, isLoading }: AssignGroupDialogProps) {
  const form = useForm<AssignGroupFormValues>({
    resolver: zodResolver(assignGroupSchema),
    defaultValues: {
      assignmentType: scheme.customerGroupName ? 'existing' : (existingGroupNames.length > 0 ? 'existing' : 'new'),
      existingGroupName: scheme.customerGroupName || '',
      newGroupName: '',
    },
    mode: 'onTouched',
  });

  const assignmentType = form.watch('assignmentType');

  useEffect(() => {
    if (isOpen) {
      form.reset({
        assignmentType: scheme.customerGroupName ? 'existing' : (existingGroupNames.length > 0 ? 'existing' : 'new'),
        existingGroupName: scheme.customerGroupName || (existingGroupNames.length > 0 ? existingGroupNames[0] : ''),
        newGroupName: '',
      });
    }
  }, [isOpen, scheme, existingGroupNames, form]);

  const handleSubmit = (values: AssignGroupFormValues) => {
    let groupToAssign: string | undefined = undefined;
    if (values.assignmentType === 'existing') {
      groupToAssign = values.existingGroupName;
    } else if (values.assignmentType === 'new') {
      groupToAssign = values.newGroupName?.trim();
    }
    // If 'remove', groupToAssign remains undefined
    onSubmit(scheme.id, groupToAssign);
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Assign/Change Group for {scheme.customerName}</DialogTitle>
          <DialogDescription>
            Scheme ID: {scheme.id} <br/>
            Current Group: {scheme.customerGroupName || 'None'}
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
                      onValueChange={field.onChange}
                      defaultValue={field.value}
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
                      {scheme.customerGroupName && (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="remove" />
                          </FormControl>
                          <FormLabel className="font-normal">Remove from Current Group</FormLabel>
                        </FormItem>
                      )}
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
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Change
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
