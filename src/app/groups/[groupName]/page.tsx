
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, ListChecks, DollarSign, AlertTriangle, Eye, Loader2, CreditCard, CheckSquare, FileText, ChevronRight } from 'lucide-react';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { motion } from 'framer-motion';

interface CustomerInGroup {
  name: string;
  schemes: Scheme[]; // Schemes for this customer *within this group*
  totalCollectedInGroup: number;
  totalExpectedInGroup: number;
  hasOverdueSchemeInGroup: boolean; // If this customer has any overdue scheme *in this group*
  activeSchemesInGroupCount: number; // Active schemes for this customer *in this group*
}

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const groupName = params.groupName ? decodeURIComponent(params.groupName as string) : '';

  const [allSchemesInGroup, setAllSchemesInGroup] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (groupName) {
      setIsLoading(true);
      const allSchemes = getMockSchemes(); // This already processes status and totals
      const schemesForThisGroup = allSchemes
        .filter(s => s.customerGroupName === groupName);
      setAllSchemesInGroup(schemesForThisGroup);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [groupName]);

  const customersInGroup = useMemo(() => {
    if (!allSchemesInGroup.length) return [];

    const customerMap = new Map<string, CustomerInGroup>();

    allSchemesInGroup.forEach(scheme => {
      let customerEntry = customerMap.get(scheme.customerName);
      if (!customerEntry) {
        customerEntry = {
          name: scheme.customerName,
          schemes: [],
          totalCollectedInGroup: 0,
          totalExpectedInGroup: 0,
          hasOverdueSchemeInGroup: false,
          activeSchemesInGroupCount: 0,
        };
      }
      customerEntry.schemes.push(scheme);
      customerEntry.totalCollectedInGroup += scheme.totalCollected || 0;
      // Total expected for a customer in a group is sum of all monthly payments for all their schemes in that group * duration
      // Or more simply, sum of all payments' amountExpected for their schemes in this group
      customerEntry.totalExpectedInGroup += scheme.payments.reduce((sum, p) => sum + p.amountExpected, 0);
      
      if (scheme.status === 'Overdue') {
        customerEntry.hasOverdueSchemeInGroup = true;
      }
      if (scheme.status === 'Active' || scheme.status === 'Overdue') {
        customerEntry.activeSchemesInGroupCount++;
      }
      customerMap.set(scheme.customerName, customerEntry);
    });
    return Array.from(customerMap.values()).sort((a,b) => a.name.localeCompare(b.name));
  }, [allSchemesInGroup]);

  const groupSummaryStats = useMemo(() => {
    const totalCollected = allSchemesInGroup.reduce((sum, s) => sum + (s.totalCollected || 0), 0);
    const totalExpected = allSchemesInGroup.reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + p.amountExpected, 0), 0);
    const totalOverdueAmount = allSchemesInGroup
      .filter(s => s.status === 'Overdue')
      .reduce((sum, s) => {
          const overduePaymentForScheme = s.payments.find(p => p.status === 'Overdue');
          return sum + (overduePaymentForScheme?.amountExpected || 0);
      },0);
      
    return {
      totalCustomers: customersInGroup.length,
      totalSchemes: allSchemesInGroup.length,
      totalCollected,
      totalPending: totalExpected - totalCollected,
      totalOverdueAmount,
      activeSchemesCount: allSchemesInGroup.filter(s => s.status === 'Active' || s.status === 'Overdue').length,
    };
  }, [allSchemesInGroup, customersInGroup]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.07, duration: 0.4 }
    }),
  };


  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!groupName || (!isLoading && allSchemesInGroup.length === 0 && customersInGroup.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-2xl font-semibold">Group Not Found or Empty</h2>
        <p className="text-muted-foreground max-w-md">
          The group "{groupName}" does not exist or has no schemes associated with it. Groups are automatically created when you assign a "Customer Group Name" during scheme creation or by editing an existing scheme's group.
        </p>
        <Button onClick={() => router.push('/groups')} size="lg">
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to All Groups
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <motion.div 
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        initial="hidden" animate="visible" custom={0} variants={cardVariants}
      >
        <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/groups')} className="h-10">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-headline font-bold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg">
                {groupName}
            </h1>
        </div>
        <Button 
            size="lg" 
            asChild 
            className="w-full sm:w-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            disabled={allSchemesInGroup.filter(s => s.status === 'Active' || s.status === 'Overdue').length === 0}
        >
          <Link href={`/payments/record?group=${encodeURIComponent(groupName)}`}>
            <CreditCard className="mr-2.5 h-5 w-5" /> Record Payment for Group
          </Link>
        </Button>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={cardVariants}>
        <Card className="rounded-xl shadow-xl glassmorphism">
            <CardHeader className="pb-4">
            <CardTitle className="text-xl font-headline text-foreground">Group Performance Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { icon: Users, label: "Customers", value: groupSummaryStats.totalCustomers, color: "text-primary" },
                    { icon: ListChecks, label: "Total Schemes", value: groupSummaryStats.totalSchemes, color: "text-primary" },
                    { icon: CheckSquare, label: "Active Schemes", value: groupSummaryStats.activeSchemesCount, color: "text-green-600 dark:text-green-500" },
                    { icon: DollarSign, label: "Collected", value: formatCurrency(groupSummaryStats.totalCollected), color: "text-green-600 dark:text-green-500" },
                    { icon: DollarSign, label: "Pending", value: formatCurrency(groupSummaryStats.totalPending), color: "text-orange-600 dark:text-orange-500" },
                    { icon: AlertTriangle, label: "Overdue Amount", value: formatCurrency(groupSummaryStats.totalOverdueAmount), color: "text-red-600 dark:text-red-500" },
                ].map((stat, idx) => (
                    <motion.div 
                        key={stat.label}
                        className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card/50 dark:bg-card/30 shadow-md hover:shadow-lg transition-shadow"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + idx * 0.05, duration: 0.3 }}
                    >
                        <stat.icon className={`h-7 w-7 mb-2 ${stat.color}`} />
                        <span className={`font-bold text-2xl ${stat.color}`}>{stat.value}</span>
                        <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
                    </motion.div>
                ))}
            </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={cardVariants}>
        <Card className="rounded-xl shadow-xl glassmorphism">
            <CardHeader>
            <CardTitle className="text-xl font-headline text-foreground">Customers in {groupName} ({customersInGroup.length})</CardTitle>
            <CardDescription>Overview of each customer's schemes and financial status within this group.</CardDescription>
            </CardHeader>
            <CardContent>
            {customersInGroup.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No customers found in this group.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {customersInGroup.map((customer, idx) => (
                    <motion.div key={customer.name} variants={cardVariants} custom={idx + 3}>
                    <Card className="rounded-lg shadow-lg hover:shadow-xl transition-shadow h-full flex flex-col glassmorphism border-border/50">
                        <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg font-semibold text-primary">{customer.name}</CardTitle>
                            {customer.hasOverdueSchemeInGroup ? (
                                <Badge variant="destructive" className="text-xs">Overdue</Badge>
                            ) : (
                                <Badge variant="default" className="bg-green-500/80 hover:bg-green-500/70 text-xs">Clear</Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs">
                            {customer.schemes.length} scheme(s) in group ({customer.activeSchemesInGroupCount} active)
                        </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Collected (Group):</span>
                                <span className="font-medium text-green-600 dark:text-green-500">{formatCurrency(customer.totalCollectedInGroup)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Pending (Group):</span>
                                <span className="font-medium text-orange-600 dark:text-orange-500">{formatCurrency(customer.totalExpectedInGroup - customer.totalCollectedInGroup)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Schemes in this group:</p>
                                <div className="flex flex-wrap gap-1.5">
                                {customer.schemes.map(scheme => (
                                    <Button key={scheme.id} variant="outline" size="xs" asChild className="text-xs h-auto py-0.5 px-1.5 rounded">
                                        <Link href={`/schemes/${scheme.id}`} title={`View Scheme ${scheme.id.toUpperCase()}`}>
                                            <FileText className="h-3 w-3 mr-1"/> 
                                            ID-{scheme.id.toUpperCase().substring(0,4)} <span className="mx-1">-</span> <SchemeStatusBadge status={scheme.status}/>
                                        </Link>
                                    </Button>
                                ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    </motion.div>
                ))}
                </div>
            )}
            </CardContent>
        </Card>
      </motion.div>
      
      <motion.div initial="hidden" animate="visible" custom={3 + customersInGroup.length} variants={cardVariants}>
        <Card className="rounded-xl shadow-xl glassmorphism overflow-hidden">
            <CardHeader>
            <CardTitle className="text-xl font-headline text-foreground">All Schemes in {groupName} ({allSchemesInGroup.length})</CardTitle>
            <CardDescription>Detailed list of all schemes associated with this group.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
            {allSchemesInGroup.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No schemes found in this group.</p>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 dark:bg-muted/20">
                        <TableHead className="text-base font-semibold">Customer Name</TableHead>
                        <TableHead className="text-base font-semibold">Scheme ID</TableHead>
                        <TableHead className="text-base font-semibold">Start Date</TableHead>
                        <TableHead className="text-base font-semibold text-right">Monthly Amt.</TableHead>
                        <TableHead className="text-base font-semibold text-center">Payments</TableHead>
                        <TableHead className="text-base font-semibold">Status</TableHead>
                        <TableHead className="text-base font-semibold text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allSchemesInGroup.map((scheme, idx) => (
                        <motion.tr 
                            key={scheme.id} 
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 + (customersInGroup.length * 0.07) + (idx * 0.03), duration: 0.3 }}
                        >
                            <TableCell className="font-medium text-base">{scheme.customerName}</TableCell>
                            <TableCell className="truncate max-w-[100px] sm:max-w-xs text-base">{scheme.id.toUpperCase()}</TableCell>
                            <TableCell className="text-base">{formatDate(scheme.startDate)}</TableCell>
                            <TableCell className="text-right text-base">{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                            <TableCell className="text-center text-base">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                            <TableCell><SchemeStatusBadge status={scheme.status} /></TableCell>
                            <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm" className="h-9 rounded-md">
                                <Link href={`/schemes/${scheme.id}`}>
                                <Eye className="mr-1.5 h-4 w-4" /> View
                                </Link>
                            </Button>
                            </TableCell>
                        </motion.tr>
                        ))}
                    </TableBody>
                    </Table>
                </div>
            )}
            </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
