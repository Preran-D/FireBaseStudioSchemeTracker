
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users2, Edit, Trash2, DollarSign, Eye, Loader2, MoreHorizontal, PlusCircle, Filter } from 'lucide-react';
import type { GroupDetail, Scheme, PaymentMode } from '@/types/scheme';
import { getGroupDetails, updateMockGroupName, deleteMockGroup, getMockSchemes, updateMockSchemePayment } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { RecordIndividualPaymentDialog, type IndividualPaymentDetails } from '@/components/dialogs/RecordIndividualPaymentDialog';
import { EditGroupNameDialog } from '@/components/dialogs/EditGroupNameDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatCurrency, getPaymentStatus, calculateSchemeTotals, getSchemeStatus } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function GroupsPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  const [initialSearchTermForDialog, setInitialSearchTermForDialog] = useState<string | undefined>(undefined);
  const [processingPayment, setProcessingPayment] = useState(false);


  const [groupToEdit, setGroupToEdit] = useState<GroupDetail | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);

  const [groupToDelete, setGroupToDelete] = useState<GroupDetail | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const loadData = useCallback(() => {
    setIsLoading(true);
    const loadedSchemesRaw = getMockSchemes();
    const processedSchemes = loadedSchemesRaw.map(s => {
        const tempS = { ...s };
        tempS.payments.forEach(p => p.status = getPaymentStatus(p, tempS.startDate));
        const totals = calculateSchemeTotals(tempS);
        const status = getSchemeStatus(tempS);
        return { ...tempS, ...totals, status };
      });
    setAllSchemes(processedSchemes);
    const details = getGroupDetails(); // getGroupDetails internally uses getMockSchemes, ensure it gets latest
    setGroups(details);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recordableSchemesForDialog = useMemo((): Scheme[] => {
    return allSchemes.filter(s => {
        if (s.status === 'Active' || s.status === 'Overdue') {
          for (let i = 0; i < s.payments.length; i++) {
            if (getPaymentStatus(s.payments[i], s.startDate) !== 'Paid') {
              let allPreviousPaid = true;
              for (let j = 0; j < i; j++) {
                if (getPaymentStatus(s.payments[j], s.startDate) !== 'Paid') {
                  allPreviousPaid = false;
                  break;
                }
              }
              if (allPreviousPaid) return true;
            }
          }
        }
        return false;
      });
  }, [allSchemes]);

  const handleOpenRecordPaymentDialog = (group: GroupDetail) => {
    setInitialSearchTermForDialog(group.groupName);
    setIsRecordPaymentDialogOpen(true);
  };

  const handleGroupPaymentsSubmit = (details: IndividualPaymentDetails) => {
    setProcessingPayment(true); // Indicate start of processing one payment
    const { schemeId, paymentDate, modeOfPayment, numberOfMonths } = details;
    const schemeToUpdate = allSchemes.find(s => s.id === schemeId);

    if (!schemeToUpdate) {
      toast({ title: "Error", description: `Scheme ${schemeId} not found.`, variant: "destructive" });
      setProcessingPayment(false);
      return;
    }
    
    let successfulRecords = 0;
    let totalAmountRecorded = 0;
    let errors = 0;

    let firstPaymentToRecordIndex = -1;
    for (let i = 0; i < schemeToUpdate.payments.length; i++) {
        if (getPaymentStatus(schemeToUpdate.payments[i], schemeToUpdate.startDate) !== 'Paid') {
            let allPreviousPaid = true;
            for (let j = 0; j < i; j++) {
                if (getPaymentStatus(schemeToUpdate.payments[j], schemeToUpdate.startDate) !== 'Paid') {
                    allPreviousPaid = false;
                    break;
                }
            }
            if (allPreviousPaid) {
                firstPaymentToRecordIndex = i;
                break;
            }
        }
    }
    
    if (firstPaymentToRecordIndex === -1) {
        // This case should ideally be prevented by the dialog logic (disabled selection if no recordable payments)
        toast({ title: "No Payments Due", description: `No recordable payments found for scheme ${schemeId.toUpperCase()}.`, variant: "default" });
        setProcessingPayment(false);
        return;
    }

    for (let i = 0; i < numberOfMonths; i++) {
      const paymentIndexToRecord = firstPaymentToRecordIndex + i;
      if (paymentIndexToRecord < schemeToUpdate.payments.length) {
        const paymentToRecord = schemeToUpdate.payments[paymentIndexToRecord];
        if (getPaymentStatus(paymentToRecord, schemeToUpdate.startDate) !== 'Paid') {
          const updatedScheme = updateMockSchemePayment(schemeId, paymentToRecord.id, {
            paymentDate: paymentDate,
            amountPaid: paymentToRecord.amountExpected,
            modeOfPayment: modeOfPayment,
          });
          if (updatedScheme) { successfulRecords++; totalAmountRecorded += paymentToRecord.amountExpected; } else { errors++; }
        } else {
          errors++; // Trying to record an already paid month
        }
      } else { errors++; break; } 
    }
    
    // This toast will appear for each successful payment submission from the dialog.
    // The dialog should handle a summary toast if it closes after processing multiple.
    // For now, we just report individual success/failure per call.
    if (successfulRecords > 0) {
      toast({
        title: "Payment(s) Recorded",
        description: `${successfulRecords} payment(s) totaling ${formatCurrency(totalAmountRecorded)} for ${schemeToUpdate.customerName} (Scheme: ${schemeId.toUpperCase()}) recorded.`
      });
    } else if (errors > 0) {
      toast({ title: "Error Recording Payment", description: `Could not record payment for scheme ${schemeId.toUpperCase()}.`, variant: "destructive" });
    }
    
    // Crucially, reload data after each payment to reflect changes in the GroupDetail calculations
    loadData(); 
    setProcessingPayment(false); 
    // The dialog itself handles its closure based on its internal logic or user action.
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
      loadData();
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
      loadData();
    } else {
      toast({ title: 'Error', description: 'Failed to delete group.', variant: 'destructive' });
    }
    setGroupToDelete(null);
    setIsDeletingGroup(false);
  };

  const filteredGroups = groups.filter(group => 
    group.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading && groups.length === 0) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-headline font-semibold">Customer Groups</h1>
        <Button asChild>
          <Link href="/schemes/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create Scheme & Assign Group
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group Overview</CardTitle>
          <CardDescription>Manage and track all customer groups. Groups are created when adding schemes.</CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Filter by group name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredGroups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No groups match your filter{searchTerm && groups.length > 0 ? '' : ' or no groups exist yet'}.</p>
              {groups.length === 0 && !isLoading && (
                <p className="text-sm">
                  You can create groups by assigning a "Customer Group Name" when
                  <Button variant="link" asChild className="p-1"><Link href="/schemes/new">adding a new scheme</Link></Button>.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group Name</TableHead>
                  <TableHead className="text-center">Customers</TableHead>
                  <TableHead className="text-center">Total Schemes</TableHead>
                  <TableHead className="text-center">Recordable Schemes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.groupName}>
                    <TableCell className="font-medium">{group.groupName}</TableCell>
                    <TableCell className="text-center">{group.customerNames.length}</TableCell>
                    <TableCell className="text-center">{group.totalSchemesInGroup}</TableCell>
                    <TableCell className="text-center">{group.recordableSchemeCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleOpenRecordPaymentDialog(group)} 
                          disabled={group.recordableSchemeCount === 0 || processingPayment || isEditingName || isDeletingGroup}
                        >
                          <DollarSign className="mr-2 h-4 w-4" /> Record
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                               <Link href={`/groups/${encodeURIComponent(group.groupName)}`} className="flex items-center">
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setGroupToEdit(group)} disabled={processingPayment || isEditingName || isDeletingGroup}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Name
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setGroupToDelete(group)} 
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              disabled={processingPayment || isEditingName || isDeletingGroup}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isRecordPaymentDialogOpen && (
        <RecordIndividualPaymentDialog
          isOpen={isRecordPaymentDialogOpen}
          onClose={() => {
            setIsRecordPaymentDialogOpen(false);
            setInitialSearchTermForDialog(undefined); // Clear initial search term on close
            loadData(); // Reload data when dialog closes to reflect any payments made
          }}
          allRecordableSchemes={recordableSchemesForDialog}
          allGroups={groups} 
          onSubmit={handleGroupPaymentsSubmit}
          isLoading={processingPayment}
          initialSearchTerm={initialSearchTermForDialog}
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
              <AlertDialogTitle>Confirm Delete Group Association</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the group association for "{groupToDelete.groupName}"? 
                This will remove the group name from all associated schemes. Schemes and customers themselves will not be deleted.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setGroupToDelete(null)} disabled={isDeletingGroup}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteGroupConfirm} disabled={isDeletingGroup} className="bg-destructive hover:bg-destructive/90">
                {isDeletingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Remove Association
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
