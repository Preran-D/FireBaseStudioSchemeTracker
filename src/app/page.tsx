
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, CreditCard, Search, PackageCheck, ListChecks, CalendarDays, LineChart as LineChartIcon, ChevronRight, Users, Repeat } from 'lucide-react';
import Link from 'next/link';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart, Tooltip as RechartsTooltip } from "recharts";
import { parseISO, format, startOfMonth, eachMonthOfInterval, subMonths, isWithinInterval } from 'date-fns';
import { motion } from 'framer-motion';

interface RecentTransaction extends Payment {
  customerName: string;
  customerGroupName?: string;
}

export default function DashboardPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const loadedSchemesInitial = getMockSchemes().map(s => {
      const tempS = { ...s };
      tempS.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      const totals = calculateSchemeTotals(tempS);
      const status = getSchemeStatus(tempS);
      return { ...tempS, ...totals, status };
    });
    setAllSchemes(loadedSchemesInitial);
  }, []);

  const totalSchemesCount = useMemo(() => {
    return allSchemes.length;
  }, [allSchemes]);

  const recentlyCompletedSchemes = useMemo(() => {
    let schemes = allSchemes
      .filter(s => s.status === 'Completed' && s.closureDate)
      .sort((a, b) => parseISO(b.closureDate!).getTime() - parseISO(a.closureDate!).getTime());

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      schemes = schemes.filter(s =>
        s.customerName.toLowerCase().includes(lowerSearchTerm) ||
        s.id.toLowerCase().includes(lowerSearchTerm) ||
        (s.customerGroupName && s.customerGroupName.toLowerCase().includes(lowerSearchTerm))
      );
    }
    return schemes.slice(0, 10);
  }, [allSchemes, searchTerm]);

  const recentTransactions = useMemo(() => {
    let transactions: RecentTransaction[] = [];
    allSchemes.forEach(scheme => {
      scheme.payments.forEach(payment => {
        if (payment.status === 'Paid' && payment.paymentDate) {
          transactions.push({
            ...payment,
            customerName: scheme.customerName,
            customerGroupName: scheme.customerGroupName,
          });
        }
      });
    });

    let sortedTransactions = transactions
      .sort((a, b) => parseISO(b.paymentDate!).getTime() - parseISO(a.paymentDate!).getTime());

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      sortedTransactions = sortedTransactions.filter(tx =>
        tx.customerName.toLowerCase().includes(lowerSearchTerm) ||
        tx.schemeId.toLowerCase().includes(lowerSearchTerm) ||
        (tx.customerGroupName && tx.customerGroupName.toLowerCase().includes(lowerSearchTerm))
      );
    }
    return sortedTransactions.slice(0, 10);
  }, [allSchemes, searchTerm]);

  const monthlyCollectionsData = useMemo(() => {
    const collections: Record<string, number> = {};
    const endDate = new Date();
    const startDate = subMonths(endDate, 11); // Last 12 months including current

    const monthsInterval = eachMonthOfInterval({ start: startDate, end: endDate });

    monthsInterval.forEach(monthStart => {
      const monthKey = format(monthStart, 'yyyy-MM');
      collections[monthKey] = 0;
    });

    allSchemes.forEach(scheme => {
      scheme.payments.forEach(payment => {
        if (payment.status === 'Paid' && payment.paymentDate) {
          const paymentDateObj = parseISO(payment.paymentDate);
          if (isWithinInterval(paymentDateObj, { start: startDate, end: endDate })) {
            const monthKey = format(paymentDateObj, 'yyyy-MM');
            collections[monthKey] = (collections[monthKey] || 0) + (payment.amountPaid || 0);
          }
        }
      });
    });

    return Object.entries(collections)
      .map(([month, totalCollected]) => ({
        month,
        monthLabel: format(parseISO(month + '-01'), 'MMM yyyy'), // Use first day for formatting
        totalCollected,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [allSchemes]);

  const monthlyCollectionsChartConfig = {
    totalCollected: { label: "Collected", color: "hsl(var(--positive-value))" },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ // Ensure type annotation is compatible or removed if causing issues
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4 } // Adjusted delay/duration slightly
    }),
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Top Section: Header and Actions */}
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <h1 className="text-4xl font-headline font-semibold text-foreground">Dashboard</h1>
        <div className="flex gap-3">
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
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div  variants={cardVariants} initial="hidden" animate="visible" custom={1}>
        <Card className="glassmorphism rounded-xl shadow-xl">
          <CardContent className="p-4 sm:p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search schemes, customers, or groups..."
                className="pl-10 h-12 text-base rounded-lg focus:ring-2 focus:ring-primary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Total Schemes Display */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
        <Card className="glassmorphism rounded-xl shadow-xl">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-xl font-headline text-foreground flex items-center">
              <ListChecks className="mr-2.5 h-6 w-6 text-primary" />
              Total Active Schemes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-5xl font-bold text-foreground">{allSchemes.filter(s => s.status === 'Active' || s.status === 'Overdue').length}</p>
            <p className="text-sm text-muted-foreground">out of {totalSchemesCount} total schemes registered.</p>
            <Link href="/schemes" className="text-sm text-primary hover:underline mt-2 inline-flex items-center">
                View All Schemes <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Grid for Lists and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Monthly Collections Chart */}
        <motion.div
          className="lg:col-span-2"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xl font-headline text-foreground flex items-center">
                <LineChartIcon className="mr-2.5 h-6 w-6 text-primary" />
                Monthly Collections (Last 12 Months)
              </CardTitle>
              <CardDescription>Total amount collected each month.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] p-4 sm:p-5">
              {monthlyCollectionsData.length > 0 ? (
                <ChartContainer config={monthlyCollectionsChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={monthlyCollectionsData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                      <XAxis dataKey="monthLabel" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={{ stroke: 'hsl(var(--border)/0.7)' }} />
                      <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹','')} fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={{ stroke: 'hsl(var(--border)/0.7)' }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 'bold' }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        formatter={(value: number) => [formatCurrency(value), "Collected"]}
                      />
                      <ChartLegend content={<ChartLegendContent wrapperStyle={{paddingTop: '10px'}} />} />
                      <Bar dataKey="totalCollected" fill="var(--color-totalCollected)" radius={[6, 6, 0, 0]} barSize={30}/>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No collection data for the past 12 months.</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Collections List */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={4}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xl font-headline text-foreground flex items-center">
                <CalendarDays className="mr-2.5 h-6 w-6 text-primary" />
                Collections by Month
              </CardTitle>
              <CardDescription>Breakdown of collections from the past year.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-3 pb-4 max-h-[350px] overflow-y-auto">
              {monthlyCollectionsData.filter(m => m.totalCollected > 0).length > 0 ? (
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyCollectionsData.filter(m => m.totalCollected > 0).reverse().map((item) => (
                      <TableRow key={item.month}>
                        <TableCell className="font-medium py-2.5">{item.monthLabel}</TableCell>
                        <TableCell className="text-right py-2.5 text-[hsl(var(--positive-value))] font-semibold">{formatCurrency(item.totalCollected)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No collections recorded in the past 12 months.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Recently Completed Schemes */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={5}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xl font-headline text-foreground flex items-center">
                <PackageCheck className="mr-2.5 h-6 w-6 text-primary" />
                Recently Completed Schemes
              </CardTitle>
              <CardDescription>Top 10 schemes marked as completed. {searchTerm && `(Filtered by "${searchTerm}")`}</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-3 pb-4 max-h-[400px] overflow-y-auto">
              {recentlyCompletedSchemes.length > 0 ? (
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden sm:table-cell">Group</TableHead>
                      <TableHead className="text-right">Closed On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentlyCompletedSchemes.map((scheme) => (
                      <TableRow key={scheme.id}>
                        <TableCell className="font-medium py-2.5">
                          <Link href={`/schemes/${scheme.id}`} className="hover:underline text-primary">{scheme.customerName}</Link>
                          <p className="text-xs text-muted-foreground block sm:hidden">ID: {scheme.id.toUpperCase()}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2.5">
                            {scheme.customerGroupName ? (
                                <Link href={`/groups/${encodeURIComponent(scheme.customerGroupName)}`} className="hover:underline text-xs text-primary">
                                    {scheme.customerGroupName}
                                </Link>
                            ): <span className="text-xs text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="text-right py-2.5">{formatDate(scheme.closureDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {searchTerm ? `No completed schemes match "${searchTerm}".` : "No schemes completed yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={6}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xl font-headline text-foreground flex items-center">
                <Repeat className="mr-2.5 h-6 w-6 text-primary" />
                Recent Transactions
              </CardTitle>
              <CardDescription>Last 10 payments recorded. {searchTerm && `(Filtered by "${searchTerm}")`}</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-3 pb-4 max-h-[400px] overflow-y-auto">
              {recentTransactions.length > 0 ? (
                <><Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium py-2.5">
                          <Link href={`/schemes/${tx.schemeId}`} className="hover:underline text-primary">{tx.customerName}</Link>
                          <p className="text-xs text-muted-foreground block sm:hidden">Paid: {formatDate(tx.paymentDate)}</p>
                          {tx.customerGroupName && (
                            <p className="text-xs text-muted-foreground block sm:hidden flex items-center gap-1">
                              <Users className="h-3 w-3" /> {tx.customerGroupName}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2.5">{formatDate(tx.paymentDate)}</TableCell>
                        <TableCell className="text-right py-2.5 text-[hsl(var(--positive-value))] font-semibold">{formatCurrency(tx.amountPaid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table><div className="mt-3 text-center">
                    <Button variant="link" asChild size="sm" className="text-primary">
                      <Link href="/transactions">View All Transactions <ChevronRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  </div></>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {searchTerm ? `No transactions match "${searchTerm}".` : "No transactions recorded yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
