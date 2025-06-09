
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Users, AlertTriangle, DollarSign, CalendarCheck, Edit, Loader2, Users2 } from 'lucide-react'; 
import Link from 'next/link';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemes, recordNextDuePaymentsForCustomerGroup } from '@/lib/mock-data'; 
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { useToast } from '@/hooks/use-toast';
import { isPast, parseISO, differenceInDays, formatISO } from 'date-fns';
import { BatchRecordPaymentDialog } from '@/components/dialogs/BatchRecordPaymentDialog';

interface GroupWithRecordablePayments {
  groupName: string;
  schemes: Scheme[]; 
  recordableSchemeCount: number; 
}

export default function DashboardPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const { toast } = useToast();
  const [isBatchRecording, setIsBatchRecording] = useState(false);
  const [selectedGroupForBatch, setSelectedGroupForBatch] = useState<GroupWithRecordablePayments | null>(null);


  const loadSchemesData = useCallback(() => {
    const loadedSchemesInitial = getMockSchemes().map(s => {
      s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      const totals = calculateSchemeTotals(s);
      const status = getSchemeStatus(s); 
      return { ...s, ...totals, status };
    });
    setSchemes(loadedSchemesInitial);
    return loadedSchemesInitial;
  }, []);


  useEffect(() => {
    const loadedSchemesInitial = loadSchemesData();

    const allPaymentsWithContext = loadedSchemesInitial.flatMap(scheme =>
      scheme.payments.map(payment => ({
        ...payment,
        schemeStartDate: scheme.startDate,
        customerName: scheme.customerName, 
      }))
    );

    const upcomingDueSoon = allPaymentsWithContext
      .filter(p => 
        getPaymentStatus(p, p.schemeStartDate) === 'Upcoming' && 
        differenceInDays(parseISO(p.dueDate), new Date()) <= 7 && 
        differenceInDays(parseISO(p.dueDate), new Date()) >= 0
      )
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
    
    if (upcomingDueSoon.length > 0) {
      // Toast notifications can be intrusive; consider a less aggressive notification system if desired.
      // For now, keeping as is, but this could be a future enhancement point.
      // toast({
      //   title: "Upcoming Payment Reminder",
      //   description: `Payment for ${upcomingDueSoon[0].customerName} is due on ${formatDate(upcomingDueSoon[0].dueDate)}. Amount: ${formatCurrency(upcomingDueSoon[0].amountExpected)}`,
      //   variant: "default",
      // });
    }
    
    const allOverdueGlobal = allPaymentsWithContext
      .filter(p => getPaymentStatus(p, p.schemeStartDate) === 'Overdue')
      .sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());

    if (allOverdueGlobal.length > 0) {
      // Similar to above, toast for overdue payments.
      // toast({
      //   title: "Overdue Payment Alert",
      //   description: `Payment for ${allOverdueGlobal[0].customerName} was due on ${formatDate(allOverdueGlobal[0].dueDate)}. Amount: ${formatCurrency(allOverdueGlobal[0].amountExpected)}`,
      //   variant: "destructive",
      // });
    }

  }, [toast, loadSchemesData]);

  const summaryStats = useMemo(() => {
    const activeSchemes = schemes.filter(s => s.status === 'Active' || s.status === 'Overdue');
    const totalCollected = schemes.reduce((sum, s) => sum + (s.totalCollected || 0), 0); 
    const totalExpectedFromActive = activeSchemes.reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + p.amountExpected,0) ,0);
    
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
    collected: { label: 'Collected', color: 'hsl(var(--chart-1))' }, // Use chart-1 for collected
    pending: { label: 'Pending', color: 'hsl(var(--chart-2))' }, // Use chart-2 for pending
  };
  
  const upcomingPaymentsList = useMemo(() => {
    return schemes
      .flatMap(s => s.payments.map(p => ({ ...p, customerName: s.customerName, schemeStartDate: s.startDate })))
      .filter(p => getPaymentStatus(p, p.schemeStartDate) === 'Upcoming' && differenceInDays(parseISO(p.dueDate), new Date()) <= 30 && !isPast(parseISO(p.dueDate)))
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
      .slice(0, 5);
  }, [schemes]);

  const overduePaymentsList = useMemo(() => {
     return schemes
      .flatMap(s => s.payments.map(p => ({ ...p, customerName: s.customerName, schemeStartDate: s.startDate })))
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
    
    return Array.from(groupsMap.entries()).map(([groupName, data]) => ({
      groupName,
      ...data,
    })).filter(g => g.recordableSchemeCount > 0);
  }, [schemes]);

  const handleBatchRecordSubmit = (details: { paymentDate: string; modeOfPayment: any[]; schemeIdsToRecord: string[] }) => {
    if (!selectedGroupForBatch) return;
    setIsBatchRecording(true);
    const result = recordNextDuePaymentsForCustomerGroup(selectedGroupForBatch.groupName, details);
    
    toast({
      title: "Batch Payment Processed",
      description: `Recorded ${result.paymentsRecordedCount} payment(s) for group "${selectedGroupForBatch.groupName}", totaling ${formatCurrency(result.totalRecordedAmount)}. Affected customers: ${[...new Set(result.recordedPaymentsInfo.map(p => p.customerName))].join(', ')}.`,
    });
    
    setSelectedGroupForBatch(null);
    setIsBatchRecording(false);
    loadSchemesData(); 
  };


  return (
    <div className="flex flex-col gap-8"> {/* Increased gap for more spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Dashboard</h1>
        <Link href="/schemes/new">
          <Button size="lg"> {/* Slightly larger button */}
            <Users className="mr-2 h-5 w-5" /> Add New Scheme
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"> {/* Adjusted gap and cols */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schemes</CardTitle>
            <Users className="h-5 w-5 text-primary" /> {/* Use primary color for icon */}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryStats.totalSchemes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-5 w-5 text-green-400" /> {/* Adjusted color */}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summaryStats.totalCollected)}</div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending (Active)</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-400" /> {/* Adjusted color */}
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
            <CalendarCheck className="h-5 w-5 text-blue-400" /> {/* Adjusted color */}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryStats.completedSchemesCount}</div>
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" /> 
            Batch Payment Actions (By Group)
          </CardTitle>
          <CardDescription>Record next due payments for all eligible schemes within a customer group.</CardDescription>
        </CardHeader>
        <CardContent>
          {groupsWithRecordablePayments.length > 0 ? (
            <div className="space-y-3">
              {groupsWithRecordablePayments.map(group => (
                <div key={group.groupName} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border rounded-lg hover:shadow-lg transition-shadow">
                  <div>
                    <p className="text-lg font-semibold text-accent">{group.groupName}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.recordableSchemeCount} scheme(s) with next payment due.
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setSelectedGroupForBatch(group)}
                    disabled={isBatchRecording}
                    className="mt-2 sm:mt-0"
                  >
                    <Edit className="mr-2 h-4 w-4" /> Record Batch
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center">No customer groups currently eligible for batch payment recording.</p>
          )}
        </CardContent>
      </Card>

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

      <div className="grid gap-8 grid-cols-1 md:grid-cols-2"> {/* Increased gap */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Payment Progress (Active Schemes)</CardTitle>
            <CardDescription>Collected vs. Pending amounts for all active schemes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]"> {/* Increased height */}
            {chartData.some(d => d.value > 0) ? (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={chartData} layout="vertical" margin={{ right: 30, left:20, top: 5, bottom: 5 }} barGap={8}>
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
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)'}}
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
        
        {/* AI Recommendations Card Removed */}

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
                      <TableCell className="font-medium">{payment.customerName}</TableCell>
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
      
      <Card className="md:col-span-2"> {/* Allow this to span if only two items in the last row */}
          <CardHeader>
            <CardTitle className="font-headline">Overdue Payments</CardTitle>
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
                      <TableCell className="font-medium">{payment.customerName}</TableCell>
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
