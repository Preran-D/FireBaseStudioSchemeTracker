'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { SettingsIcon, Trash2, ArchiveRestore, RefreshCcw, Loader2, AlertTriangle, ArrowUpDown, Search, Users } from 'lucide-react'; // Added Users
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Scheme } from '@/types/scheme'; // ArchivedGroupInfo might be replaced by SupabaseArchivedGroup
// import { ArchivedGroupInfo } from '@/types/scheme'; // Potentially remove if SupabaseArchivedGroup is sufficient
import {
  // getArchivedMockSchemes, unarchiveMockScheme, deleteFullMockScheme, // Replaced for schemes
  // getArchivedGroupsMock, unarchiveMockGroup, deleteArchivedMockGroup, // Replaced for groups
  // getArchivedPaymentsForAllSchemes, unarchiveMockPayment, deleteArchivedMockPayment // To be replaced for payments
} from '@/lib/mock-data';
import {
  getArchivedSupabaseSchemes,
  unarchiveSupabaseScheme,
  deleteSupabaseScheme,
  getSupabaseArchivedGroups,
  unarchiveSupabaseGroup,
  deleteSupabaseArchivedGroup,
  getSupabaseArchivedPayments,  // Added
  unarchiveSupabasePayment,     // Added
  deleteSupabaseArchivedPayment // Added
} from '@/lib/supabase-data';
import type { SupabaseArchivedGroup, SupabaseArchivedPayment } from '@/lib/supabase-data'; // Import new types
import { formatDate, formatCurrency } from '@/lib/utils';
import { parseISO } from 'date-fns';
import type { Payment, SchemeStatus } from '@/types/scheme'; // Ensure Payment and SchemeStatus are imported


// Helper type for sorting
type SortableSchemeKeys = keyof Pick<Scheme, 'customerName' | 'id' | 'archivedDate' | 'closureDate'>;


export default function ArchiveManagementPage() {
  const { toast } = useToast();

  // State for Archived Schemes tab
  const [archivedSchemes, setArchivedSchemes] = useState<Scheme[]>([]);
  const [selectedArchivedSchemeIds, setSelectedArchivedSchemeIds] = useState<string[]>([]);
  const [isLoadingArchivedSchemes, setIsLoadingArchivedSchemes] = useState<boolean>(true);
  const [archivedSchemesSearchTerm, setArchivedSchemesSearchTerm] = useState<string>("");
  const [archivedSchemesSortColumn, setArchivedSchemesSortColumn] = useState<SortableSchemeKeys>("archivedDate");
  const [archivedSchemesSortDirection, setArchivedSchemesSortDirection] = useState<'asc' | 'desc'>("desc");
  const [showDeleteArchivedSchemeDialog, setShowDeleteArchivedSchemeDialog] = useState<boolean>(false);
  const [archivedSchemesPendingDeletion, setArchivedSchemesPendingDeletion] = useState<Scheme[]>([]);

  // State for Archived Groups tab
  const [archivedGroups, setArchivedGroups] = useState<SupabaseArchivedGroup[]>([]); // Use new type
  const [selectedArchivedGroupIds, setSelectedArchivedGroupIds] = useState<string[]>([]); // Store IDs now
  const [isLoadingArchivedGroups, setIsLoadingArchivedGroups] = useState<boolean>(true);
  const [archivedGroupsSearchTerm, setArchivedGroupsSearchTerm] = useState<string>("");
  type SortableGroupKeys = keyof SupabaseArchivedGroup; // Use new type
  const [archivedGroupsSortColumn, setArchivedGroupsSortColumn] = useState<SortableGroupKeys>("name");
  const [archivedGroupsSortDirection, setArchivedGroupsSortDirection] = useState<'asc' | 'desc'>("asc");
  const [showDeleteArchivedGroupDialog, setShowDeleteArchivedGroupDialog] = useState<boolean>(false);
  // Storing full group info for pending deletion to display details in dialog
  const [archivedGroupsPendingDeletion, setArchivedGroupsPendingDeletion] = useState<SupabaseArchivedGroup[]>([]); // Use new type

  // State for Archived Transactions tab
  // type ArchivedPaymentEntry = Payment & { schemeId: string; customerName: string; schemeStatus?: SchemeStatus }; // Replaced by SupabaseArchivedPayment
  // type SelectedTransactionType = { paymentId: string; schemeId: string }; // Will become string[] for payment IDs
  const [archivedTransactions, setArchivedTransactions] = useState<SupabaseArchivedPayment[]>([]); // Use new type
  const [selectedArchivedPaymentIds, setSelectedArchivedPaymentIds] = useState<string[]>([]); // Store only payment IDs
  const [isLoadingArchivedTransactions, setIsLoadingArchivedTransactions] = useState<boolean>(true);
  const [archivedTransactionsSearchTerm, setArchivedTransactionsSearchTerm] = useState<string>("");
  type SortableTransactionKeys = keyof SupabaseArchivedPayment | 'customerName' | 'schemeId'; // Adjusted for new type
  const [archivedTransactionsSortColumn, setArchivedTransactionsSortColumn] = useState<SortableTransactionKeys>("archivedDate");
  const [archivedTransactionsSortDirection, setArchivedTransactionsSortDirection] = useState<'asc' | 'desc'>("desc");
  const [showDeleteArchivedTransactionDialog, setShowDeleteArchivedTransactionDialog] = useState<boolean>(false);
  const [archivedTransactionsPendingDeletion, setArchivedTransactionsPendingDeletion] = useState<SupabaseArchivedPayment[]>([]); // Use new type

  const loadArchivedTransactions = useCallback(async () => {
    setIsLoadingArchivedTransactions(true);
    try {
      const transactions = await getSupabaseArchivedPayments();
      setArchivedTransactions(transactions);
    } catch (error) {
      console.error("Error loading archived transactions from Supabase:", error);
      toast({ title: "Error loading archived transactions", description: "Could not fetch archived transactions. Please try again.", variant: "destructive" });
      setArchivedTransactions([]);
    } finally {
      setIsLoadingArchivedTransactions(false);
    }
  }, [toast]);

  useEffect(() => {
    loadArchivedTransactions();
  }, [loadArchivedTransactions]);

  const filteredAndSortedArchivedTransactions = useMemo(() => {
    let items = archivedTransactions.filter(transaction =>
      (transaction.customerName?.toLowerCase() || '').includes(archivedTransactionsSearchTerm.toLowerCase()) ||
      (transaction.schemeId?.toLowerCase() || '').includes(archivedTransactionsSearchTerm.toLowerCase()) ||
      (transaction.id?.toLowerCase() || '').includes(archivedTransactionsSearchTerm.toLowerCase())
    );

    items.sort((a, b) => {
      const valA = a[archivedTransactionsSortColumn as keyof ArchivedPaymentEntry];
      const valB = b[archivedTransactionsSortColumn as keyof ArchivedPaymentEntry];

      let comparison = 0;
      if (valA === undefined || valA === null) comparison = -1;
      else if (valB === undefined || valB === null) comparison = 1;
      else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (['archivedDate', 'paymentDate', 'dueDate'].includes(archivedTransactionsSortColumn) && valA && valB) {
         comparison = parseISO(valA as string).getTime() - parseISO(valB as string).getTime();
      }

      return archivedTransactionsSortDirection === 'asc' ? comparison : -comparison;
    });
    return items;
  }, [archivedTransactions, archivedTransactionsSearchTerm, archivedTransactionsSortColumn, archivedTransactionsSortDirection]);

  const handleSortArchivedTransactions = (column: SortableTransactionKeys) => {
    if (archivedTransactionsSortColumn === column) {
      setArchivedTransactionsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setArchivedTransactionsSortColumn(column);
      setArchivedTransactionsSortDirection('desc');
    }
  };

  const handleSelectArchivedTransaction = (paymentId: string, checked: boolean) => {
    setSelectedArchivedPaymentIds(prev =>
      checked
        ? [...prev, paymentId]
        : prev.filter(id => id !== paymentId)
    );
  };

  const handleSelectAllArchivedTransactions = (checked: boolean) => {
    if (checked) {
      setSelectedArchivedPaymentIds(
        filteredAndSortedArchivedTransactions.map(t => t.id) // t.id is paymentId
      );
    } else {
      setSelectedArchivedPaymentIds([]);
    }
  };

  const isAllArchivedTransactionsSelected =
    filteredAndSortedArchivedTransactions.length > 0 &&
    selectedArchivedPaymentIds.length === filteredAndSortedArchivedTransactions.length;

  const handleRestoreSelectedArchivedTransactions = async () => {
    if (selectedArchivedPaymentIds.length === 0) {
      toast({ title: "No Transactions Selected", description: "Please select transactions to restore.", variant: "destructive" });
      return;
    }
    setIsLoadingArchivedTransactions(true);
    let successCount = 0;
    let errorCount = 0;
    for (const paymentId of selectedArchivedPaymentIds) {
      try {
        const restored = await unarchiveSupabasePayment(paymentId);
        if (restored) {
          successCount++;
        } else {
          errorCount++;
          const currentTransaction = archivedTransactions.find(t => t.id === paymentId);
          toast({ title: "Restore Error", description: `Could not restore transaction for ${currentTransaction?.customerName || paymentId}. It might have been already restored or an issue occurred.`, variant: "destructive" });
        }
      } catch (err) {
        errorCount++;
        const currentTransaction = archivedTransactions.find(t => t.id === paymentId);
        toast({ title: "Restore Error", description: `Error restoring transaction for ${currentTransaction?.customerName || paymentId}: ${(err as Error).message}`, variant: "destructive" });
      }
    }
    if (successCount > 0) {
      toast({ title: "Transactions Restored", description: `${successCount} transaction(s) successfully restored.` });
    }
     if (errorCount > 0 && successCount === 0) {
       toast({ title: "No Transactions Restored", description: `No transactions were restored. See previous error messages.`, variant: "default" });
    } else if (errorCount > 0 && successCount > 0) {
       toast({ title: "Partial Restore", description: `${successCount} restored, ${errorCount} errors.`, variant: "default" });
    }

    setSelectedArchivedPaymentIds([]);
    await loadArchivedTransactions();
  };

  const handleInitiateDeleteArchivedTransactions = () => {
    if (selectedArchivedPaymentIds.length === 0) {
      toast({ title: "No Transactions Selected", description: "Please select transactions to delete.", variant: "destructive" });
      return;
    }
    const transactionsToDelete = filteredAndSortedArchivedTransactions.filter(t =>
      selectedArchivedPaymentIds.includes(t.id)
    );
    setArchivedTransactionsPendingDeletion(transactionsToDelete);
    setShowDeleteArchivedTransactionDialog(true);
  };

  const handleConfirmDeleteSelectedArchivedTransactions = async () => {
    setIsLoadingArchivedTransactions(true);
    setShowDeleteArchivedTransactionDialog(false);
    let successCount = 0;
    let errorCount = 0;

    for (const paymentId of selectedArchivedPaymentIds) {
      try {
        const deleted = await deleteSupabaseArchivedPayment(paymentId);
        if (deleted) {
          successCount++;
        } else {
          errorCount++;
          const currentTransaction = archivedTransactions.find(t => t.id === paymentId);
          toast({ title: "Deletion Error", description: `Could not delete transaction for ${currentTransaction?.customerName || paymentId}. It might have been already deleted or an issue occurred.`, variant: "destructive" });
        }
      } catch(err) {
        errorCount++;
        const currentTransaction = archivedTransactions.find(t => t.id === paymentId);
        toast({ title: "Deletion Error", description: `Error deleting transaction for ${currentTransaction?.customerName || paymentId}: ${(err as Error).message}`, variant: "destructive" });
      }
    }

    if (successCount > 0) {
      toast({ title: "Transactions Deleted", description: `${successCount} transaction(s) permanently deleted.` });
    }
    if (errorCount > 0 && successCount === 0) {
       toast({ title: "No Transactions Deleted", description: `No transactions were deleted. See previous error messages.`, variant: "default" });
    } else if (errorCount > 0 && successCount > 0) {
       toast({ title: "Partial Deletion", description: `${successCount} deleted, ${errorCount} errors.`, variant: "default" });
    }

    setArchivedTransactionsPendingDeletion([]);
    setSelectedArchivedPaymentIds([]);
    await loadArchivedTransactions();
  };

  const loadArchivedGroups = useCallback(async () => {
    setIsLoadingArchivedGroups(true);
    try {
      const groups = await getSupabaseArchivedGroups();
      setArchivedGroups(groups);
    } catch (error) {
      console.error("Error loading archived groups from Supabase:", error);
      toast({ title: "Error loading archived groups", description: "Could not fetch archived groups. Please try again.", variant: "destructive" });
      setArchivedGroups([]);
    } finally {
      setIsLoadingArchivedGroups(false);
    }
  }, [toast]);

  useEffect(() => {
    loadArchivedGroups();
  }, [loadArchivedGroups]);

  const filteredAndSortedArchivedGroups = useMemo(() => {
    let items = archivedGroups.filter(group =>
      (group.name?.toLowerCase() || '').includes(archivedGroupsSearchTerm.toLowerCase())
    );

    items.sort((a, b) => {
      const valA = a[archivedGroupsSortColumn];
      const valB = b[archivedGroupsSortColumn];

      let comparison = 0;
      if (valA === undefined || valA === null) comparison = -1;
      else if (valB === undefined || valB === null) comparison = 1;
      else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (archivedGroupsSortColumn === 'archivedDate') {
         comparison = parseISO(valA as string).getTime() - parseISO(valB as string).getTime();
      }
      // Add more specific comparisons if other types for sortable columns

      return archivedGroupsSortDirection === 'asc' ? comparison : -comparison;
    });
    return items;
  }, [archivedGroups, archivedGroupsSearchTerm, archivedGroupsSortColumn, archivedGroupsSortDirection]);

  const handleSortArchivedGroups = (column: SortableGroupKeys) => {
    if (archivedGroupsSortColumn === column) {
      setArchivedGroupsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setArchivedGroupsSortColumn(column);
      setArchivedGroupsSortDirection('desc'); // Default to desc for new column
    }
  };

  const handleSelectArchivedGroup = (groupId: string, checked: boolean) => {
    setSelectedArchivedGroupIds(prev =>
      checked ? [...prev, groupId] : prev.filter(id => id !== groupId)
    );
  };

  const handleSelectAllArchivedGroups = (checked: boolean) => {
    if (checked) {
      setSelectedArchivedGroupIds(filteredAndSortedArchivedGroups.map(g => g.id));
    } else {
      setSelectedArchivedGroupIds([]);
    }
  };

  const isAllArchivedGroupsSelected = filteredAndSortedArchivedGroups.length > 0 && selectedArchivedGroupIds.length === filteredAndSortedArchivedGroups.length;

  const handleRestoreSelectedArchivedGroups = async () => {
    if (selectedArchivedGroupIds.length === 0) {
      toast({ title: "No Groups Selected", description: "Please select groups to restore.", variant: "destructive" });
      return;
    }
    setIsLoadingArchivedGroups(true);
    let successCount = 0;
    let errorCount = 0;
    for (const groupId of selectedArchivedGroupIds) {
      try {
        const restored = await unarchiveSupabaseGroup(groupId);
        if (restored) {
          successCount++;
        } else {
          errorCount++;
          const group = archivedGroups.find(g => g.id === groupId);
          toast({ title: "Restore Error", description: `Could not restore group ${group?.name || groupId}. It might have been already restored or an issue occurred.`, variant: "destructive" });
        }
      } catch (err) {
        errorCount++;
        const group = archivedGroups.find(g => g.id === groupId);
        toast({ title: "Restore Error", description: `Error restoring group ${group?.name || groupId}: ${(err as Error).message}`, variant: "destructive" });
      }
    }
    if (successCount > 0) {
      toast({ title: "Groups Restored", description: `${successCount} group(s) successfully restored. Group names are now available for reuse.` });
    }
     if (errorCount > 0 && successCount === 0) {
       toast({ title: "No Groups Restored", description: `No groups were restored. See previous error messages.`, variant: "default" });
    } else if (errorCount > 0 && successCount > 0) {
       toast({ title: "Partial Restore", description: `${successCount} restored, ${errorCount} errors.`, variant: "default" });
    }

    setSelectedArchivedGroupIds([]);
    await loadArchivedGroups();
  };

  const handleInitiateDeleteArchivedGroups = () => {
    if (selectedArchivedGroupIds.length === 0) {
      toast({ title: "No Groups Selected", description: "Please select groups to delete.", variant: "destructive" });
      return;
    }
    const groupsToDelete = filteredAndSortedArchivedGroups.filter(g => selectedArchivedGroupIds.includes(g.id));
    setArchivedGroupsPendingDeletion(groupsToDelete);
    setShowDeleteArchivedGroupDialog(true);
  };

  const handleConfirmDeleteSelectedArchivedGroups = async () => {
    setIsLoadingArchivedGroups(true);
    setShowDeleteArchivedGroupDialog(false);
    let successCount = 0;
    let errorCount = 0;

    for (const groupId of selectedArchivedGroupIds) {
      try {
        const deleted = await deleteSupabaseArchivedGroup(groupId);
        if (deleted) {
          successCount++;
        } else {
          errorCount++;
          const group = archivedGroups.find(g => g.id === groupId);
          toast({ title: "Deletion Error", description: `Could not delete group ${group?.name || groupId}. It might have been already deleted or an issue occurred.`, variant: "destructive" });
        }
      } catch (err) {
         errorCount++;
         const group = archivedGroups.find(g => g.id === groupId);
         toast({ title: "Deletion Error", description: `Error deleting group ${group?.name || groupId}: ${(err as Error).message}`, variant: "destructive" });
      }
    }

    if (successCount > 0) {
      toast({ title: "Groups Deleted", description: `${successCount} group(s) permanently deleted.` });
    }
    if (errorCount > 0 && successCount === 0) {
       toast({ title: "No Groups Deleted", description: `No groups were deleted. See previous error messages.`, variant: "default" });
    } else if (errorCount > 0 && successCount > 0) {
       toast({ title: "Partial Deletion", description: `${successCount} deleted, ${errorCount} errors.`, variant: "default" });
    }

    setArchivedGroupsPendingDeletion([]);
    setSelectedArchivedGroupIds([]);
    await loadArchivedGroups();
  };


  const loadArchivedSchemes = useCallback(async () => {
    setIsLoadingArchivedSchemes(true);
    try {
      const schemes = await getArchivedSupabaseSchemes();
      setArchivedSchemes(schemes);
    } catch (error) {
      console.error("Error loading archived schemes from Supabase:", error);
      toast({ title: "Error loading archived schemes", description: "Could not fetch archived schemes. Please try again.", variant: "destructive" });
      setArchivedSchemes([]);
    } finally {
      setIsLoadingArchivedSchemes(false);
    }
  }, [toast]);

  useEffect(() => {
    loadArchivedSchemes();
  }, [loadArchivedSchemes]);

  const filteredAndSortedSchemes = useMemo(() => {
    let items = archivedSchemes.filter(scheme =>
      (scheme.customerName?.toLowerCase() || '').includes(archivedSchemesSearchTerm.toLowerCase()) ||
      (scheme.id?.toLowerCase() || '').includes(archivedSchemesSearchTerm.toLowerCase())
    );

    items.sort((a, b) => {
      const valA = a[archivedSchemesSortColumn];
      const valB = b[archivedSchemesSortColumn];

      let comparison = 0;
      if (valA === undefined || valA === null) comparison = -1;
      else if (valB === undefined || valB === null) comparison = 1;
      else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (archivedSchemesSortColumn === 'archivedDate' || archivedSchemesSortColumn === 'closureDate') {
        // Assuming dates are ISO strings
        comparison = parseISO(valA as string).getTime() - parseISO(valB as string).getTime();
      }

      return archivedSchemesSortDirection === 'asc' ? comparison : -comparison;
    });

    return items;
  }, [archivedSchemes, archivedSchemesSearchTerm, archivedSchemesSortColumn, archivedSchemesSortDirection]);

  const handleSortArchivedSchemes = (column: SortableSchemeKeys) => {
    if (archivedSchemesSortColumn === column) {
      setArchivedSchemesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setArchivedSchemesSortColumn(column);
      setArchivedSchemesSortDirection('desc');
    }
  };

  const handleSelectArchivedScheme = (schemeId: string, checked: boolean) => {
    setSelectedArchivedSchemeIds(prev =>
      checked ? [...prev, schemeId] : prev.filter(id => id !== schemeId)
    );
  };

  const handleSelectAllArchivedSchemes = (checked: boolean) => {
    if (checked) {
      setSelectedArchivedSchemeIds(filteredAndSortedSchemes.map(s => s.id));
    } else {
      setSelectedArchivedSchemeIds([]);
    }
  };

  const isAllArchivedSchemesSelected = filteredAndSortedSchemes.length > 0 && selectedArchivedSchemeIds.length === filteredAndSortedSchemes.length;


  const handleRestoreSelectedArchivedSchemes = async () => {
    if (selectedArchivedSchemeIds.length === 0) {
      toast({ title: "No Schemes Selected", description: "Please select schemes to restore.", variant: "destructive" });
      return;
    }
    setIsLoadingArchivedSchemes(true);
    let successCount = 0;
    let errorCount = 0;
    for (const schemeId of selectedArchivedSchemeIds) {
      try {
        const restoredScheme = await unarchiveSupabaseScheme(schemeId);
        if (restoredScheme) {
          successCount++;
        } else {
          errorCount++;
          const currentScheme = archivedSchemes.find(s => s.id === schemeId);
          toast({ title: "Restore Error", description: `Could not restore scheme ${currentScheme?.customerName || schemeId.toUpperCase()}. It might have been already restored or an issue occurred.`, variant: "destructive" });
        }
      } catch (error) {
        errorCount++;
        const currentScheme = archivedSchemes.find(s => s.id === schemeId);
        toast({ title: "Restore Error", description: `Error restoring scheme ${currentScheme?.customerName || schemeId.toUpperCase()}: ${(error as Error).message}`, variant: "destructive" });
      }
    }
    if (successCount > 0) {
      toast({ title: "Schemes Restored", description: `${successCount} scheme(s) successfully restored.` });
    }
    if (errorCount > 0 && successCount === 0) {
       toast({ title: "No Schemes Restored", description: `No schemes were restored. See previous error messages.`, variant: "default" });
    } else if (errorCount > 0 && successCount > 0) {
       toast({ title: "Partial Restore", description: `${successCount} restored, ${errorCount} errors.`, variant: "default" });
    }

    setSelectedArchivedSchemeIds([]);
    await loadArchivedSchemes(); // Refreshes list and sets loading to false
  };

  const handleInitiateDeleteArchivedSchemes = () => {
    if (selectedArchivedSchemeIds.length === 0) {
      toast({ title: "No Schemes Selected", description: "Please select schemes to delete.", variant: "destructive" });
      return;
    }
    const schemesToDelete = filteredAndSortedSchemes.filter(s => selectedArchivedSchemeIds.includes(s.id));
    setArchivedSchemesPendingDeletion(schemesToDelete);
    setShowDeleteArchivedSchemeDialog(true);
  };

  const handleConfirmDeleteSelectedArchivedSchemes = async () => {
    setIsLoadingArchivedSchemes(true); // Use main loader
    setShowDeleteArchivedSchemeDialog(false);
    let successCount = 0;
    let errorCount = 0;

    for (const schemeId of selectedArchivedSchemeIds) {
      try {
        const deleted = await deleteSupabaseScheme(schemeId);
        if (deleted) { // deleteSupabaseScheme returns true on success
          successCount++;
        } else {
          errorCount++;
          const currentScheme = archivedSchemes.find(s => s.id === schemeId);
          toast({ title: "Deletion Error", description: `Could not delete scheme ${currentScheme?.customerName || schemeId.toUpperCase()}. It might have been already deleted or an issue occurred.`, variant: "destructive" });
        }
      } catch (error) {
        errorCount++;
        const currentScheme = archivedSchemes.find(s => s.id === schemeId);
        toast({ title: "Deletion Error", description: `Error deleting scheme ${currentScheme?.customerName || schemeId.toUpperCase()}: ${(error as Error).message}`, variant: "destructive" });
      }
    }

    if (successCount > 0) {
      toast({ title: "Schemes Deleted", description: `${successCount} scheme(s) permanently deleted.` });
    }
     if (errorCount > 0 && successCount === 0) {
       toast({ title: "No Schemes Deleted", description: `No schemes were deleted. See previous error messages.`, variant: "default" });
    } else if (errorCount > 0 && successCount > 0) {
       toast({ title: "Partial Deletion", description: `${successCount} deleted, ${errorCount} errors.`, variant: "default" });
    }

    setArchivedSchemesPendingDeletion([]);
    setSelectedArchivedSchemeIds([]);
    await loadArchivedSchemes(); // Refreshes list and sets loading to false
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-headline font-semibold flex items-center gap-2">
        <SettingsIcon className="h-8 w-8 text-primary" />
        Archive Management
      </h1>
      <Tabs defaultValue="archived-schemes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="archived-schemes">Archived Schemes</TabsTrigger>
          <TabsTrigger value="archived-groups">Archived Groups</TabsTrigger>
          <TabsTrigger value="archived-transactions">Archived Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="archived-schemes">
          <Card>
            <CardHeader>
              <CardTitle>Archived Schemes</CardTitle>
              <CardDescription>
                Manage your archived schemes. You can restore them to their previous state or permanently delete them.
                Currently showing {filteredAndSortedSchemes.length} of {archivedSchemes.length} archived schemes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                  <Input
                    placeholder="Search by Customer Name or Scheme ID..."
                    value={archivedSchemesSearchTerm}
                    onChange={(e) => setArchivedSchemesSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                    disabled={isLoadingArchivedSchemes}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRestoreSelectedArchivedSchemes}
                    disabled={selectedArchivedSchemeIds.length === 0 || isLoadingArchivedSchemes}
                  >
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Restore ({selectedArchivedSchemeIds.length})
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleInitiateDeleteArchivedSchemes}
                    disabled={selectedArchivedSchemeIds.length === 0 || isLoadingArchivedSchemes}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedArchivedSchemeIds.length})
                  </Button>
                </div>
              </div>
              <ScrollArea className="rounded-md border w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllArchivedSchemesSelected}
                          onCheckedChange={handleSelectAllArchivedSchemes}
                          aria-label="Select all archived schemes"
                          disabled={isLoadingArchivedSchemes || filteredAndSortedSchemes.length === 0}
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[200px]"
                        onClick={() => handleSortArchivedSchemes('customerName')}
                      >
                        <div className="flex items-center gap-1">
                          Customer Name
                          {archivedSchemesSortColumn === 'customerName' && <ArrowUpDown className={`h-3 w-3 ${archivedSchemesSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[120px]"
                        onClick={() => handleSortArchivedSchemes('id')}
                      >
                        <div className="flex items-center gap-1">
                          Scheme ID
                          {archivedSchemesSortColumn === 'id' && <ArrowUpDown className={`h-3 w-3 ${archivedSchemesSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[150px]"
                        onClick={() => handleSortArchivedSchemes('archivedDate')}
                      >
                        <div className="flex items-center gap-1">
                          Archived Date
                          {archivedSchemesSortColumn === 'archivedDate' && <ArrowUpDown className={`h-3 w-3 ${archivedSchemesSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[150px]"
                        onClick={() => handleSortArchivedSchemes('closureDate')}
                      >
                        <div className="flex items-center gap-1">
                          Original Closure Date
                          {archivedSchemesSortColumn === 'closureDate' && <ArrowUpDown className={`h-3 w-3 ${archivedSchemesSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px]">Total Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoadingArchivedSchemes && filteredAndSortedSchemes.map((scheme) => (
                      <TableRow key={scheme.id} data-state={selectedArchivedSchemeIds.includes(scheme.id) ? "selected" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedArchivedSchemeIds.includes(scheme.id)}
                            onCheckedChange={(checked) => handleSelectArchivedScheme(scheme.id, !!checked)}
                            aria-label={`Select scheme ${scheme.id.toUpperCase()}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/schemes/${scheme.id}`} passHref>
                            <Button variant="link" className="p-0 h-auto text-left whitespace-normal hover:underline">
                              {scheme.customerName}
                            </Button>
                          </Link>
                        </TableCell>
                        <TableCell>{scheme.id.toUpperCase()}</TableCell>
                        <TableCell>{formatDate(scheme.archivedDate)}</TableCell>
                        <TableCell>{formatDate(scheme.closureDate)}</TableCell>
                        <TableCell>{formatCurrency(scheme.totalCollected)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <p className="text-center text-muted-foreground text-sm pt-2">
                {isLoadingArchivedSchemes ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : (filteredAndSortedSchemes.length === 0 ? "No archived schemes found matching your criteria." : `Showing ${filteredAndSortedSchemes.length} of ${archivedSchemes.length} total archived schemes.`)}
              </p>
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog for Archived Schemes */}
          {showDeleteArchivedSchemeDialog && (
            <AlertDialog open={showDeleteArchivedSchemeDialog} onOpenChange={setShowDeleteArchivedSchemeDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    Confirm Permanent Deletion
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to permanently delete {archivedSchemesPendingDeletion.length} archived scheme(s):
                    <ScrollArea className="max-h-40 mt-2">
                      <ul className="list-disc pl-5 text-sm">
                        {archivedSchemesPendingDeletion.map(s => <li key={s.id}>{s.customerName} (ID: {s.id.toUpperCase()})</li>)}
                      </ul>
                    </ScrollArea>
                    This action cannot be undone. All associated data for these schemes will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowDeleteArchivedSchemeDialog(false)} disabled={isLoadingArchivedSchemes}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeleteSelectedArchivedSchemes} disabled={isLoadingArchivedSchemes} className="bg-destructive hover:bg-destructive/90">
                    {isLoadingArchivedSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TabsContent>
        <TabsContent value="archived-groups">
          <Card>
            <CardHeader>
              <CardTitle>Archived Groups</CardTitle>
              <CardDescription>
                Manage your archived groups. Group names can be restored for reuse. Schemes are not automatically re-associated.
                Currently showing {filteredAndSortedArchivedGroups.length} of {archivedGroups.length} archived groups.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                  <Input
                    placeholder="Search by Group Name..."
                    value={archivedGroupsSearchTerm}
                    onChange={(e) => setArchivedGroupsSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                    disabled={isLoadingArchivedGroups}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRestoreSelectedArchivedGroups}
                    disabled={selectedArchivedGroupIds.length === 0 || isLoadingArchivedGroups}
                  >
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Restore ({selectedArchivedGroupIds.length})
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleInitiateDeleteArchivedGroups}
                    disabled={selectedArchivedGroupIds.length === 0 || isLoadingArchivedGroups}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedArchivedGroupIds.length})
                  </Button>
                </div>
              </div>
              <ScrollArea className="rounded-md border w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllArchivedGroupsSelected}
                          onCheckedChange={handleSelectAllArchivedGroups}
                          aria-label="Select all archived groups"
                          disabled={isLoadingArchivedGroups || filteredAndSortedArchivedGroups.length === 0}
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[250px]"
                        onClick={() => handleSortArchivedGroups('name')}
                      >
                        <div className="flex items-center gap-1">
                          Group Name <Users className="h-4 w-4 text-muted-foreground" />
                          {archivedGroupsSortColumn === 'name' && <ArrowUpDown className={`h-3 w-3 ${archivedGroupsSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[180px]"
                        onClick={() => handleSortArchivedGroups('archivedDate')}
                      >
                        <div className="flex items-center gap-1">
                          Archived Date
                          {archivedGroupsSortColumn === 'archivedDate' && <ArrowUpDown className={`h-3 w-3 ${archivedGroupsSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[180px] text-right"
                        onClick={() => handleSortArchivedGroups('originalSchemeCount')}
                      >
                        <div className="flex items-center gap-1 justify-end">
                          Original Scheme Count
                          {archivedGroupsSortColumn === 'originalSchemeCount' && <ArrowUpDown className={`h-3 w-3 ${archivedGroupsSortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoadingArchivedGroups && filteredAndSortedArchivedGroups.map((group) => (
                      <TableRow key={group.id} data-state={selectedArchivedGroupIds.includes(group.id) ? "selected" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedArchivedGroupIds.includes(group.id)}
                            onCheckedChange={(checked) => handleSelectArchivedGroup(group.id, !!checked)}
                            aria-label={`Select group ${group.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>{formatDate(group.archivedDate)}</TableCell>
                        <TableCell className="text-right">{group.originalSchemeCount ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <p className="text-center text-muted-foreground text-sm pt-2">
                {isLoadingArchivedGroups ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : (filteredAndSortedArchivedGroups.length === 0 ? "No archived groups found matching your criteria." : `Showing ${filteredAndSortedArchivedGroups.length} of ${archivedGroups.length} total archived groups.`)}
              </p>
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog for Archived Groups */}
          {showDeleteArchivedGroupDialog && (
            <AlertDialog open={showDeleteArchivedGroupDialog} onOpenChange={setShowDeleteArchivedGroupDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    Confirm Permanent Deletion of Groups
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to permanently delete {archivedGroupsPendingDeletion.length} archived group(s):
                    <ScrollArea className="max-h-40 mt-2">
                      <ul className="list-disc pl-5 text-sm">
                        {archivedGroupsPendingDeletion.map(g => <li key={g.id}>{g.name} (Originally {g.originalSchemeCount} schemes)</li>)}
                      </ul>
                    </ScrollArea>
                    This action cannot be undone. Schemes previously in these groups will remain ungrouped.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowDeleteArchivedGroupDialog(false)} disabled={isLoadingArchivedGroups}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeleteSelectedArchivedGroups} disabled={isLoadingArchivedGroups} className="bg-destructive hover:bg-destructive/90">
                    {isLoadingArchivedGroups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TabsContent>
        <TabsContent value="archived-transactions">
          <Card>
            <CardHeader>
              <CardTitle>Archived Transactions (Payments)</CardTitle>
              <CardDescription>
                Manage your archived payments. You can restore them to their original scheme or permanently delete them.
                Currently showing {filteredAndSortedArchivedTransactions.length} of {archivedTransactions.length} archived transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                  <Input
                    placeholder="Search by Customer, Scheme ID, Payment ID..."
                    value={archivedTransactionsSearchTerm}
                    onChange={(e) => setArchivedTransactionsSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                    disabled={isLoadingArchivedTransactions}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRestoreSelectedArchivedTransactions}
                    disabled={selectedArchivedPaymentIds.length === 0 || isLoadingArchivedTransactions}
                  >
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Restore ({selectedArchivedPaymentIds.length})
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleInitiateDeleteArchivedTransactions}
                    disabled={selectedArchivedPaymentIds.length === 0 || isLoadingArchivedTransactions}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedArchivedPaymentIds.length})
                  </Button>
                </div>
              </div>
              <ScrollArea className="rounded-md border w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllArchivedTransactionsSelected}
                          onCheckedChange={handleSelectAllArchivedTransactions}
                          aria-label="Select all archived transactions"
                          disabled={isLoadingArchivedTransactions || filteredAndSortedArchivedTransactions.length === 0}
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSortArchivedTransactions('customerName')}>
                        Customer Name {archivedTransactionsSortColumn === 'customerName' && <ArrowUpDown className="h-3 w-3 inline" />}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSortArchivedTransactions('schemeId')}>
                        Scheme ID {archivedTransactionsSortColumn === 'schemeId' && <ArrowUpDown className="h-3 w-3 inline" />}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSortArchivedTransactions('monthNumber')}>
                        Month# {archivedTransactionsSortColumn === 'monthNumber' && <ArrowUpDown className="h-3 w-3 inline" />}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors text-right" onClick={() => handleSortArchivedTransactions('amountPaid')}>
                        Amount {archivedTransactionsSortColumn === 'amountPaid' && <ArrowUpDown className="h-3 w-3 inline" />}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSortArchivedTransactions('paymentDate')}>
                        Original Payment Date {archivedTransactionsSortColumn === 'paymentDate' && <ArrowUpDown className="h-3 w-3 inline" />}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSortArchivedTransactions('archivedDate')}>
                        Archived Date {archivedTransactionsSortColumn === 'archivedDate' && <ArrowUpDown className="h-3 w-3 inline" />}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoadingArchivedTransactions && filteredAndSortedArchivedTransactions.map((transaction) => (
                      <TableRow key={transaction.id} data-state={selectedArchivedPaymentIds.includes(transaction.id) ? "selected" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedArchivedPaymentIds.includes(transaction.id)}
                            onCheckedChange={(checked) => handleSelectArchivedTransaction(transaction.id, !!checked)}
                            aria-label={`Select transaction ${transaction.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                           <Link href={`/schemes/${transaction.schemeId}`} passHref>
                            <Button variant="link" className="p-0 h-auto text-left whitespace-normal hover:underline">
                              {transaction.customerName}
                            </Button>
                          </Link>
                        </TableCell>
                        <TableCell>{transaction.schemeId?.toUpperCase()}</TableCell>
                        <TableCell>{transaction.monthNumber}</TableCell>
                        <TableCell className="text-right">{formatCurrency(transaction.amountPaid)}</TableCell>
                        <TableCell>{formatDate(transaction.paymentDate)}</TableCell>
                        <TableCell>{formatDate(transaction.archivedDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <p className="text-center text-muted-foreground text-sm pt-2">
                {isLoadingArchivedTransactions ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : (filteredAndSortedArchivedTransactions.length === 0 ? "No archived transactions found matching your criteria." : `Showing ${filteredAndSortedArchivedTransactions.length} of ${archivedTransactions.length} total archived transactions.`)}
              </p>
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog for Archived Transactions */}
          {showDeleteArchivedTransactionDialog && (
            <AlertDialog open={showDeleteArchivedTransactionDialog} onOpenChange={setShowDeleteArchivedTransactionDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    Confirm Permanent Deletion of Transactions
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to permanently delete {archivedTransactionsPendingDeletion.length} archived transaction(s):
                    <ScrollArea className="max-h-40 mt-2">
                      <ul className="list-disc pl-5 text-sm">
                        {archivedTransactionsPendingDeletion.map(t => (
                          <li key={t.id}> {/* Use payment id as key */}
                            Payment for {t.customerName} (Scheme: {t.schemeId?.toUpperCase()}, Month: {t.monthNumber}, Amount: {formatCurrency(t.amountPaid)})
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                    This action cannot be undone. The payment records will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowDeleteArchivedTransactionDialog(false)} disabled={isLoadingArchivedTransactions}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeleteSelectedArchivedTransactions} disabled={isLoadingArchivedTransactions} className="bg-destructive hover:bg-destructive/90">
                    {isLoadingArchivedTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
