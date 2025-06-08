
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Users2, Edit, Trash2, DollarSign, ListChecks, Users, Loader2 } from 'lucide-react';
import type { GroupDetail, Scheme } from '@/types/scheme';
import { getGroupDetails, updateMockGroupName, deleteMockGroup, recordNextDuePaymentsForCustomerGroup } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { BatchRecordPaymentDialog } from '@/components/dialogs/BatchRecordPaymentDialog';
import { EditGroupNameDialog } from '@/components/dialogs/EditGroupNameDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/utils';

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [selectedGroupForBatch, setSelectedGroupForBatch] = useState<GroupDetail | null>(null);
  const [isBatchRecording, setIsBatchRecording] = useState(false);

  const [groupToEdit, setGroupToEdit] = useState<GroupDetail | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);

  const [groupToDelete, setGroupToDelete] = useState<GroupDetail | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const loadGroups = useCallback(() => {
    setIsLoading(true);
    const details = getGroupDetails();
    setGroups(details);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleBatchRecordSubmit = (details: { paymentDate: string; modeOfPayment: any[] }) => {
    if (!selectedGroupForBatch) return;
    setIsBatchRecording(true);
    const result = recordNextDuePaymentsForCustomerGroup(selectedGroupForBatch.groupName, details);
    
    toast({
      title: "Batch Payment Processed",
      description: `Recorded ${result.paymentsRecordedCount} payment(s) for group "${selectedGroupForBatch.groupName}", totaling ${formatCurrency(result.totalRecordedAmount)}.`,
    });
    
    setSelectedGroupForBatch(null);
    setIsBatchRecording(false);
    loadGroups(); 
  };

  const handleEditGroupNameSubmit = (newGroupName: string) => {
    if (!groupToEdit || groupToEdit.groupName === newGroupName) {
      setGroupToEdit(null);
      if(groupToEdit && groupToEdit.groupName === newGroupName) {
        toast({ title: 'No Change', description: 'Group name was not changed.', variant: 'default' });
      }
      return;
    }
    setIsEditingName(true);
    const success = updateMockGroupName(groupToEdit.groupName, newGroupName);
    if (success) {
      toast({ title: 'Group Renamed', description: `Group "${groupToEdit.groupName}" renamed to "${newGroupName}".` });
      loadGroups();
    } else {
      toast({ title: 'Error', description: 'Failed to rename group. Name might be invalid or already in use.', variant: 'destructive' });
    }
    setGroupToEdit(null);
    setIsEditingName(false);
  };

  const handleDeleteGroupConfirm = () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    const success = deleteMockGroup(groupToDelete.groupName);
     if (success) {
      toast({ title: 'Group Deleted', description: `Group "${groupToDelete.groupName}" association has been removed from all schemes.` });
      loadGroups();
    } else {
      toast({ title: 'Error', description: 'Failed to delete group.', variant: 'destructive' });
    }
    setGroupToDelete(null);
    setIsDeletingGroup(false);
  };


  if (isLoading && groups.length === 0) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-headline font-semibold">Customer Groups</h1>
        <Button asChild>
          <Link href="/schemes/new">
            <Users className="mr-2 h-4 w-4" /> Add Scheme (to create/assign groups)
          </Link>
        </Button>
      </div>

      {groups.length === 0 && !isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>No Groups Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No customer groups have been created yet. You can assign or create groups when adding a new scheme.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.groupName} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Users2 className="h-5 w-5 text-primary" />
                  {group.groupName}
                </CardTitle>
                <CardDescription>
                  {group.customerNames.length} customer(s) across {group.totalSchemesInGroup} scheme(s).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                <p><strong>Customers:</strong> {group.customerNames.join(', ') || 'N/A'}</p>
                <p><strong>Recordable Schemes:</strong> {group.recordableSchemeCount} scheme(s) with next payment due.</p>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setSelectedGroupForBatch(group)} 
                  disabled={group.recordableSchemeCount === 0 || isBatchRecording || isEditingName || isDeletingGroup}
                  className="w-full sm:w-auto"
                >
                  <DollarSign className="mr-2 h-4 w-4" /> Record Payments
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                 <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setGroupToEdit(group)}
                    disabled={isBatchRecording || isEditingName || isDeletingGroup}
                    className="flex-1"
                  >
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setGroupToDelete(group)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-1"
                    disabled={isBatchRecording || isEditingName || isDeletingGroup}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {selectedGroupForBatch && (
        <BatchRecordPaymentDialog
          groupDisplayName={selectedGroupForBatch.groupName}
          schemesInGroup={selectedGroupForBatch.schemes}
          isOpen={!!selectedGroupForBatch}
          onClose={() => setSelectedGroupForBatch(null)}
          onSubmit={handleBatchRecordSubmit}
          isLoading={isBatchRecording}
        />
      )}

      {groupToEdit && (
        <EditGroupNameDialog
          isOpen={!!groupToEdit}
          onClose={() => setGroupToEdit(null)}
          onSubmit={handleEditGroupNameSubmit}
          currentGroupName={groupToEdit.groupName}
          isLoading={isEditingName}
        />
      )}

      {groupToDelete && (
         <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the group "{groupToDelete.groupName}"? 
                This will remove the group association from all its schemes. Schemes and customers will not be deleted.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setGroupToDelete(null)} disabled={isDeletingGroup}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteGroupConfirm} disabled={isDeletingGroup} className="bg-destructive hover:bg-destructive/90">
                {isDeletingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

