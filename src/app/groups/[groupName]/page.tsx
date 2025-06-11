
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, ListChecks, DollarSign, AlertTriangle, Loader2, CreditCard, CheckSquare, History, FileText } from 'lucide-react';
import type { Scheme } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { motion } from 'framer-motion';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel'; // Added import

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const groupName = params.groupName ? decodeURIComponent(params.groupName as string) : '';

  const [allSchemesInGroup, setAllSchemesInGroup] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSchemePeekPanelOpen, setIsSchemePeekPanelOpen] = useState(false); // Added state for history panel
  const [schemeForPeekPanel, setSchemeForPeekPanel] = useState<Scheme | null>(null); // Added state for history panel

  useEffect(() => {
    if (groupName) {
      setIsLoading(true);
      const allSchemes = getMockSchemes();
      const schemesForThisGroup = allSchemes
        .filter(s => s.customerGroupName === groupName)
        .sort((a, b) => { // Sort by Customer Name, then Start Date
          const nameCompare = a.customerName.localeCompare(b.customerName);
          if (nameCompare !== 0) return nameCompare;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
      setAllSchemesInGroup(schemesForThisGroup);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [groupName]);

  const groupSummaryStats = useMemo(() => {
    if (allSchemesInGroup.length === 0) {
        return {
            totalCustomers: 0,
            totalSchemes: 0,
            totalCollected: 0,
            totalPending: 0,
            totalOverdueAmount: 0,
            activeSchemesCount: 0,
        };
    }
    const uniqueCustomerNames = new Set(allSchemesInGroup.map(s => s.customerName));
    const totalCollected = allSchemesInGroup.reduce((sum, s) => sum + (s.totalCollected || 0), 0);
    const totalExpected = allSchemesInGroup.reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + p.amountExpected, 0), 0);
    const totalOverdueAmount = allSchemesInGroup
      .filter(s => s.status === 'Overdue')
      .reduce((sum, s) => {
          const overduePaymentForScheme = s.payments.find(p => p.status === 'Overdue');
          return sum + (overduePaymentForScheme?.amountExpected || 0);
      },0);
      
    return {
      totalCustomers: uniqueCustomerNames.size,
      totalSchemes: allSchemesInGroup.length,
      totalCollected,
      totalPending: totalExpected - totalCollected,
      totalOverdueAmount,
      activeSchemesCount: allSchemesInGroup.filter(s => s.status === 'Active' || s.status === 'Overdue').length,
    };
  }, [allSchemesInGroup]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4 } // Adjusted delay timing
    }),
  };

  const handleShowSchemePeek = (schemeToShow: Scheme) => {
    setSchemeForPeekPanel(schemeToShow);
    setIsSchemePeekPanelOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!groupName || (!isLoading && allSchemesInGroup.length === 0)) {
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
        variants={cardVariants}
        initial="hidden" 
        animate="visible" 
        custom={0}
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

      <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
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
                        transition={{ delay: 0.1 + (1 * 0.1) + (idx * 0.05), duration: 0.3 }} // Adjusted delay
                    >
                        <stat.icon className={`h-7 w-7 mb-2 ${stat.color}`} />
                        <span className={`font-bold text-2xl ${stat.color}`}>{stat.value}</span>
                        <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
                    </motion.div>
                ))}
            </CardContent>
        </Card>
      </motion.div>
      
      {/* Removed Customers in Group Card Section */}

      <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
        <Card className="rounded-xl shadow-xl glassmorphism overflow-hidden">
            <CardHeader>
            <CardTitle className="text-xl font-headline text-foreground">All Schemes in {groupName} ({allSchemesInGroup.length})</CardTitle>
            <CardDescription>Detailed list of all schemes associated with this group, sorted by customer then start date.</CardDescription>
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
                        <TableHead className="text-base font-semibold text-right">Total Collected</TableHead> {/* Added */}
                        <TableHead className="text-base font-semibold text-center">Payments</TableHead>
                        <TableHead className="text-base font-semibold">Status</TableHead>
                        <TableHead className="text-base font-semibold text-center">History</TableHead> {/* Added */}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allSchemesInGroup.map((scheme, idx) => (
                        <motion.tr 
                            key={scheme.id} 
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 + (2 * 0.1) + (idx * 0.03), duration: 0.3 }} // Adjusted delay
                        >
                            <TableCell className="font-medium text-base">{scheme.customerName}</TableCell>
                            <TableCell className="truncate max-w-[100px] sm:max-w-xs text-base">
                                <Link href={`/schemes/${scheme.id}`} className="hover:underline text-primary">
                                    {scheme.id.toUpperCase()}
                                </Link>
                            </TableCell>
                            <TableCell className="text-base">{formatDate(scheme.startDate)}</TableCell>
                            <TableCell className="text-right text-base">{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                            <TableCell className="text-right text-base text-green-600 dark:text-green-500">{formatCurrency(scheme.totalCollected)}</TableCell> {/* Added */}
                            <TableCell className="text-center text-base">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                            <TableCell><SchemeStatusBadge status={scheme.status} /></TableCell>
                            <TableCell className="text-center">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleShowSchemePeek(scheme)}
                                    className="h-9 w-9"
                                >
                                    <History className="h-4 w-4 text-primary" />
                                    <span className="sr-only">View History for {scheme.id}</span>
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

      <SchemeHistoryPanel
        isOpen={isSchemePeekPanelOpen}
        onClose={() => setIsSchemePeekPanelOpen(false)}
        scheme={schemeForPeekPanel}
      />
    </div>
  );
}
