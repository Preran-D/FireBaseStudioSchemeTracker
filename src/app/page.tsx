
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input'; // Removed Input
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, CreditCard, /*Search,*/ PackageCheck, ListChecks, CalendarDays, LineChart as LineChartIcon, ChevronRight, Users, Repeat } from 'lucide-react'; // Removed Search
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
  // const [searchTerm, setSearchTerm] = useState<string>(''); // Removed searchTerm state

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
    const schemes = allSchemes
      .filter(s => s.status === 'Fully Paid' && s.closureDate)
      .sort((a, b) => parseISO(b.closureDate!).getTime() - parseISO(a.closureDate!).getTime());
    // Removed searchTerm filtering
    return schemes.slice(0, 10);
  }, [allSchemes]); // Removed searchTerm from dependencies

  const recentTransactions = useMemo(() => {
    const transactions: RecentTransaction[] = [];
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

    const sortedTransactions = transactions
      .sort((a, b) => parseISO(b.paymentDate!).getTime() - parseISO(a.paymentDate!).getTime());
    // Removed searchTerm filtering
    return sortedTransactions.slice(0, 10);
  }, [allSchemes]); // Removed searchTerm from dependencies

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
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4 }
    }),
  };

    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 }
  }),
};

// Icons for KPI cards
import { TrendingUp, TrendingDown, DollarSign as DollarSignIcon, Users as UsersIcon, CheckCircle2, AlertOctagon, PlusCircle as PlusCircleIcon, Archive as ArchiveIcon } from 'lucide-react';


export default function DashboardPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);

  useEffect(() => {
    const loadedSchemesInitial = getMockSchemes().map(s => {
      const tempS = { ...s };
      // Ensure payments are not soft-deleted before calculating their status
      tempS.payments = tempS.payments.filter(p => !p.deletedDate);
      tempS.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      const totals = calculateSchemeTotals(tempS); // calculateSchemeTotals should also ignore soft-deleted payments
      const status = getSchemeStatus(tempS); // getSchemeStatus should also ignore soft-deleted payments
      return { ...s, ...totals, status }; // Return original s to keep all fields, then overwrite calculated
    });
    setAllSchemes(loadedSchemesInitial);
  }, []);

  const totalActiveSchemes = useMemo(() => {
    return allSchemes.filter(s => s.status === 'Active' || s.status === 'Overdue').length;
  }, [allSchemes]);

  const totalSchemesCount = useMemo(() => allSchemes.length, [allSchemes]);

  const kpiData = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthString = format(now, 'MMMM yyyy');

    let collectionsThisMonth = 0;
    allSchemes.forEach(scheme => {
      scheme.payments.forEach(payment => {
        if (payment.status === 'Paid' && payment.paymentDate) {
          const paymentDateObj = parseISO(payment.paymentDate);
          if (paymentDateObj >= currentMonthStart && paymentDateObj <= now) {
            collectionsThisMonth += payment.amountPaid || 0;
          }
        }
      });
    });

    const newSchemesThisMonth = allSchemes.filter(scheme => {
      const schemeStartDateObj = parseISO(scheme.startDate);
      return schemeStartDateObj >= currentMonthStart && schemeStartDateObj <= now;
    }).length;

    const totalFullyPaidSchemes = allSchemes.filter(s => s.status === 'Fully Paid').length;

    let overduePaymentsCount = 0;
    let totalOverdueAmount = 0;
    allSchemes.forEach(scheme => {
      if (scheme.status === 'Overdue') { // Check scheme status first
        scheme.payments.forEach(payment => {
          if (payment.status === 'Overdue') {
            overduePaymentsCount++;
            totalOverdueAmount += payment.amountExpected || 0;
          }
        });
      }
    });

    return {
      collectionsThisMonth,
      newSchemesThisMonth,
      totalFullyPaidSchemes,
      overduePaymentsCount,
      totalOverdueAmount,
      currentMonthString
    };
  }, [allSchemes]);


  const recentlyCompletedSchemes = useMemo(() => {
    // Assuming 'closureDate' is set when a scheme becomes 'Fully Paid' and is considered "completed" for this list
    const schemes = allSchemes
      .filter(s => s.status === 'Fully Paid' && s.closureDate)
      .sort((a, b) => parseISO(b.closureDate!).getTime() - parseISO(a.closureDate!).getTime());
    return schemes.slice(0, 5); // Limit to 5 for brevity
  }, [allSchemes]);

  const recentTransactions = useMemo(() => {
    const transactions: RecentTransaction[] = [];
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
    return transactions
      .sort((a, b) => parseISO(b.paymentDate!).getTime() - parseISO(a.paymentDate!).getTime())
      .slice(0, 5); // Limit to 5
  }, [allSchemes]);

  const monthlyCollectionsData = useMemo(() => {
    const collections: Record<string, number> = {};
    const endDate = new Date();
    const startDate = subMonths(endDate, 11);
    const monthsInterval = eachMonthOfInterval({ start: startDate, end: endDate });
    monthsInterval.forEach(monthStart => collections[format(monthStart, 'yyyy-MM')] = 0);

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
      .map(([month, totalCollected]) => ({ month, monthLabel: format(parseISO(month + '-01'), 'MMM yy'), totalCollected }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [allSchemes]);

  const monthlyCollectionsChartConfig = { totalCollected: { label: "Collected", color: "hsl(var(--chart-1))" } };


  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6"> {/* Added padding to main container */}
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        variants={cardVariants} initial="hidden" animate="visible" custom={0}
      >
        <h1 className="text-3xl md:text-4xl font-headline font-semibold text-foreground">Dashboard</h1>
        <div className="flex gap-2 sm:gap-3">
          <Button size="sm" sm-size="lg" variant="default" asChild className="rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Link href="/payments/record"><CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Record Payment(s)</Link>
          </Button>
          <Button size="sm" sm-size="lg" variant="outline" asChild className="rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <Link href="/schemes/new"><UserPlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Add New Scheme</Link>
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          { title: "Active Schemes", value: totalActiveSchemes, icon: ListChecks, description: `out of ${totalSchemesCount} total`, link: "/schemes" },
          { title: "Monthly Collections", value: formatCurrency(kpiData.collectionsThisMonth), icon: DollarSignIcon, description: `for ${kpiData.currentMonthString}` },
          { title: "New Schemes This Month", value: kpiData.newSchemesThisMonth, icon: PlusCircleIcon, description: `in ${kpiData.currentMonthString}` },
          { title: "Fully Paid (All Time)", value: kpiData.totalFullyPaidSchemes, icon: CheckCircle2, description: "schemes completed" },
          { title: "Overdue Payments", value: `${kpiData.overduePaymentsCount} / ${formatCurrency(kpiData.totalOverdueAmount)}`, icon: AlertOctagon, description: "count / total amount" }
        ].map((kpi, index) => (
          <motion.div key={kpi.title} variants={cardVariants} initial="hidden" animate="visible" custom={index + 1}>
            <Card className="glassmorphism rounded-xl shadow-lg hover:shadow-xl transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <kpi.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground pt-1">{kpi.description}</p>
                {kpi.link && (
                   <Link href={kpi.link} className="text-xs text-primary hover:underline mt-1 inline-flex items-center">
                       View Details <ChevronRight className="h-3 w-3 ml-0.5" />
                   </Link>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Grid for Chart and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div className="lg:col-span-2" variants={cardVariants} initial="hidden" animate="visible" custom={6}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xl font-headline text-foreground flex items-center">
                <LineChartIcon className="mr-2.5 h-6 w-6 text-primary" />
                Collections (Last 12 Months)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] p-2 sm:p-4">
              {monthlyCollectionsData.length > 0 ? (
                <ChartContainer config={monthlyCollectionsChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={monthlyCollectionsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" />
                      <XAxis dataKey="monthLabel" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={{ stroke: 'hsl(var(--border)/0.5)' }} />
                      <YAxis tickFormatter={(value) => formatCurrency(value, '').replace('₹','')} fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={{ stroke: 'hsl(var(--border)/0.5)' }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '0.8rem'}}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 'bold' }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        formatter={(value: number) => [formatCurrency(value), "Collected"]}
                      />
                      <Bar dataKey="totalCollected" fill="var(--color-totalCollected)" radius={[4, 4, 0, 0]} barSize={25}/>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No collection data for the past 12 months.</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={7}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xl font-headline text-foreground flex items-center">
                <CalendarDays className="mr-2.5 h-6 w-6 text-primary" />
                Monthly Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-4 max-h-[300px] sm:max-h-[350px] overflow-y-auto">
              {monthlyCollectionsData.filter(m => m.totalCollected > 0).length > 0 ? (
                <Table className="text-xs sm:text-sm">
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Collected</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {monthlyCollectionsData.filter(m => m.totalCollected > 0).reverse().map((item) => (
                      <TableRow key={item.month}>
                        <TableCell className="font-medium py-2">{item.monthLabel}</TableCell>
                        <TableCell className="text-right py-2 text-green-600 dark:text-green-500 font-semibold">{formatCurrency(item.totalCollected)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No collections in the past 12 months.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={8}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-lg font-headline text-foreground flex items-center">
                <PackageCheck className="mr-2 h-5 w-5 text-primary" />
                Recently Fully Paid
              </CardTitle>
              <CardDescription className="text-xs">Last 5 schemes marked as fully paid.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-3 pb-3 max-h-[300px] overflow-y-auto">
              {recentlyCompletedSchemes.length > 0 ? (
                <Table className="text-xs sm:text-sm">
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Closed On</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {recentlyCompletedSchemes.map((scheme) => (
                      <TableRow key={scheme.id}>
                        <TableCell className="font-medium py-2">
                          <Link href={`/schemes/${scheme.id}`} className="hover:underline text-primary">{scheme.customerName}</Link>
                          <p className="text-xs text-muted-foreground sm:hidden">ID: {scheme.id}</p>
                        </TableCell>
                        <TableCell className="text-right py-2">{formatDate(scheme.closureDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No schemes are fully paid yet.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={9}>
          <Card className="glassmorphism rounded-xl shadow-xl h-full">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-lg font-headline text-foreground flex items-center">
                <Repeat className="mr-2 h-5 w-5 text-primary" />
                Recent Transactions
              </CardTitle>
              <CardDescription className="text-xs">Last 5 payments recorded.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-3 pb-3 max-h-[300px] overflow-y-auto">
              {recentTransactions.length > 0 ? (
                <>
                <Table className="text-xs sm:text-sm">
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {recentTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium py-2">
                          <Link href={`/schemes/${tx.schemeId}`} className="hover:underline text-primary">{tx.customerName}</Link>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.paymentDate)}</p>
                        </TableCell>
                        <TableCell className="text-right py-2 text-green-600 dark:text-green-500 font-semibold">{formatCurrency(tx.amountPaid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-2 text-center">
                  <Button variant="link" asChild size="sm" className="text-xs text-primary"><Link href="/transactions">View All <ChevronRight className="h-3 w-3 ml-0.5" /></Link></Button>
                </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">No transactions recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
