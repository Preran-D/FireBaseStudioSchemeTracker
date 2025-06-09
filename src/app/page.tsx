
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Users, AlertTriangle, DollarSign, CalendarCheck, Edit, Loader2, Users2, Lightbulb, CheckCircle, AlertCircleIcon } from 'lucide-react'; 
import Link from 'next/link';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemes, recordNextDuePaymentsForCustomerGroup } from '@/lib/mock-data'; 
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { useToast } from '@/hooks/use-toast';
import { isPast, parseISO, differenceInDays, formatISO, subDays } from 'date-fns';
import { BatchRecordPaymentDialog } from '@/components/dialogs/BatchRecordPaymentDialog';
import { getDashboardRecommendations, type DashboardInsightsInput, type DashboardRecommendationsOutput } from '@/ai/flows/dashboard-recommendations-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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

  const [aiRecommendations, setAiRecommendations] = useState<DashboardRecommendationsOutput | null>(null);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);


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
    const loadedSchemes = loadSchemesData();
    
    // AI Recommendations Fetching Logic
    if (loadedSchemes.length > 0) {
      setIsFetchingRecommendations(true);
      setRecommendationError(null);

      const totalActive = loadedSchemes.filter(s => s.status === 'Active' || s.status === 'Overdue').length;
      const totalOverdueSchemes = loadedSchemes.filter(s => s.status === 'Overdue').length;
      const totalOverdueAmount = loadedSchemes
        .filter(s => s.status === 'Overdue')
        .reduce((sum, s) => sum + (s.totalRemaining || 0), 0);
      
      const upcomingIn30Days = loadedSchemes
        .flatMap(s => s.payments.map(p => ({ ...p, schemeStartDate: s.startDate })))
        .filter(p => getPaymentStatus(p, p.schemeStartDate) === 'Upcoming' && differenceInDays(parseISO(p.dueDate), new Date()) <= 30 && !isPast(parseISO(p.dueDate)))
        .length;

      const newOverdueLast7Days = loadedSchemes
        .flatMap(s => s.payments.map(p => ({ ...p, schemeStartDate: s.startDate })))
        .filter(p => {
            const paymentIsOverdue = getPaymentStatus(p, p.schemeStartDate) === 'Overdue';
            if (!paymentIsOverdue) return false;
            // Check if due date was within the last 7 days
            return differenceInDays(new Date(), parseISO(p.dueDate)) <= 7 && differenceInDays(new Date(), parseISO(p.dueDate)) >= 0;
        }).length;
      
      const totalExpectedAll = loadedSchemes.reduce((sum,s) => sum + (s.payments.reduce((ps, p) => ps + p.amountExpected, 0)), 0);
      const totalCollectedAll = loadedSchemes.reduce((sum,s) => sum + (s.totalCollected || 0), 0);
      const averagePaymentCollectedPercentage = totalExpectedAll > 0 ? Math.round((totalCollectedAll / totalExpectedAll) * 100) : 0;


      const insightsInput: DashboardInsightsInput = {
        totalActiveSchemes: totalActive,
        totalOverdueSchemes: totalOverdueSchemes,
        totalOverdueAmount: totalOverdueAmount,
        numberOfUpcomingPaymentsNext30Days: upcomingIn30Days,
        numberOfNewOverduePaymentsLast7Days: newOverdueLast7Days,
        averagePaymentCollectedPercentage: averagePaymentCollectedPercentage,
        // commonPaymentDelays: "Some payments are 1-2 days late, especially for new customers." // Example, could be derived
      };

      getDashboardRecommendations(insightsInput)
        .then(setAiRecommendations)
        .catch(err => {
          console.error("Error fetching AI recommendations:", err);
          setRecommendationError("Could not load AI recommendations at this time.");
        })
        .finally(() => setIsFetchingRecommendations(false));
    }


  }, [loadSchemesData]);

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
      totalPending: totalExpectedFromActive - totalCollected, // Only consider pending from active schemes
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
            <CalendarCheck className="h-5 w-5 text-blue-400" /> 
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryStats.completedSchemesCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" /> 
            AI-Powered Recommendations
          </CardTitle>
          <CardDescription>Actionable insights to improve your scheme collections.</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetchingRecommendations && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-8 w-1/2 mt-2" />
              <Skeleton className="h-6 w-full" />
            </div>
          )}
          {recommendationError && !isFetchingRecommendations && (
            <div className="flex flex-col items-center justify-center py-6 text-destructive">
              <AlertCircleIcon className="h-10 w-10 mb-2" />
              <p className="font-semibold">Error Loading Recommendations</p>
              <p className="text-sm">{recommendationError}</p>
            </div>
          )}
          {!isFetchingRecommendations && !recommendationError && aiRecommendations && (
            <div className="space-y-6">
              {aiRecommendations.positiveObservations && aiRecommendations.positiveObservations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-600 mb-2 flex items-center gap-2"><CheckCircle className="h-5 w-5"/>Positive Observations</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {aiRecommendations.positiveObservations.map((obs, index) => <li key={`pos-${index}`}>{obs}</li>)}
                  </ul>
                </div>
              )}
              {aiRecommendations.areasForAttention && aiRecommendations.areasForAttention.length > 0 && (
                 <div>
                  <h3 className="text-lg font-semibold text-orange-600 mb-2 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/>Areas for Attention</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {aiRecommendations.areasForAttention.map((area, index) => <li key={`att-${index}`}>{area}</li>)}
                  </ul>
                </div>
              )}
              {aiRecommendations.recommendations && aiRecommendations.recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-primary mb-2">Actionable Recommendations</h3>
                  <div className="space-y-4">
                    {aiRecommendations.recommendations.map((rec, index) => (
                      <div key={`rec-${index}`} className="p-4 border rounded-lg shadow-sm bg-card">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-md">{rec.title}</h4>
                          <Badge 
                            variant={rec.priority === 'High' ? 'destructive' : rec.priority === 'Medium' ? 'secondary' : 'outline'}
                            className={
                              rec.priority === 'High' ? 'bg-red-100 text-red-700 border-red-300' :
                              rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                              'bg-blue-100 text-blue-700 border-blue-300'
                            }
                          >
                            {rec.priority} Priority
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
               {!aiRecommendations.recommendations?.length && !aiRecommendations.positiveObservations?.length && !aiRecommendations.areasForAttention?.length && (
                <p className="text-muted-foreground text-center py-4">No specific recommendations or observations at this time. Keep up the good work!</p>
               )}
            </div>
          )}
        </CardContent>
      </Card>

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
      
      <Card className="md:col-span-2"> 
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

