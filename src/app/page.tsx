
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, AlertTriangle, DollarSign, PackageCheck, ListChecksIcon, UserPlus, CreditCard, ChevronRight, FileText, LineChart } from 'lucide-react';
import Link from 'next/link';
import type { Scheme } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, differenceInDays } from 'date-fns';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { motion } from 'framer-motion';

interface StatItemProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  link?: string;
  linkText?: string;
  valueClass?: string;
  itemIndex: number;
}

const StatListItem: React.FC<StatItemProps> = ({ title, value, icon: Icon, description, link, linkText, valueClass, itemIndex }) => (
  <motion.li
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: itemIndex * 0.1 + 0.2, duration: 0.5 }}
    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors"
  >
    <div className="flex items-center gap-4 mb-2 sm:mb-0">
      <div className="p-2.5 bg-primary/10 rounded-lg">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={cn("text-3xl font-headline font-bold", valueClass)}>{value}</p>
        {description && <p className="text-xs text-muted-foreground pt-0.5">{description}</p>}
      </div>
    </div>
    {link && linkText && (
      <Button variant="link" size="sm" asChild className="text-xs text-primary p-0 h-auto hover:underline font-medium self-start sm:self-center">
        <Link href={link}>{linkText} <ChevronRight className="h-3.5 w-3.5 ml-0.5"/></Link>
      </Button>
    )}
  </motion.li>
);


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
      
    const overdueSchemes = schemes.filter(s => s.status === 'Overdue');

    return {
      totalSchemes: schemes.length,
      activeSchemesCount: activeSchemes.length,
      totalCollected,
      totalPending: totalExpectedFromActive - totalCollected > 0 ? totalExpectedFromActive - totalCollected : 0,
      totalOverdueAmount,
      overdueSchemesCount: overdueSchemes.length,
      completedSchemesCount: schemes.filter(s => s.status === 'Completed').length,
    };
  }, [schemes]);

  const chartData = useMemo(() => [
    { name: 'Collected', value: summaryStats.totalCollected, fill: 'hsl(var(--positive-value))' },
    { name: 'Pending', value: summaryStats.totalPending, fill: 'hsl(var(--warning-value))' },
  ], [summaryStats.totalCollected, summaryStats.totalPending]);

  const chartConfig = {
    collected: { label: 'Collected', color: 'hsl(var(--positive-value))' },
    pending: { label: 'Pending', color: 'hsl(var(--warning-value))' },
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

  const statItems: StatItemProps[] = [
    { itemIndex: 0, title: "Total Schemes", value: summaryStats.totalSchemes, icon: ListChecksIcon, description: `${summaryStats.activeSchemesCount} active`, link: "/schemes", linkText: "View all schemes"},
    { itemIndex: 1, title: "Collected (All Time)", value: formatCurrency(summaryStats.totalCollected), icon: DollarSign, valueClass: "text-[hsl(var(--positive-value))]", link: "/transactions", linkText: "View transactions"},
    { itemIndex: 2, title: "Pending (Active)", value: formatCurrency(summaryStats.totalPending), icon: TrendingUp, valueClass: "text-[hsl(var(--warning-value))]" },
    { itemIndex: 3, title: "Overdue Amount", value: formatCurrency(summaryStats.totalOverdueAmount), icon: AlertTriangle, valueClass: "text-[hsl(var(--negative-value))]", description: `${summaryStats.overdueSchemesCount} overdue schemes` },
    { itemIndex: 4, title: "Completed Schemes", value: summaryStats.completedSchemesCount, icon: PackageCheck, valueClass: "text-primary" },
  ];

  return (
    <>
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-headline font-semibold text-foreground"
        >
          Dashboard
        </motion.h1>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex gap-3"
        >
            <Button size="lg" variant="default" asChild className="rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <Link href="/payments/record">
                    <CreditCard className="mr-2 h-5 w-5" /> Record Payment(s)
                </Link>
            </Button>
          <Button size="lg" variant="outline" asChild className="rounded-lg shadow-md hover:shadow-lg transition-shadow">
             <Link href="/schemes/new">
                <UserPlus className="mr-2 h-5 w-5" /> Add New Scheme
            </Link>
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <Card className="glassmorphism rounded-xl shadow-xl overflow-hidden">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-xl font-headline text-foreground">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {statItems.map((item) => (
                <StatListItem key={item.title} {...item} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      <SchemeHistoryPanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} scheme={schemeForHistory} />

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}>
          <Card className="lg:col-span-2 shadow-xl rounded-xl bg-card">
            <CardHeader className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl text-foreground">Payment Progress</CardTitle>
              </div>
              <CardDescription className="text-sm ml-11">Collected vs. Pending amounts for all active schemes.</CardDescription>
            </CardHeader>
            <CardContent className="h-[380px] p-4">
              {chartData.some(d => d.value > 0) ? (
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData} layout="vertical" margin={{ right: 40, left: 10, top: 5, bottom: 20 }} barSize={40} barGap={15}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value).replace('₹', '')} stroke="hsl(var(--muted-foreground))" fontSize={12} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} stroke="hsl(var(--muted-foreground))" fontSize={14} />
                      <ChartTooltip 
                        content={<ChartTooltipContent 
                            formatter={(value, name) => ( 
                                <div className="flex flex-col p-1.5 rounded-md shadow-lg bg-popover border">
                                    <span className="capitalize font-semibold text-sm text-popover-foreground">{name}</span>
                                    <span className="text-popover-foreground">{formatCurrency(Number(value))}</span>
                                </div>
                            )}
                        />} 
                        cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 8 }}
                      />
                      <ChartLegend content={<ChartLegendContent wrapperStyle={{paddingTop: '15px'}} />} />
                      <Bar dataKey="value" radius={[0, 12, 12, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : ( <div className="flex items-center justify-center h-full text-muted-foreground">No data to display for payment progress.</div> )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}>
            <Card className="shadow-xl rounded-xl bg-card">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="font-headline text-xl text-foreground">Upcoming Payments</CardTitle>
                <CardDescription className="text-sm">Next 5 payments due in 30 days.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {upcomingPaymentsList.length > 0 ? (
                  <ul className="space-y-3.5">
                    {upcomingPaymentsList.map((payment, idx) => (
                       <motion.li 
                        key={payment.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 + 0.75, duration: 0.3 }}
                        className="flex items-center justify-between p-3.5 bg-muted/60 rounded-lg hover:bg-muted transition-colors shadow-sm"
                      >
                        <div>
                          <Link href={`/schemes/${payment.schemeId}`} className="font-medium hover:underline text-sm text-foreground">{payment.customerName}</Link>
                          <p className="text-xs text-muted-foreground">Due: {formatDate(payment.dueDate)}</p>
                        </div>
                        <span className="text-sm font-semibold text-[hsl(var(--warning-value))]">{formatCurrency(payment.amountExpected)}</span>
                      </motion.li>
                    ))}
                  </ul>
                ) : ( <p className="text-muted-foreground text-center py-4 text-sm">No upcoming payments in the next 30 days.</p> )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.5 }}>
            <Card className="shadow-xl rounded-xl bg-card">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="font-headline text-xl text-foreground">Recent Overdue</CardTitle>
                <CardDescription className="text-sm">Top 5 most recent overdue payments.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {overduePaymentsList.length > 0 ? (
                   <ul className="space-y-3.5">
                    {overduePaymentsList.map((payment, idx) => (
                       <motion.li 
                        key={payment.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 + 0.85, duration: 0.3 }}
                        className="flex items-center justify-between p-3.5 bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors shadow-sm"
                      >
                        <div>
                          <Link href={`/schemes/${payment.schemeId}`} className="font-medium hover:underline text-destructive text-sm">{payment.customerName}</Link>
                          <p className="text-xs text-destructive/80">Was Due: {formatDate(payment.dueDate)}</p>
                        </div>
                        <span className="text-sm font-semibold text-destructive">{formatCurrency(payment.amountExpected)}</span>
                      </motion.li>
                    ))}
                  </ul>
                ) : ( <p className="text-muted-foreground text-center py-4 text-sm">No overdue payments. Great job!</p> )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
    </>
  );
}
