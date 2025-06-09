
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, AlertTriangle, DollarSign, PackageCheck, History, ListChecksIcon, Search, Plus, Minus, CheckCircle, Info } from 'lucide-react';
import Link from 'next/link';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { getMockSchemes, updateMockSchemePayment, recordNextDuePaymentsForCustomerGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, differenceInDays, formatISO } from 'date-fns';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { QuickIndividualBatchDialog, type QuickIndividualBatchSubmitDetails } from '@/components/dialogs/QuickIndividualBatchDialog';
import { BatchRecordPaymentDialog } from '@/components/dialogs/BatchRecordPaymentDialog';
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';
import { useToast } from '@/hooks/use-toast';

interface EnhancedRecordableSchemeInfo {
  scheme: Scheme;
  firstRecordablePayment: Payment;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [schemeForHistory, setSchemeForHistory] = useState<Scheme | null>(null);

  // State for "Record Payment" section
  const [activePaymentTab, setActivePaymentTab] = useState('individual');
  const [individualSearchTerm, setIndividualSearchTerm] = useState('');
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  
  const [monthsToPayForScheme, setMonthsToPayForScheme] = useState<{ [schemeId: string]: number }>({});
  
  const [selectedSchemeForQuickPay, setSelectedSchemeForQuickPay] = useState<EnhancedRecordableSchemeInfo | null>(null);
  const [numberOfMonthsForQuickPay, setNumberOfMonthsForQuickPay] = useState(1);
  const [isQuickPayDialogOpen, setIsQuickPayDialogOpen] = useState(false);

  const [selectedGroupForBatchPay, setSelectedGroupForBatchPay] = useState<GroupDetail | null>(null);
  const [isBatchPayDialogOpen, setIsBatchPayDialogOpen] = useState(false);

  const [processingStates, setProcessingStates] = useState<{ [key: string]: boolean }>({});


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

  // --- Start of "Record Payment" section logic ---
  const recordableIndividualSchemes = useMemo((): EnhancedRecordableSchemeInfo[] => {
    const searchTermLower = individualSearchTerm.toLowerCase().trim();
    if (!searchTermLower) return [];

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
  }, [schemes, individualSearchTerm]);

  const groupsForBatchPay = useMemo((): GroupDetail[] => {
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
        groupEntry.schemes.push(scheme); // Add full scheme object
        groupEntry.customerNames.add(scheme.customerName);
        if (hasRecordablePaymentForThisScheme) { groupEntry.recordableSchemeCount++; }
        groupsMap.set(scheme.customerGroupName, groupEntry);
      }
    });
    return Array.from(groupsMap.entries())
      .map(([groupName, data]) => ({ 
          groupName, 
          schemes: data.schemes, // These are full scheme objects
          customerNames: Array.from(data.customerNames).sort(),
          totalSchemesInGroup: data.schemes.length,
          recordableSchemeCount: data.recordableSchemeCount 
      }))
      .filter(g => g.recordableSchemeCount > 0 && (groupSearchTerm.trim() === '' || g.groupName.toLowerCase().includes(groupSearchTerm.toLowerCase())));
  }, [schemes, groupSearchTerm]);

  useEffect(() => {
    setMonthsToPayForScheme(prev => {
      const newMonthsToPay = { ...prev };
      recordableIndividualSchemes.forEach(({ scheme }) => {
        if (!(scheme.id in newMonthsToPay)) { newMonthsToPay[scheme.id] = 1; }
      });
      return newMonthsToPay;
    });
  }, [recordableIndividualSchemes]);

  const handleChangeMonthsToPay = (schemeId: string, schemeDuration: number, paymentsMade: number, delta: number) => {
    setMonthsToPayForScheme(prev => {
      const currentMonths = prev[schemeId] || 1;
      const maxMonths = schemeDuration - (paymentsMade || 0);
      let newMonths = currentMonths + delta;
      if (newMonths < 1) newMonths = 1;
      if (newMonths > maxMonths) newMonths = maxMonths;
      if (maxMonths <= 0) newMonths = 0; // If all paid, can't select more
      return { ...prev, [schemeId]: newMonths };
    });
  };

  const handleOpenQuickPayDialog = (schemeInfo: EnhancedRecordableSchemeInfo) => {
    const numMonths = monthsToPayForScheme[schemeInfo.scheme.id] || 1;
    if (numMonths <= 0) {
      toast({ title: "No Payments to Record", description: "All installments for this scheme are already paid or no months selected.", variant: "default" });
      return;
    }
    setSelectedSchemeForQuickPay(schemeInfo);
    setNumberOfMonthsForQuickPay(numMonths);
    setIsQuickPayDialogOpen(true);
  };

  const handleQuickPaySubmit = async (details: QuickIndividualBatchSubmitDetails) => {
    if (!selectedSchemeForQuickPay) return;
    const schemeId = selectedSchemeForQuickPay.scheme.id;
    setProcessingStates(prev => ({ ...prev, [schemeId]: true }));

    let successfulRecords = 0;
    let totalAmountRecorded = 0;
    let errors = 0;

    const firstPaymentIndex = selectedSchemeForQuickPay.scheme.payments.findIndex(p => p.id === selectedSchemeForQuickPay.firstRecordablePayment.id);

    for (let i = 0; i < numberOfMonthsForQuickPay; i++) {
      const paymentIndexToRecord = firstPaymentIndex + i;
      if (paymentIndexToRecord < selectedSchemeForQuickPay.scheme.payments.length) {
        const paymentToRecord = selectedSchemeForQuickPay.scheme.payments[paymentIndexToRecord];
        if (getPaymentStatus(paymentToRecord, selectedSchemeForQuickPay.scheme.startDate) !== 'Paid') {
          const updatedScheme = updateMockSchemePayment(schemeId, paymentToRecord.id, {
            paymentDate: details.paymentDate, // ISO String from dialog
            amountPaid: paymentToRecord.amountExpected,
            modeOfPayment: details.modeOfPayment,
          });
          if (updatedScheme) { successfulRecords++; totalAmountRecorded += paymentToRecord.amountExpected; } else { errors++; }
        }
      } else { errors++; break; }
    }

    if (successfulRecords > 0) {
      toast({
        title: "Payments Recorded",
        description: `${successfulRecords} payment(s) totaling ${formatCurrency(totalAmountRecorded)} for ${selectedSchemeForQuickPay.scheme.customerName} (Scheme: ${schemeId.toUpperCase()}) recorded. ${errors > 0 ? `${errors} error(s).` : ''}`
      });
      loadSchemesData(); 
      setMonthsToPayForScheme(prev => ({ ...prev, [schemeId]: 1 }));
    } else if (errors > 0) {
      toast({ title: "Error Recording Payments", description: `${errors} error(s) occurred. No payments were recorded.`, variant: "destructive" });
    } else {
      toast({ title: "No Payments Recorded", description: "No new payments were recorded for this scheme." });
    }
    setProcessingStates(prev => ({ ...prev, [schemeId]: false }));
    setIsQuickPayDialogOpen(false);
    setSelectedSchemeForQuickPay(null);
  };

  const handleOpenBatchPayDialog = (group: GroupDetail) => {
    setSelectedGroupForBatchPay(group);
    setIsBatchPayDialogOpen(true);
  };

  const handleBatchPaySubmit = (details: { paymentDate: string; modeOfPayment: PaymentMode[]; schemeIdsToRecord: string[] }) => {
    if (!selectedGroupForBatchPay) return;
    const groupName = selectedGroupForBatchPay.groupName;
    setProcessingStates(prev => ({ ...prev, [groupName]: true }));
    
    const result = recordNextDuePaymentsForCustomerGroup(groupName, details);
    
    toast({
      title: "Batch Payment Processed",
      description: `Recorded ${result.paymentsRecordedCount} payment(s) for group "${groupName}", totaling ${formatCurrency(result.totalRecordedAmount)}.`,
    });
    
    loadSchemesData();
    setProcessingStates(prev => ({ ...prev, [groupName]: false }));
    setIsBatchPayDialogOpen(false);
    setSelectedGroupForBatchPay(null);
  };

  // --- End of "Record Payment" section logic ---

  return (
    <>
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          {/* "Add Payment" button removed from here */}
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

      {/* Restored Record Payment Card */}
      <Card className="col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline">Record Payments</CardTitle>
          <CardDescription>Manage payments for individual schemes or in batches for groups.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activePaymentTab} onValueChange={setActivePaymentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="individual">Individual Scheme</TabsTrigger>
              <TabsTrigger value="batch">Batch (Group)</TabsTrigger>
            </TabsList>
            <TabsContent value="individual">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by customer name or scheme ID..." value={individualSearchTerm} onChange={(e) => setIndividualSearchTerm(e.target.value)} className="pl-9" />
              </div>
              {individualSearchTerm.trim() && recordableIndividualSchemes.length === 0 && <p className="text-muted-foreground text-center py-4">No matching recordable schemes found.</p>}
              {!individualSearchTerm.trim() && <p className="text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><Info size={16} /> Type to search for individual schemes to record payments.</p>}
              
              {recordableIndividualSchemes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto p-1">
                  {recordableIndividualSchemes.map((schemeInfo) => {
                    const { scheme } = schemeInfo;
                    const currentMonthsToPay = monthsToPayForScheme[scheme.id] || 1;
                    const paymentsMade = scheme.paymentsMadeCount || 0;
                    const maxMonthsToRecord = scheme.durationMonths - paymentsMade;
                    const liveTotalAmount = currentMonthsToPay * scheme.monthlyPaymentAmount;
                    const isProcessing = processingStates[scheme.id];

                    return (
                      <div key={scheme.id} className="p-3.5 border rounded-lg bg-card flex flex-col text-xs min-h-[250px]">
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-mono text-xs sm:text-sm tracking-wider text-foreground/90 font-medium block">{scheme.id.toUpperCase()}</span>
                        </div>
                        <Link href={`/schemes/${scheme.id}`} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
                          <p className="text-sm font-headline font-semibold text-primary hover:underline truncate" title={scheme.customerName}>{scheme.customerName}</p>
                        </Link>
                        
                        <div className="flex justify-between items-baseline mt-1 text-sm mb-1.5">
                            <p className="text-muted-foreground">Starts: <span className="font-semibold text-foreground">{formatDate(scheme.startDate, 'dd MMM yy')}</span></p>
                            <p className="font-semibold text-foreground">{formatCurrency(scheme.monthlyPaymentAmount)}</p>
                        </div>

                        <div className="my-1.5 mb-1">
                          <SegmentedProgressBar scheme={scheme} paidMonthsCount={paymentsMade} monthsToRecord={currentMonthsToPay} className="h-2" />
                           <p className="text-xs text-muted-foreground mt-1 text-center">{paymentsMade} / {scheme.durationMonths} paid</p>
                        </div>

                        {maxMonthsToRecord > 0 ? (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Record:</span>
                              <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleChangeMonthsToPay(scheme.id, scheme.durationMonths, paymentsMade, -1)} disabled={currentMonthsToPay <= 1 || isProcessing}><Minus className="h-3 w-3" /></Button>
                              <span className="w-5 text-center font-semibold text-xs tabular-nums">{currentMonthsToPay}</span>
                              <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleChangeMonthsToPay(scheme.id, scheme.durationMonths, paymentsMade, 1)} disabled={currentMonthsToPay >= maxMonthsToRecord || isProcessing}><Plus className="h-3 w-3" /></Button>
                              <span className="text-xs text-muted-foreground">month(s)</span>
                            </div>
                            <Button size="sm" className="w-full font-semibold text-xs py-1.5 h-auto" onClick={() => handleOpenQuickPayDialog(schemeInfo)} disabled={currentMonthsToPay === 0 || isProcessing}>
                              {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <ListChecksIcon className="mr-1.5 h-3.5 w-3.5" />}
                              Pay ({formatCurrency(liveTotalAmount)})
                            </Button>
                          </div>
                        ) : (
                           <div className="mt-3 text-center py-3">
                            <span className="text-xs font-medium text-green-600 dark:text-green-500 inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5"/>All Paid</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </TabsContent>
            <TabsContent value="batch">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by group name..." value={groupSearchTerm} onChange={(e) => setGroupSearchTerm(e.target.value)} className="pl-9" />
              </div>
              {groupSearchTerm.trim() && groupsForBatchPay.length === 0 && <p className="text-muted-foreground text-center py-4">No matching groups with recordable payments.</p>}
              {!groupSearchTerm.trim() && groupsForBatchPay.length === 0 && <p className="text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><Info size={16}/> No groups eligible for batch payment, or type to search.</p>}
              
              {groupsForBatchPay.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto p-1">
                  {groupsForBatchPay.map(group => {
                     const isProcessing = processingStates[group.groupName];
                    return (
                      <div key={group.groupName} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-lg bg-card hover:shadow-sm">
                        <div>
                          <Link href={`/groups/${encodeURIComponent(group.groupName)}`} target="_blank" rel="noopener noreferrer">
                            <h3 className="font-semibold text-primary hover:underline">{group.groupName}</h3>
                          </Link>
                          <p className="text-xs text-muted-foreground">{group.recordableSchemeCount} scheme(s) with next payment due.</p>
                        </div>
                        <Button size="sm" variant="outline" className="mt-2 sm:mt-0 text-xs py-1.5 h-auto" onClick={() => handleOpenBatchPayDialog(group)} disabled={isProcessing}>
                          {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <ListChecksIcon className="mr-1.5 h-3.5 w-3.5" />}
                          Record for Group
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


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

    {selectedSchemeForQuickPay && (
        <QuickIndividualBatchDialog
            isOpen={isQuickPayDialogOpen}
            onClose={() => { setIsQuickPayDialogOpen(false); setSelectedSchemeForQuickPay(null); }}
            onSubmit={handleQuickPaySubmit}
            isLoading={processingStates[selectedSchemeForQuickPay.scheme.id]}
            scheme={selectedSchemeForQuickPay.scheme}
            firstPaymentToRecord={selectedSchemeForQuickPay.firstRecordablePayment}
            numberOfMonthsToRecord={numberOfMonthsForQuickPay}
        />
    )}

    {selectedGroupForBatchPay && (
        <BatchRecordPaymentDialog
            groupDisplayName={selectedGroupForBatchPay.groupName}
            schemesInGroup={selectedGroupForBatchPay.schemes}
            isOpen={isBatchPayDialogOpen}
            onClose={() => { setIsBatchPayDialogOpen(false); setSelectedGroupForBatchPay(null); }}
            onSubmit={handleBatchPaySubmit}
            isLoading={processingStates[selectedGroupForBatchPay.groupName]}
        />
    )}
    </>
  );
}
