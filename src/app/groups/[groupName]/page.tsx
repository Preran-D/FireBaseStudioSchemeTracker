'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, ListChecks, DollarSign, AlertTriangle, Loader2, CreditCard, History, CheckSquare, Trash2, FileDown, Badge, Pencil } from 'lucide-react';
import type { Scheme, Payment, PaymentMode, SchemeStatus } from '@/types/scheme';
import { getMockSchemes, deleteFullMockScheme, updateMockGroupName, deleteMockGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, cn } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import React from 'react';
import { delay, motion } from 'framer-motion';
import { useToast } from "@/hooks/use-toast";
import { exportGroupSchemesToPdf } from '@/lib/pdfUtils'; // Import PDF export function
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExportPdfDialog from '@/components/dialogs/ExportPdfDialog';

const statusPriorityMap: Record<SchemeStatus, number> = {
  'Overdue': 0,
  'Active': 1,
  'Upcoming': 2,
  'Fully Paid': 3,
  'Closed': 4,
  Archived: 0
};

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const groupName = params.groupName ? decodeURIComponent(params.groupName as string) : '';

  const [allSchemesInGroup, setAllSchemesInGroup] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSchemePeekPanelOpen, setIsSchemePeekPanelOpen] = useState(false);
  const [schemeForPeekPanel, setSchemeForPeekPanel] = useState<Scheme | null>(null);
  const [schemeSearchTerm, setSchemeSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'customerNameAsc' | 'customerNameDesc' | 'statusPriority'>('customerNameAsc'); // Removed date-based sort options

  const [schemeToDelete, setSchemeToDelete] = useState<Scheme | null>(null);
  const [isDeletingScheme, setIsDeletingScheme] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportPdfDialogOpen, setIsExportPdfDialogOpen] = useState(false); // State for the export dialog

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState(groupName);
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [isConfirmingDeleteGroup, setIsConfirmingDeleteGroup] = useState(false);
  const [isDeletingGroupState, setIsDeletingGroupState] = useState(false); // Renamed to avoid conflict with scheme deletion

  const loadGroupSchemes = () => {
    if (groupName) {
      setIsLoading(true);
      const allSchemes = getMockSchemes();
      const schemesForThisGroup = allSchemes
        .filter(s => s.customerGroupName === groupName)
        .sort((a, b) => {
          const nameCompare = a.customerName.localeCompare(b.customerName);
          if (nameCompare !== 0) return nameCompare;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
      setAllSchemesInGroup(schemesForThisGroup);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroupSchemes();
  }, [groupName]);

  const groupedSchemes = useMemo(() => {
    let filteredForSearch = [...allSchemesInGroup];

    if (schemeSearchTerm) {
      const searchTermLower = schemeSearchTerm.toLowerCase();
      filteredForSearch = filteredForSearch.filter(scheme =>
        scheme.customerName.toLowerCase().includes(searchTermLower) ||
        scheme.id.toLowerCase().includes(searchTermLower)
      );
    }

    const groups: {
      customerName: string;
      schemes: Scheme[];
      totalSchemes: number;
      totalCollected: number;
      firstSchemeStartDate?: string;
      representativeStatusPriority: number;
    }[] = [];
    const customerMap = new Map<string, Scheme[]>();

    filteredForSearch.forEach(scheme => {
      if (!customerMap.has(scheme.customerName)) {
        customerMap.set(scheme.customerName, []);
      }
      customerMap.get(scheme.customerName)!.push(scheme);
    });

    customerMap.forEach((schemes, customerName) => {
      if (schemes.length > 0) {
        const totalCollectedForCustomer = schemes.reduce((sum, s) => sum + (s.totalCollected || 0), 0);
        
        let representativeStatusPriority = 4; 
        schemes.forEach(s => {
            const currentSchemePriority = statusPriorityMap[s.status];
            if (currentSchemePriority < representativeStatusPriority) {
                representativeStatusPriority = currentSchemePriority;
            }
        });

        groups.push({
          customerName,
          schemes,
          totalSchemes: schemes.length,
          totalCollected: totalCollectedForCustomer,
          firstSchemeStartDate: schemes[0]?.startDate,
          representativeStatusPriority,
        });
      }
    });

    groups.sort((a, b) => {
      switch (sortBy) {
        case 'customerNameAsc':
          return a.customerName.localeCompare(b.customerName);
        case 'customerNameDesc':
          return b.customerName.localeCompare(a.customerName);
        // Removed 'oldestFirst' and 'newestFirst' cases
        case 'statusPriority':
          return (a.representativeStatusPriority ?? 4) - (b.representativeStatusPriority ?? 4);
        default:
          return 0;
      }
    });
    return groups;
  }, [allSchemesInGroup, schemeSearchTerm, sortBy]);

  const groupSummaryStats = useMemo(() => {
    if (allSchemesInGroup.length === 0) {
      return {
        totalCustomers: 0,
        totalSchemes: 0,
        totalPaid: 0,
        totalPending: 0,
        totalOverdueAmount: 0,
        activeSchemesCount: 0,
      };
    }
    const uniqueCustomerNames = new Set(allSchemesInGroup.map(s => s.customerName));
    const totalPaid = allSchemesInGroup.reduce((sum, s) => sum + (s.totalCollected || 0), 0);
    const totalExpected = allSchemesInGroup.reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + p.amountExpected, 0), 0);
    const totalOverdueAmount = allSchemesInGroup
      .filter(s => s.status === 'Overdue')
      .reduce((sum, s) => {
        const overduePaymentForScheme = s.payments.find(p => p.status === 'Overdue');
        return sum + (overduePaymentForScheme?.amountExpected || 0);
      }, 0);

    return {
      totalCustomers: uniqueCustomerNames.size,
      totalSchemes: allSchemesInGroup.length,
      totalPaid,
      totalPending: totalExpected - totalPaid,
      totalOverdueAmount,
      activeSchemesCount: allSchemesInGroup.filter(s => s.status === 'Active' || s.status === 'Overdue').length,
    };
  }, [allSchemesInGroup]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4 }
    }),
  };

  const handleShowSchemePeek = (schemeToShow: Scheme) => {
    setSchemeForPeekPanel(schemeToShow);
    setIsSchemePeekPanelOpen(true);
  };

  const handleEditGroupName = () => {
    setNewGroupName(groupName);
    setIsEditingGroup(true);
  };

  const handleSaveGroupName = async () => {
    if (!newGroupName || newGroupName.trim() === '' || newGroupName.trim() === groupName) {
      toast({
        title: "Invalid Group Name",
        description: "New group name cannot be empty or the same as the current name.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingGroupName(true);
    await new Promise(resolve => delay(resolve, 500));
    const success = updateMockGroupName(groupName, newGroupName.trim());
    if (success) {
      toast({
        title: "Group Renamed",
        description: `Group "${groupName}" successfully renamed to "${newGroupName.trim()}".`,
      });
      // Redirect to the new group page
      router.push(`/groups/${encodeURIComponent(newGroupName.trim())}`);
    } else {
      toast({
        title: "Error Renaming Group",
        description: "Could not rename the group. A group with that name might already exist or an error occurred.",
        variant: "destructive",
      });
    }
    setIsEditingGroup(false);
    setIsSavingGroupName(false);
  };

  const handleDeleteGroup = () => {
    setIsConfirmingDeleteGroup(true);
  };

  const handleExportPdf = () => {
    // Opens the dialog instead of directly exporting
    if (allSchemesInGroup.length === 0) {
      toast({ title: "No Schemes", description: "There are no schemes in this group to export.", variant: "default" });
      return;
    }
    setIsExportPdfDialogOpen(true);
  };

  const handleConfirmExportPdf = async (exportType: 'condensed' | 'detailed') => {
    setIsExporting(true);
    setIsExportPdfDialogOpen(false); // Close dialog
    try {
      // Wait for a brief moment to allow UI to update (dialog to close, loader to show on button)
      await new Promise(resolve => setTimeout(resolve, 100));
      exportGroupSchemesToPdf(groupName, allSchemesInGroup, groupSummaryStats, exportType);
      toast({ title: "PDF Export Successful", description: `Schemes for group ${groupName} (${exportType}) are being downloaded.` });
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast({ title: "PDF Export Failed", description: `Could not generate ${exportType} PDF for schemes.`, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };
  
  const confirmDeleteGroup = async () => {
    setIsDeletingGroupState(true); // Use specific loading state
    setIsConfirmingDeleteGroup(false); // Close dialog immediately
    await new Promise(resolve => delay(resolve, 500));
    const success = deleteMockGroup(groupName);
    if (success) {
      toast({
        title: "Group Deleted",
        description: `Group "${groupName}" has been deleted. Schemes are now ungrouped.`,
      });
      router.push('/groups'); // Navigate back to groups list
    } else {
      toast({
        title: "Error Deleting Group",
        description: `Could not delete group "${groupName}".`,
        variant: "destructive",
      });
    }
    setIsDeletingGroupState(false); // Reset specific loading state
  };


  if (isLoading && !isDeletingGroupState) { // Ensure main loader doesn't show if only deleting group
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!groupName || (allSchemesInGroup.length === 0 && !isLoading && !isDeletingGroupState && !schemeSearchTerm)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-2xl font-semibold">Group Not Found or Empty</h2>
        <p className="text-muted-foreground max-w-md">
          The group "{groupName}" does not exist or has no schemes associated with it.
        </p>
        <Button onClick={() => router.push('/groups')} size="lg">
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to All Groups
        </Button>
      </div>
    );
  }

  const displayedSchemesCount = groupedSchemes.reduce((acc, group) => acc + group.schemes.length, 0);

  return (
  
    <><div className="flex flex-col gap-8">
      <motion.div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push('/groups')} className="h-10">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-headline font-bold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg">
            {groupName}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleEditGroupName} className="h-9 w-9" disabled={isDeletingGroupState}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit Group Name</span>
            </Button>
            <Button variant="outline" size="icon" onClick={handleDeleteGroup} className="h-9 w-9 text-destructive hover:bg-destructive/10" disabled={isDeletingGroupState}>
              {isDeletingGroupState ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="sr-only">Delete Group</span>
            </Button>
          </div>
        </div>
        <Button
          size="lg"
          asChild
          className="w-full sm:w-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow"
          disabled={groupSummaryStats.activeSchemesCount === 0}>
          <Link href={`/payments/record?group=${encodeURIComponent(groupName)}`}>
            <CreditCard className="mr-2.5 h-5 w-5" /> Record Payment for Group
          </Link>
        </Button>
      </motion.div>

      <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
        <Card className="rounded-xl shadow-xl glassmorphism">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-headline text-foreground">Group Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: Users, label: "Customers", value: groupSummaryStats.totalCustomers, color: "text-primary" },
              { icon: ListChecks, label: "Total Schemes", value: groupSummaryStats.totalSchemes, color: "text-primary" },
              { icon: CheckSquare, label: "Active Schemes", value: groupSummaryStats.activeSchemesCount, color: "text-green-600 dark:text-green-500" },
              { icon: DollarSign, label: "Total Paid", value: formatCurrency(groupSummaryStats.totalPaid), color: "text-green-600 dark:text-green-500" },
              { icon: DollarSign, label: "Pending", value: formatCurrency(groupSummaryStats.totalPending), color: "text-orange-600 dark:text-orange-500" },
              { icon: AlertTriangle, label: "Overdue Amount", value: formatCurrency(groupSummaryStats.totalOverdueAmount), color: "text-red-600 dark:text-red-500" },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card/50 dark:bg-card/30 shadow-md hover:shadow-lg transition-shadow"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + (1 * 0.1) + (idx * 0.05), duration: 0.3 }}
              >
                <stat.icon className={`h-7 w-7 mb-2 ${stat.color}`} />
                <span className={`font-bold text-2xl ${stat.color}`}>{stat.value}</span>
                <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
        <Card className="rounded-xl shadow-xl glassmorphism overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-xl font-headline text-foreground">All Schemes in {groupName} ({displayedSchemesCount})</CardTitle>
                <CardDescription>Detailed list of all schemes associated with this group.</CardDescription>
              </div>
              <Button onClick={handleExportPdf} disabled={isExporting || displayedSchemesCount === 0} variant="outline" size="sm">
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Export PDF
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="sm:col-span-1">
                <label htmlFor="schemeSearch" className="text-xs font-medium text-muted-foreground">Search Schemes</label>
                <Input
                  id="schemeSearch"
                  placeholder="Customer name or ID..."
                  value={schemeSearchTerm}
                  onChange={(e) => setSchemeSearchTerm(e.target.value)}
                  className="h-10 text-sm" />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="sortBy" className="text-xs font-medium text-muted-foreground">Sort Customers By</label>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                  <SelectTrigger id="sortBy" className="h-10 text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customerNameAsc">Customer Name (A-Z)</SelectItem>
                      <SelectItem value="customerNameDesc">Customer Name (Z-A)</SelectItem>
                      {/* Removed SelectItem for Oldest and Newest First */}
                      <SelectItem value="statusPriority">Scheme Status Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
          </CardHeader>
          <CardContent className="p-0">
            {groupedSchemes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {schemeSearchTerm ? 'No schemes match your search.' : 'No schemes found in this group.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 dark:bg-muted/20">
                      <TableHead className="text-base font-semibold sticky left-0 bg-muted/50 dark:bg-muted/20 z-20 min-w-[200px]">Customer / Scheme ID</TableHead>
                      <TableHead className="text-base font-semibold">Start Date</TableHead>
                      <TableHead className="text-base font-semibold text-right">Monthly Amt.</TableHead>
                      <TableHead className="text-base font-semibold text-right">Total Paid</TableHead>
                      <TableHead className="text-base font-semibold text-center min-w-[100px]">Payments</TableHead>
                      <TableHead className="text-base font-semibold min-w-[100px]">Status</TableHead>
                      <TableHead className="text-base font-semibold text-center min-w-[120px]">Transaction History</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedSchemes.map((customerGroup, groupIndex) => (
                      <React.Fragment key={customerGroup.customerName}>
                        <motion.tr
                          className="border-b border-border/50 transition-colors bg-muted/10 dark:bg-muted/5"
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 + (2 * 0.1) + (groupIndex * 0.05), duration: 0.3 }}
                        >
                          <TableCell className="font-semibold text-base sticky left-0 bg-card/80 dark:bg-card/80 z-10 py-3">
                            {customerGroup.customerName} (<span className="font-normal text-sm">
                              {customerGroup.totalSchemes} Scheme{customerGroup.totalSchemes > 1 ? 's' : ''}
                            </span>)
                          </TableCell>
                          <TableCell colSpan={6} className="text-base py-3"></TableCell>
                        </motion.tr>

                        {customerGroup.schemes.map((scheme, schemeIndex) => {
                          const schemeTotals = calculateSchemeTotals(scheme);
                          return (
                            <motion.tr
                              key={scheme.id}
                              className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.1 + (2 * 0.1) + (groupIndex * 0.05) + (schemeIndex * 0.03), duration: 0.3 }}
                            >
                              <TableCell className="sticky left-0 bg-card/80 dark:bg-card/80 z-10 pl-8 py-2.5">
                                <Link href={`/schemes/${scheme.id}`} className="hover:underline text-primary text-sm block">
                                  {scheme.id.toUpperCase()}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm py-2.5">{formatDate(scheme.startDate)}</TableCell>
                              <TableCell className="text-right text-sm py-2.5">{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                              <TableCell className="text-right text-sm py-2.5 text-green-600 dark:text-green-500">{formatCurrency(schemeTotals.totalCollected)}</TableCell>
                              <TableCell className="text-center text-sm py-2.5">{schemeTotals.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                              <TableCell className="py-2.5"><SchemeStatusBadge status={getSchemeStatus(scheme)} /></TableCell>
                              <TableCell className="text-center space-x-1 py-2.5">
                                <Button variant="ghost" size="icon" onClick={() => handleShowSchemePeek(scheme)} className="h-8 w-8">
                                  <History className="h-4 w-4 text-primary" />
                                  <span className="sr-only">View History for {scheme.id}</span>
                                </Button>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <SchemeHistoryPanel
        isOpen={isSchemePeekPanelOpen}
        onClose={() => setIsSchemePeekPanelOpen(false)}
        scheme={schemeForPeekPanel} />

      {schemeToDelete && (
        <AlertDialog open={!!schemeToDelete} onOpenChange={() => setSchemeToDelete(null)}>
          {/* ... existing scheme deletion dialog ... */}
        </AlertDialog>
      )}

      <ExportPdfDialog
        isOpen={isExportPdfDialogOpen}
        onOpenChange={setIsExportPdfDialogOpen}
        onExport={handleConfirmExportPdf}
        isExporting={isExporting}
      />

      <AlertDialog open={isConfirmingDeleteGroup} onOpenChange={setIsConfirmingDeleteGroup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Group Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the group "{groupName}"? All schemes within this group will be ungrouped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmingDeleteGroup(false)} disabled={isDeletingGroupState}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup} disabled={isDeletingGroupState} className="bg-destructive hover:bg-destructive/80">
              {isDeletingGroupState ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div><Dialog open={isEditingGroup} onOpenChange={setIsEditingGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group Name</DialogTitle>
            <DialogDescription>
              Enter a new name for the group "{groupName}". This will update the group name for all schemes within this group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="newGroupName" className="text-right">
                New Name
              </label>
              <Input
                id="newGroupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="col-span-3"
                disabled={isSavingGroupName} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingGroup(false)} disabled={isSavingGroupName}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroupName} disabled={isSavingGroupName || !newGroupName || newGroupName.trim() === '' || newGroupName.trim() === groupName}>
              {isSavingGroupName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>

  );
}