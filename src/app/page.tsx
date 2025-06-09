
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Users, AlertTriangle, DollarSign, PackageCheck, History, ListChecksIcon } from 'lucide-react'; // Added ListChecksIcon
import Link from 'next/link';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, differenceInDays } from 'date-fns';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { AddPaymentDialog } from '@/components/dialogs/AddPaymentDialog'; // New Dialog

export default function DashboardPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [schemeForHistory, setSchemeForHistory] = useState<Scheme | null>(null);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);

  const loadSchemesData = useCallback(() => {
    console.log('loadSchemesData called');
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

  const handleOpenHistoryPanel = (scheme: Scheme) => {
    setSchemeForHistory(scheme);
    setIsHistoryPanelOpen(true);
  };

  return (
    <>
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Button size="lg" onClick={() => setIsAddPaymentDialogOpen(true)}>
            <ListChecksIcon className="mr-2 h-5 w-5" /> Add Payment
          </Button>
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

      {/* The entire "Record Payment" Card previously here has been REMOVED */}

      <AddPaymentDialog
        isOpen={isAddPaymentDialogOpen}
        onClose={() => setIsAddPaymentDialogOpen(false)}
        allSchemes={schemes} // Pass all schemes
        onPaymentRecorded={() => {
          loadSchemesData(); // Reload schemes after payment
          // No need to close dialog here, dialog can manage its own closure or stay open for more actions
        }}
      />

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
            <CardDescription>Top 5 upcoming payments.</CardDescription>
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
    </>
  );
}
