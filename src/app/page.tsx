
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, AlertTriangle, DollarSign, Loader2, Users2, PackageCheck, ListChecks, Minus, Plus, History, Search } from 'lucide-react';
import Link from 'next/link';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { getMockSchemes, recordNextDuePaymentsForCustomerGroup, updateMockSchemePayment } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { useToast } from '@/hooks/use-toast';
import { isPast, parseISO, differenceInDays } from 'date-fns';
import { BatchRecordPaymentDialog } from '@/components/dialogs/BatchRecordPaymentDialog';
import { QuickIndividualBatchDialog, type QuickIndividualBatchSubmitDetails } from '@/components/dialogs/QuickIndividualBatchDialog';
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { Input } from '@/components/ui/input';


interface GroupWithRecordablePayments {
  groupName: string;
  schemes: Scheme[];
  recordableSchemeCount: number;
}

interface EnhancedRecordableSchemeInfo {
  scheme: Scheme;
  firstRecordablePayment: Payment;
}

interface PaymentContextForDialog {
  scheme: Scheme;
  firstRecordablePayment: Payment;
  numberOfMonthsToRecord: number;
}

export default function DashboardPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const { toast } = useToast();
  const [isBatchRecordingGroup, setIsBatchRecordingGroup] = useState(false);
  const [selectedGroupForBatch, setSelectedGroupForBatch] = useState<GroupWithRecordablePayments | null>(null);

  const [monthsToPayForScheme, setMonthsToPayForScheme] = useState<{ [schemeId: string]: number }>({});
  const [paymentContextForDialog, setPaymentContextForDialog] = useState<PaymentContextForDialog | null>(null);
  const [isQuickIndividualBatchDialogOpen, setIsQuickIndividualBatchDialogOpen] = useState(false);
  const [isProcessingQuickIndividualBatch, setIsProcessingQuickIndividualBatch] = useState(false);

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [schemeForHistory, setSchemeForHistory] = useState<Scheme | null>(null);

  const [individualSchemeSearchTerm, setIndividualSchemeSearchTerm] = useState('');
  const [batchGroupSearchTerm, setBatchGroupSearchTerm] = useState('');
  const [activePaymentTab, setActivePaymentTab] = useState('individual');


  const loadSchemesData = useCallback(() => {
    const loadedSchemesInitial = getMockSchemes().map(s => {
      s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      const totals = calculateSchemeTotals(s);
      const status = getSchemeStatus(s);
      return { ...s, ...totals, status };
    });
    setSchemes(loadedSchemesInitial);

    setMonthsToPayForScheme(prev => {
      const newMonthsToPay = { ...prev };
      loadedSchemesInitial.forEach(scheme => {
        if (!(scheme.id in newMonthsToPay)) {
          newMonthsToPay[scheme.id] = 1;
        }
      });
      return newMonthsToPay;
    });

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
      totalPending: totalExpectedFromActive - totalCollected,
      totalOverdueAmount,
      completedSchemesCount: schemes.filter(s => s.status === 'Completed').length,
    };
  }, [schemes]);

  const chartData = useMemo(() => [
    { name: 'Collected', value: summaryStats.totalCollected, fill: 'var(--color-collected)' },
    { name: 'Pending', value: summaryStats.totalPending > 0 ? summaryStats.totalPending : 0, fill: 'var(--color-pending)' },
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

  const groupsWithRecordablePayments = useMemo(() => {
    const groupsMap = new Map<string, { schemes: Scheme[], recordableSchemeCount: number }>();

    schemes.forEach(scheme => {
      if (scheme.customerGroupName && (scheme.status === 'Active' || scheme.status === 'Overdue')) {
        let hasRecordablePaymentForThisScheme = false;
        for (let i = 0; i < scheme.payments.length; i++) {
          const payment = scheme.payments[i];
          if (getPaymentStatus(payment, scheme.startDate) !== 'Paid') {
            let allPreviousPaid = true;
            for (let j = 0; j < i; j++) {
              if (getPaymentStatus(scheme.payments[j], scheme.startDate) !== 'Paid') {
                allPreviousPaid = false;
                break;
              }
            }
            if (allPreviousPaid) {
              hasRecordablePaymentForThisScheme = true;
              break;
            }
          }
        }

        const groupEntry = groupsMap.get(scheme.customerGroupName) || { schemes: [], recordableSchemeCount: 0 };
        groupEntry.schemes.push(scheme);

        if (hasRecordablePaymentForThisScheme) {
          groupEntry.recordableSchemeCount += 1;
        }
        groupsMap.set(scheme.customerGroupName, groupEntry);
      }
    });

    return Array.from(groupsMap.entries())
      .map(([groupName, data]) => ({
        groupName,
        ...data,
      }))
      .filter(g => g.recordableSchemeCount > 0)
      .filter(g => batchGroupSearchTerm.trim() === '' || g.groupName.toLowerCase().includes(batchGroupSearchTerm.toLowerCase()));
  }, [schemes, batchGroupSearchTerm]);


  const recordableIndividualSchemes = useMemo((): EnhancedRecordableSchemeInfo[] => {
    if (!individualSchemeSearchTerm.trim()) {
      return [];
    }

    const searchTermLower = individualSchemeSearchTerm.toLowerCase();

    const result: EnhancedRecordableSchemeInfo[] = [];
    schemes
      .filter(s =>
        s.customerName.toLowerCase().includes(searchTermLower) ||
        s.id.toLowerCase().includes(searchTermLower)
      )
      .forEach(s => {
        if (s.status === 'Active' || s.status === 'Overdue') {
          let firstUnpaidRecordableIndex = -1;
          for (let i = 0; i < s.payments.length; i++) {
            if (getPaymentStatus(s.payments[i], s.startDate) !== 'Paid') {
              let allPreviousPaid = true;
              for (let j = 0; j < i; j++) {
                if (getPaymentStatus(s.payments[j], s.startDate) !== 'Paid') {
                  allPreviousPaid = false;
                  break;
                }
              }
              if (allPreviousPaid) {
                firstUnpaidRecordableIndex = i;
                break;
              }
            }
          }
          if (firstUnpaidRecordableIndex !== -1) {
            result.push({
              scheme: s,
              firstRecordablePayment: s.payments[firstUnpaidRecordableIndex],
            });
          }
        }
    });
    return result.sort((a, b) => parseISO(a.firstRecordablePayment.dueDate).getTime() - parseISO(b.firstRecordablePayment.dueDate).getTime());
  }, [schemes, individualSchemeSearchTerm]);

  const handleGroupBatchRecordSubmit = (details: { paymentDate: string; modeOfPayment: PaymentMode[]; schemeIdsToRecord: string[] }) => {
    if (!selectedGroupForBatch) return;
    setIsBatchRecordingGroup(true);
    const result = recordNextDuePaymentsForCustomerGroup(selectedGroupForBatch.groupName, details);

    toast({
      title: "Batch Payment Processed",
      description: `Recorded ${result.paymentsRecordedCount} payment(s) for group "${selectedGroupForBatch.groupName}", totaling ${formatCurrency(result.totalRecordedAmount)}. Affected customers: ${[...new Set(result.recordedPaymentsInfo.map(p => p.customerName))].join(', ')}.`,
    });

    setSelectedGroupForBatch(null);
    setIsBatchRecordingGroup(false);
    loadSchemesData();
  };

  const handleChangeMonthsToPay = (schemeId: string, schemeDuration: number, paymentsMade: number, delta: number) => {
    setMonthsToPayForScheme(prev => {
      const currentMonths = prev[schemeId] || 1;
      const maxMonths = schemeDuration - (paymentsMade || 0);
      let newMonths = currentMonths + delta;
      if (newMonths < 1) newMonths = 1;
      if (newMonths > maxMonths) newMonths = maxMonths;
      if (maxMonths <= 0) newMonths = 0;
      return { ...prev, [schemeId]: newMonths };
    });
  };

  const handleOpenQuickIndividualBatchDialog = (schemeInfo: EnhancedRecordableSchemeInfo) => {
    const numberOfMonths = monthsToPayForScheme[schemeInfo.scheme.id] || 1;
    setPaymentContextForDialog({
      scheme: schemeInfo.scheme,
      firstRecordablePayment: schemeInfo.firstRecordablePayment,
      numberOfMonthsToRecord: numberOfMonths,
    });
    setIsQuickIndividualBatchDialogOpen(true);
  };

  const handleQuickIndividualBatchSubmit = (details: QuickIndividualBatchSubmitDetails) => {
    if (!paymentContextForDialog) return;
    setIsProcessingQuickIndividualBatch(true);

    const { scheme, firstRecordablePayment, numberOfMonthsToRecord } = paymentContextForDialog;
    let successfulRecords = 0;
    let totalAmountRecorded = 0;
    let errors = 0;

    const firstPaymentIndex = scheme.payments.findIndex(p => p.id === firstRecordablePayment.id);

    if (firstPaymentIndex === -1) {
      toast({ title: "Error", description: "Could not find the starting payment to record.", variant: "destructive" });
      setIsProcessingQuickIndividualBatch(false);
      setIsQuickIndividualBatchDialogOpen(false);
      setPaymentContextForDialog(null);
      return;
    }

    for (let i = 0; i < numberOfMonthsToRecord; i++) {
      const paymentIndexToRecord = firstPaymentIndex + i;
      if (paymentIndexToRecord < scheme.payments.length) {
        const paymentToRecord = scheme.payments[paymentIndexToRecord];
        if (getPaymentStatus(paymentToRecord, scheme.startDate) !== 'Paid') {
          const updatedScheme = updateMockSchemePayment(scheme.id, paymentToRecord.id, {
            paymentDate: details.paymentDate,
            amountPaid: paymentToRecord.amountExpected,
            modeOfPayment: details.modeOfPayment,
          });
          if (updatedScheme) {
            successfulRecords++;
            totalAmountRecorded += paymentToRecord.amountExpected;
          } else {
            errors++;
          }
        }
      } else {
        errors++;
        break;
      }
    }

    if (successfulRecords > 0) {
      toast({
        title: "Payments Recorded",
        description: `${successfulRecords} payment(s) totaling ${formatCurrency(totalAmountRecorded)} for ${scheme.customerName} (Scheme: ${scheme.id.toUpperCase()}) recorded. ${errors > 0 ? `${errors} error(s) occurred.` : ''}`
      });
    } else if (errors > 0) {
      toast({ title: "Error Recording Payments", description: `${errors} error(s) occurred. No payments were recorded.`, variant: "destructive" });
    } else {
       toast({ title: "No Payments Recorded", description: "No new payments were recorded for this scheme.", variant: "default" });
    }

    setIsProcessingQuickIndividualBatch(false);
    setIsQuickIndividualBatchDialogOpen(false);
    setPaymentContextForDialog(null);
    loadSchemesData();
    setMonthsToPayForScheme(prev => ({ ...prev, [scheme.id]: 1 }));
  };

  const handleOpenHistoryPanel = (scheme: Scheme) => {
    setSchemeForHistory(scheme);
    setIsHistoryPanelOpen(true);
  };


  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Dashboard</h1>
        <Link href="/schemes/new">
          <Button size="lg">
            <Users className="mr-2 h-5 w-5" /> Add New Scheme
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schemes</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryStats.totalSchemes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summaryStats.totalCollected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending (Active)</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summaryStats.totalPending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{formatCurrency(summaryStats.totalOverdueAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Schemes</CardTitle>
            <PackageCheck className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryStats.completedSchemesCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            Record Payment
          </CardTitle>
          <CardDescription>Record payments for individual schemes or by customer group.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activePaymentTab} onValueChange={setActivePaymentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="batch">Batch (Group)</TabsTrigger>
            </TabsList>
            <TabsContent value="individual" className="mt-6">
              <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  placeholder="Search by customer name or scheme ID..."
                  value={individualSchemeSearchTerm}
                  onChange={(e) => setIndividualSchemeSearchTerm(e.target.value)}
                  className="pl-10"
                  />
              </div>

              {individualSchemeSearchTerm.trim() && recordableIndividualSchemes.length === 0 && (
                   <p className="text-muted-foreground py-4 text-center">No matching recordable schemes found for "{individualSchemeSearchTerm}".</p>
              )}

              {!individualSchemeSearchTerm.trim() && (
                   <p className="text-muted-foreground py-4 text-center">Enter a customer name or scheme ID above to find schemes for payment recording.</p>
              )}

              {recordableIndividualSchemes.length > 0 && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {recordableIndividualSchemes.map((schemeInfo) => {
                    const { scheme } = schemeInfo;
                    const currentMonthsToPay = monthsToPayForScheme[scheme.id] || 1;
                    const paymentsMade = scheme.paymentsMadeCount || 0;
                    const maxMonthsToRecord = scheme.durationMonths - paymentsMade;
                    const liveTotalAmount = currentMonthsToPay * scheme.monthlyPaymentAmount;

                    return (
                      <div key={scheme.id} className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card space-y-3">
                        <div className="flex justify-between items-start">
                          <Link href={`/schemes/${scheme.id}`} className="font-semibold text-accent hover:underline text-lg">
                            {scheme.customerName}
                          </Link>
                          <div className="flex items-center gap-2 text-right">
                              <span className="font-semibold text-accent text-lg">
                              {scheme.id.toUpperCase()}
                              </span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenHistoryPanel(scheme)}>
                                  <History className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  <span className="sr-only">View Transaction History</span>
                              </Button>
                          </div>
                        </div>
                        
                        <div className="text-sm">
                            <strong>Started:</strong> {formatDate(scheme.startDate, 'dd MMM yyyy')}
                        </div>

                        <div className="flex items-center gap-3">
                          <SegmentedProgressBar
                              scheme={scheme}
                              paidMonthsCount={paymentsMade}
                              monthsToRecord={currentMonthsToPay}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{paymentsMade} / {scheme.durationMonths} months</span>
                        </div>

                        <div className="text-sm text-muted-foreground">
                           Monthly Payment: {formatCurrency(scheme.monthlyPaymentAmount)}
                        </div>

                        {maxMonthsToRecord > 0 ? (
                          <>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">Record:</span>
                                <Button
                                  variant="outline" size="icon" className="h-7 w-7"
                                  onClick={() => handleChangeMonthsToPay(scheme.id, scheme.durationMonths, paymentsMade, -1)}
                                  disabled={currentMonthsToPay <= 1 || isProcessingQuickIndividualBatch || isBatchRecordingGroup}
                                > <Minus className="h-3 w-3" /> </Button>
                                <span className="w-5 text-center font-medium text-sm">{currentMonthsToPay}</span>
                                <Button
                                  variant="outline" size="icon" className="h-7 w-7"
                                  onClick={() => handleChangeMonthsToPay(scheme.id, scheme.durationMonths, paymentsMade, 1)}
                                  disabled={currentMonthsToPay >= maxMonthsToRecord || isProcessingQuickIndividualBatch || isBatchRecordingGroup}
                                > <Plus className="h-3 w-3" /> </Button>
                                <span className="text-sm">month(s)</span>
                              </div>
                              <div className="text-sm font-semibold text-primary">
                                Total: {formatCurrency(liveTotalAmount)}
                              </div>
                            </div>

                            <div className="flex justify-center pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleOpenQuickIndividualBatchDialog(schemeInfo)}
                                disabled={maxMonthsToRecord === 0 || currentMonthsToPay === 0 || isProcessingQuickIndividualBatch || isBatchRecordingGroup }
                                className="w-full sm:w-auto"
                              >
                                {isProcessingQuickIndividualBatch && paymentContextForDialog?.scheme.id === scheme.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ListChecks className="mr-2 h-4 w-4" />}
                                Record {currentMonthsToPay > 0 ? `${currentMonthsToPay} ` : ""}Payment(s)
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-green-600 font-medium text-center py-2">All payments recorded for this scheme.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="batch" className="mt-6">
              <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by group name..."
                    value={batchGroupSearchTerm}
                    onChange={(e) => setBatchGroupSearchTerm(e.target.value)}
                    className="pl-10"
                  />
              </div>

              {batchGroupSearchTerm.trim() && groupsWithRecordablePayments.length === 0 && (
                 <p className="text-muted-foreground py-4 text-center">No matching groups found for "{batchGroupSearchTerm}" with recordable payments.</p>
              )}
              {!batchGroupSearchTerm.trim() && schemes.length > 0 && groupsWithRecordablePayments.length === 0 && (
                 <p className="text-muted-foreground py-4 text-center">No customer groups currently eligible for batch payment recording.</p>
              )}
              {!batchGroupSearchTerm.trim() && schemes.length === 0 && (
                 <p className="text-muted-foreground py-4 text-center">No schemes or groups available. Add schemes to enable batch recording.</p>
              )}


              {groupsWithRecordablePayments.length > 0 && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {groupsWithRecordablePayments.map(group => (
                    <div key={group.groupName} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-lg hover:shadow-md transition-shadow bg-card">
                      <div>
                        <p className="text-lg font-semibold text-primary">
                          <Link href={`/groups/${encodeURIComponent(group.groupName)}`} className="hover:underline">
                            {group.groupName}
                          </Link>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {group.recordableSchemeCount} scheme(s) with next payment due.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedGroupForBatch(group)}
                        disabled={isBatchRecordingGroup || isProcessingQuickIndividualBatch}
                        className="mt-2 sm:mt-0"
                      >
                        <ListChecks className="mr-2 h-4 w-4" /> Record Batch
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


      {selectedGroupForBatch && (
        <BatchRecordPaymentDialog
          groupDisplayName={selectedGroupForBatch.groupName}
          schemesInGroup={selectedGroupForBatch.schemes}
          isOpen={!!selectedGroupForBatch}
          onClose={() => setSelectedGroupForBatch(null)}
          onSubmit={handleGroupBatchRecordSubmit}
          isLoading={isBatchRecordingGroup}
        />
      )}

      {isQuickIndividualBatchDialogOpen && paymentContextForDialog && (
        <QuickIndividualBatchDialog
          isOpen={isQuickIndividualBatchDialogOpen}
          onClose={() => {
            setIsQuickIndividualBatchDialogOpen(false);
            setPaymentContextForDialog(null);
          }}
          onSubmit={handleQuickIndividualBatchSubmit}
          isLoading={isProcessingQuickIndividualBatch}
          scheme={paymentContextForDialog.scheme}
          firstPaymentToRecord={paymentContextForDialog.firstRecordablePayment}
          numberOfMonthsToRecord={paymentContextForDialog.numberOfMonthsToRecord}
        />
      )}

      <SchemeHistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        scheme={schemeForHistory}
      />


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
                    <ChartTooltip
                      content={<ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex flex-col">
                            <span className="capitalize">{name}</span>
                            <span>{formatCurrency(Number(value))}</span>
                          </div>
                        )}
                      />}
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="value" radius={6} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No data to display for payment progress.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Upcoming Payments (Next 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPaymentsList.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingPaymentsList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        <Link href={`/schemes/${payment.schemeId}`} className="hover:underline">{payment.customerName}</Link>
                      </TableCell>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.amountExpected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">No upcoming payments in the next 30 days.</p>
            )}
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
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overduePaymentsList.map((payment) => (
                  <TableRow key={payment.id} className="text-destructive hover:bg-destructive/10">
                    <TableCell className="font-medium">
                      <Link href={`/schemes/${payment.schemeId}`} className="hover:underline">{payment.customerName}</Link>
                    </TableCell>
                    <TableCell>{formatDate(payment.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amountExpected)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No overdue payments. Great job!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

