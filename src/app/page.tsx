
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Users, AlertTriangle, DollarSign, PackageCheck, ListChecksIcon, UserPlus, CreditCard, ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import type { Scheme } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, differenceInDays } from 'date-fns';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';

export default function DashboardPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [schemeForHistory, setSchemeForHistory] = useState<Scheme | null>(null);
  
  const loadSchemesData = useCallback(() => {
    const loadedSchemesInitial = getMockSchemes().map(s => {
      const tempS = { ...s };
      tempS.payments.forEach(p => p.status = getPaymentStatus(p, tempS.startDate));
      const totals = calculateSchemeTotals(tempS);
      const status = getSchemeStatus(tempS);
      return { ...tempS, ...totals, status };
    });
    setSchemes(loadedSchemesInitial);
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

  const StatCard = ({ title, value, icon: Icon, description, link, linkText, valueClass }: { title: string; value: string | number; icon: React.ElementType; description?: string; link?: string; linkText?: string; valueClass?: string }) => (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className={`text-3xl font-bold ${valueClass || ''}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
      {link && linkText && (
        <CardContent className="pt-0 pb-4">
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary p-0 h-auto hover:underline">
                <Link href={link}>{linkText} <ChevronRight className="h-3 w-3 ml-1"/></Link>
            </Button>
        </CardContent>
      )}
    </Card>
  );

  return (
    <>
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Dashboard</h1>
        <div className="flex gap-3">
            <Button size="lg" variant="default" asChild className="rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <Link href="/payments/record">
                    <CreditCard className="mr-2 h-5 w-5" /> Record Payment(s)
                </Link>
            </Button>
          <Link href="/schemes/new">
            <Button size="lg" variant="outline" className="rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <UserPlus className="mr-2 h-5 w-5" /> Add New Scheme
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total Schemes" value={summaryStats.totalSchemes} icon={ListChecksIcon} description={`${summaryStats.activeSchemesCount} active`} link="/schemes" linkText="View all schemes"/>
        <StatCard title="Total Collected" value={formatCurrency(summaryStats.totalCollected)} icon={DollarSign} valueClass="text-green-600" link="/transactions" linkText="View transactions"/>
        <StatCard title="Total Pending" value={formatCurrency(summaryStats.totalPending)} icon={TrendingUp} description="From active schemes" valueClass="text-orange-600" />
        <StatCard title="Total Overdue" value={formatCurrency(summaryStats.totalOverdueAmount)} icon={AlertTriangle} valueClass="text-destructive" description={`${overduePaymentsList.length} recent`} />
        <StatCard title="Completed Schemes" value={summaryStats.completedSchemesCount} icon={PackageCheck} valueClass="text-blue-600" />
      </div>

      <SchemeHistoryPanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} scheme={schemeForHistory} />

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Payment Progress</CardTitle>
            <CardDescription>Collected vs. Pending amounts for all active schemes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[380px] p-4">
            {chartData.some(d => d.value > 0) ? (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={chartData} layout="vertical" margin={{ right: 40, left: 30, top: 5, bottom: 20 }} barSize={35} barGap={10}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.6)" />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value).replace('₹', '')} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} stroke="hsl(var(--muted-foreground))" fontSize={14} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => ( <div className="flex flex-col p-1"><span className="capitalize font-medium">{name}</span><span>{formatCurrency(Number(value))}</span></div>)}/>} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}/>
                    <ChartLegend content={<ChartLegendContent wrapperStyle={{paddingTop: '10px'}} />} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : ( <div className="flex items-center justify-center h-full text-muted-foreground">No data to display for payment progress.</div> )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Upcoming Payments</CardTitle>
              <CardDescription>Next 5 payments due in 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingPaymentsList.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingPaymentsList.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div>
                        <Link href={`/schemes/${payment.schemeId}`} className="font-medium hover:underline text-sm">{payment.customerName}</Link>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(payment.dueDate)}</p>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(payment.amountExpected)}</span>
                    </li>
                  ))}
                </ul>
              ) : ( <p className="text-muted-foreground text-center py-4 text-sm">No upcoming payments in the next 30 days.</p> )}
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Recent Overdue</CardTitle>
              <CardDescription>Top 5 most recent overdue payments.</CardDescription>
            </CardHeader>
            <CardContent>
              {overduePaymentsList.length > 0 ? (
                 <ul className="space-y-3">
                  {overduePaymentsList.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors">
                      <div>
                        <Link href={`/schemes/${payment.schemeId}`} className="font-medium hover:underline text-destructive text-sm">{payment.customerName}</Link>
                        <p className="text-xs text-destructive/80">Was Due: {formatDate(payment.dueDate)}</p>
                      </div>
                      <span className="text-sm font-semibold text-destructive">{formatCurrency(payment.amountExpected)}</span>
                    </li>
                  ))}
                </ul>
              ) : ( <p className="text-muted-foreground text-center py-4 text-sm">No overdue payments. Great job!</p> )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
