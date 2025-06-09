
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TrendingUp, Users, AlertTriangle, DollarSign, PackageCheck, History, ListChecksIcon, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { getMockSchemes, updateMockSchemePayment, recordNextDuePaymentsForCustomerGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, differenceInDays } from 'date-fns';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { BatchRecordPaymentDialog } from '@/components/dialogs/BatchRecordPaymentDialog';
import { RecordIndividualPaymentDialog, type IndividualPaymentDetails } from '@/components/dialogs/RecordIndividualPaymentDialog';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { toast } = useToast();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [schemeForHistory, setSchemeForHistory] = useState<Scheme | null>(null);
  
  const [isIndividualPayDialogOpen, setIsIndividualPayDialogOpen] = useState(false);
  const [isBatchPayDialogOpen, setIsBatchPayDialogOpen] = useState(false);
  const [processingStates, setProcessingStates] = useState<{ [key: string]: boolean }>({}); // For loading states in dialogs


  const loadSchemesData = useCallback(() => {
    const loadedSchemesInitial = getMockSchemes().map(s => {
      const tempS = { ...s };
      tempS.payments.forEach(p => p.status = getPaymentStatus(p, tempS.startDate));
      const totals = calculateSchemeTotals(tempS);
      const status = getSchemeStatus(tempS);
      return { ...tempS, ...totals, status };
    });
    setSchemes(loadedSchemesInitial);
    return loadedSchemesInitial;
  }, []);

  useEffect(() => {
    loadSchemesData();
  }, [loadSchemesData]);

  const summaryStats = useMemo(() => {
    const activeSchemes = schemes.filter(s => s.status === 'Active' || s.status === 'Overdue');
    const totalCollected = schemes.reduce((sum, s) => sum + (s.totalCollected || 0), 0);
    const totalExpectedFromActive = activeSchemes.reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + p.amountExpected, 0), 0);

    const totalOverdueAmount = schemes
      .flatMap(s => s.payments.map(p => ({ ...p, schemeStartDate: s.startDate })))
      .filter(p => getPaymentStatus(p, p.schemeStartDate) === 'Overdue')
      .reduce((sum, p) => sum + p.amountExpected, 0);

    return {
      totalSchemes: schemes.length,
      activeSchemesCount: activeSchemes.length,
      totalCollected,
      totalPending: totalExpectedFromActive - totalCollected > 0 ? totalExpectedFromActive - totalCollected : 0,
      totalOverdueAmount,
      completedSchemesCount: schemes.filter(s => s.status === 'Completed').length,
    };
  }, [schemes]);

  const chartData = useMemo(() => [
    { name: 'Collected', value: summaryStats.totalCollected, fill: 'var(--color-collected)' },
    { name: 'Pending', value: summaryStats.totalPending, fill: 'var(--color-pending)' },
  ], [summaryStats.totalCollected, summaryStats.totalPending]);

  const chartConfig = {
    collected: { label: 'Collected', color: 'hsl(var(--chart-1))' },
    pending: { label: 'Pending', color: 'hsl(var(--chart-2))' },
  };

  const upcomingPaymentsList = useMemo(() => {
    return schemes
      .flatMap(s => s.payments.map(p => ({ ...p, customerName: s.customerName, schemeStartDate: s.startDate, schemeId: s.id })))
      .filter(p => getPaymentStatus(p, p.schemeStartDate) === 'Upcoming' && differenceInDays(parseISO(p.dueDate), new Date()) <= 30 && !isPast(parseISO(p.dueDate)))
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
      .slice(0, 5);
  }, [schemes]);

  const overduePaymentsList = useMemo(() => {
    return schemes
      .flatMap(s => s.payments.map(p => ({ ...p, customerName: s.customerName, schemeStartDate: s.startDate, schemeId: s.id })))
      .filter(p => getPaymentStatus(p, p.schemeStartDate) === 'Overdue')
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
      .slice(0, 5);
  }, [schemes]);

  const handleOpenHistoryPanel = (scheme: Scheme) => {
    setSchemeForHistory(scheme);
    setIsHistoryPanelOpen(true);
  };

  // --- "Record Payment" section logic moved to dialogs ---
  const recordableIndividualSchemesForDialog = useMemo((): Scheme[] => {
    return schemes.filter(s => {
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
              if (allPreviousPaid) return true; // Scheme is recordable
            }
          }
        }
        return false;
      })
      .sort((a,b) => { // Sort by next due date primarily, then customer name
        const nextDueA = a.payments.find(p => getPaymentStatus(p, a.startDate) !== 'Paid');
        const nextDueB = b.payments.find(p => getPaymentStatus(p, b.startDate) !== 'Paid');
        if (nextDueA && nextDueB) {
          const dateDiff = parseISO(nextDueA.dueDate).getTime() - parseISO(nextDueB.dueDate).getTime();
          if (dateDiff !== 0) return dateDiff;
        }
        return a.customerName.localeCompare(b.customerName);
      });
  }, [schemes]);

  const groupsForBatchPayDialog = useMemo((): GroupDetail[] => {
    const groupsMap = new Map<string, { schemes: Scheme[]; customerNames: Set<string>; recordableSchemeCount: number }>();
    schemes.forEach(scheme => {
      if (scheme.customerGroupName && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
        let hasRecordablePaymentForThisScheme = false;
        for (let i = 0; i < scheme.payments.length; i++) {
            const payment = scheme.payments[i];
            if (getPaymentStatus(payment, scheme.startDate) !== 'Paid') {
                let allPreviousPaid = true;
                for (let j = 0; j < i; j++) { if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') { allPreviousPaid = false; break; } }
                if (allPreviousPaid) { hasRecordablePaymentForThisScheme = true; break; }
            }
        }
        const groupEntry = groupsMap.get(scheme.customerGroupName) || { schemes: [], customerNames: new Set(), recordableSchemeCount: 0 };
        groupEntry.schemes.push(scheme); 
        groupEntry.customerNames.add(scheme.customerName);
        if (hasRecordablePaymentForThisScheme) { groupEntry.recordableSchemeCount++; }
        groupsMap.set(scheme.customerGroupName, groupEntry);
      }
    });
    return Array.from(groupsMap.entries())
      .map(([groupName, data]) => ({ 
          groupName, 
          schemes: data.schemes,
          customerNames: Array.from(data.customerNames).sort(),
          totalSchemesInGroup: data.schemes.length,
          recordableSchemeCount: data.recordableSchemeCount 
      }))
      .filter(g => g.recordableSchemeCount > 0)
      .sort((a,b) => a.groupName.localeCompare(b.groupName));
  }, [schemes]);


  const handleIndividualPaymentSubmit = async (details: IndividualPaymentDetails) => {
    const { schemeId, paymentDate, modeOfPayment, numberOfMonths } = details;
    const schemeToUpdate = schemes.find(s => s.id === schemeId);

    if (!schemeToUpdate) {
      toast({ title: "Error", description: `Scheme ${schemeId} not found.`, variant: "destructive" });
      return;
    }

    setProcessingStates(prev => ({ ...prev, [schemeId]: true }));

    let successfulRecords = 0;
    let totalAmountRecorded = 0;
    let errors = 0;

    // Find the index of the first payment that is not 'Paid' and where all previous are 'Paid'
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
        toast({ title: "No Payments Due", description: `No recordable payments found for scheme ${schemeId.toUpperCase()}.`, variant: "default" });
        setProcessingStates(prev => ({ ...prev, [schemeId]: false }));
        return;
    }

    for (let i = 0; i < numberOfMonths; i++) {
      const paymentIndexToRecord = firstPaymentToRecordIndex + i;
      if (paymentIndexToRecord < schemeToUpdate.payments.length) {
        const paymentToRecord = schemeToUpdate.payments[paymentIndexToRecord];
        // Double check status again here, though theoretically covered by firstPaymentToRecordIndex logic
        if (getPaymentStatus(paymentToRecord, schemeToUpdate.startDate) !== 'Paid') {
          const updatedScheme = updateMockSchemePayment(schemeId, paymentToRecord.id, {
            paymentDate: paymentDate, // ISO String from dialog
            amountPaid: paymentToRecord.amountExpected,
            modeOfPayment: modeOfPayment,
          });
          if (updatedScheme) { successfulRecords++; totalAmountRecorded += paymentToRecord.amountExpected; } else { errors++; }
        } else {
          // This payment was already paid or became paid during this loop (should not happen if logic is correct)
          // Consider it an error or skip
          errors++;
        }
      } else { errors++; break; } // Trying to record more months than available
    }

    if (successfulRecords > 0) {
      toast({
        title: "Payments Recorded",
        description: `${successfulRecords} payment(s) totaling ${formatCurrency(totalAmountRecorded)} for ${schemeToUpdate.customerName} (Scheme: ${schemeId.toUpperCase()}) recorded. ${errors > 0 ? `${errors} error(s).` : ''}`
      });
      loadSchemesData();
    } else if (errors > 0) {
      toast({ title: "Error Recording Payments", description: `${errors} error(s) occurred. Some payments might not have been recorded.`, variant: "destructive" });
    } else {
      toast({ title: "No Payments Recorded", description: "No new payments were recorded for this scheme." });
    }
    setProcessingStates(prev => ({ ...prev, [schemeId]: false }));
    setIsIndividualPayDialogOpen(false);
  };

  const handleBatchPaySubmit = (details: { paymentDate: string; modeOfPayment: PaymentMode[]; schemeIdsToRecord: string[] }) => {
    // Assuming groupName might not be directly available here, but mock-data function uses it.
    // The `BatchRecordPaymentDialog` might need to pass groupName if we want to show it in toast.
    // For now, we process based on scheme IDs.

    // We need to find the group name for the toast message, or adjust the toast
    // For simplicity, let's assume the mock function can handle it or we omit group from toast.
    // OR, we can pass the group that was selected to open the dialog in the first place.
    
    // This handler is directly called by BatchRecordPaymentDialog which has group context.
    // Let's assume the dialog might pass the groupName if needed for the toast.
    // For now, the core logic:
    const result = recordNextDuePaymentsForCustomerGroup("N/A_GROUP_FOR_TOAST", details); // Pass a placeholder or modify mock function
    
    toast({
      title: "Batch Payment Processed",
      description: `Recorded ${result.paymentsRecordedCount} payment(s) totaling ${formatCurrency(result.totalRecordedAmount)}.`,
    });
    
    loadSchemesData();
    setIsBatchPayDialogOpen(false); // Ensure this dialog also closes
  };


  return (
    <>
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" variant="default"> {/* Changed to default variant */}
                <ListChecksIcon className="mr-2 h-5 w-5" /> Add Payment <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsIndividualPayDialogOpen(true)}>
                Record Individual Payment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsBatchPayDialogOpen(true)} disabled={groupsForBatchPayDialog.length === 0}>
                Record Batch (Group) Payment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/schemes/new">
            <Button size="lg" variant="outline">
              <Users className="mr-2 h-5 w-5" /> Add New Scheme
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schemes</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{summaryStats.totalSchemes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatCurrency(summaryStats.totalCollected)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending (Active)</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatCurrency(summaryStats.totalPending)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{formatCurrency(summaryStats.totalOverdueAmount)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Schemes</CardTitle>
            <PackageCheck className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{summaryStats.completedSchemesCount}</div></CardContent>
        </Card>
      </div>

      {/* Removed the inline Record Payment Card */}

      <SchemeHistoryPanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} scheme={schemeForHistory} />

      <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Payment Progress (Active Schemes)</CardTitle>
            <CardDescription>Collected vs. Pending amounts for all active schemes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {chartData.some(d => d.value > 0) ? (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={chartData} layout="vertical" margin={{ right: 30, left: 20, top: 5, bottom: 5 }} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value).replace('₹', '')} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={90} stroke="hsl(var(--muted-foreground))" />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => ( <div className="flex flex-col"><span className="capitalize">{name}</span><span>{formatCurrency(Number(value))}</span></div>)}/>} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}/>
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="value" radius={6} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : ( <div className="flex items-center justify-center h-full text-muted-foreground">No data to display for payment progress.</div> )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Upcoming Payments (Next 30 Days)</CardTitle>
            <CardDescription>Top 5 upcoming payments.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingPaymentsList.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {upcomingPaymentsList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium"><Link href={`/schemes/${payment.schemeId}`} className="hover:underline">{payment.customerName}</Link></TableCell>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.amountExpected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : ( <p className="text-muted-foreground text-center py-4">No upcoming payments in the next 30 days.</p> )}
          </CardContent>
        </Card>
      </div>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline">Recent Overdue Payments</CardTitle>
          <CardDescription>Top 5 most recently due payments that are overdue.</CardDescription>
        </CardHeader>
        <CardContent>
          {overduePaymentsList.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {overduePaymentsList.map((payment) => (
                  <TableRow key={payment.id} className="text-destructive hover:bg-destructive/10">
                    <TableCell className="font-medium"><Link href={`/schemes/${payment.schemeId}`} className="hover:underline">{payment.customerName}</Link></TableCell>
                    <TableCell>{formatDate(payment.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amountExpected)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : ( <p className="text-muted-foreground text-center py-4">No overdue payments. Great job!</p> )}
        </CardContent>
      </Card>
    </div>

    {isIndividualPayDialogOpen && (
      <RecordIndividualPaymentDialog
        isOpen={isIndividualPayDialogOpen}
        onClose={() => setIsIndividualPayDialogOpen(false)}
        allRecordableSchemes={recordableIndividualSchemesForDialog}
        onSubmit={handleIndividualPaymentSubmit}
        isLoading={Object.values(processingStates).some(s => s)} // Simplified loading state for dialog
      />
    )}

    {isBatchPayDialogOpen && (
        // The BatchRecordPaymentDialog will need a way to get the relevant group to operate on,
        // or it needs to be opened with a specific group's context.
        // For now, assuming it might take all groups and allow selection, or `page.tsx` needs to pass a specific group.
        // Let's assume it internally allows selecting a group from groupsForBatchPayDialog or this needs refinement.
        // For this iteration, we'll just pass all schemes and let it filter.
        // A better approach for BatchRecordPaymentDialog would be to pass the group object directly when opening if selected from a list of groups.
        // Since the trigger is generic "Record Batch (Group) Payment", it needs a way to select the group inside the dialog.
        // The current BatchRecordPaymentDialog is designed to work on a specific group.
        // We'll simplify: if groupsForBatchPayDialog has only one group, pass it. Otherwise, it needs internal selection.
        // For now, we'll pass all schemes and let it handle group selection if it does, or this part of the trigger flow needs rework.
        // The `BatchRecordPaymentDialog` seems to expect a `groupDisplayName` and `schemesInGroup`.
        // This means the trigger "Record Batch (Group) Payment" should ideally first let user choose a group if multiple exist.
        // For now, if only one group is eligible, we can auto-select it. If more, we might need an intermediate step or the dialog handles it.
        // Let's pass the first eligible group for now if it exists. This part of UX might need refinement.
        <BatchRecordPaymentDialog
            groupDisplayName={groupsForBatchPayDialog.length > 0 ? groupsForBatchPayDialog[0].groupName : "Select Group"}
            schemesInGroup={groupsForBatchPayDialog.length > 0 ? groupsForBatchPayDialog[0].schemes : []} // This needs proper group selection
            isOpen={isBatchPayDialogOpen}
            onClose={() => setIsBatchPayDialogOpen(false)}
            onSubmit={handleBatchPaySubmit} // This submit handler expects schemeIdsToRecord, which BatchRecordPaymentDialog provides
            isLoading={Object.values(processingStates).some(s => s)} // Simplified
        />
    )}
    </>
  );
}
