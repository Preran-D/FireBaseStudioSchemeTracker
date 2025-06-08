
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, ListChecks, DollarSign, AlertTriangle, Eye, Loader2 } from 'lucide-react';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';

interface CustomerInGroup {
  name: string;
  schemes: Scheme[];
  totalCollectedInGroup: number;
  totalExpectedInGroup: number;
  hasOverdueSchemeInGroup: boolean;
  activeSchemesInGroupCount: number;
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
      const allSchemes = getMockSchemes();
      const schemesForThisGroup = allSchemes
        .filter(s => s.customerGroupName === groupName)
        .map(s => {
          const totals = calculateSchemeTotals(s);
          s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
          const status = getSchemeStatus(s);
          return { ...s, ...totals, status };
        });
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
      .reduce((sum, s) => sum + (s.totalRemaining || 0), 0);
      
    return {
      totalCustomers: customersInGroup.length,
      totalSchemes: allSchemesInGroup.length,
      totalCollected,
      totalPending: totalExpected - totalCollected,
      totalOverdueAmount,
      activeSchemesCount: allSchemesInGroup.filter(s => s.status === 'Active' || s.status === 'Overdue').length,
    };
  }, [allSchemesInGroup, customersInGroup]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!groupName || (!isLoading && allSchemesInGroup.length === 0 && customersInGroup.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Group Not Found or Empty</h2>
        <p className="text-muted-foreground">The group "{groupName}" does not exist or has no schemes associated with it.</p>
        <Button onClick={() => router.push('/groups')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/groups')} size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Button>
        <h1 className="text-2xl font-headline font-semibold">Group: {groupName}</h1>
        <div></div> {/* Spacer */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col items-center p-3 rounded-md border">
                <Users className="h-6 w-6 mb-1 text-primary"/>
                <span className="font-semibold">{groupSummaryStats.totalCustomers}</span>
                <span className="text-xs text-muted-foreground">Customers</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-md border">
                <ListChecks className="h-6 w-6 mb-1 text-primary"/>
                <span className="font-semibold">{groupSummaryStats.totalSchemes}</span>
                <span className="text-xs text-muted-foreground">Total Schemes</span>
            </div>
             <div className="flex flex-col items-center p-3 rounded-md border">
                <ListChecks className="h-6 w-6 mb-1 text-green-500"/>
                <span className="font-semibold">{groupSummaryStats.activeSchemesCount}</span>
                <span className="text-xs text-muted-foreground">Active Schemes</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-md border">
                <DollarSign className="h-6 w-6 mb-1 text-green-500"/>
                <span className="font-semibold">{formatCurrency(groupSummaryStats.totalCollected)}</span>
                <span className="text-xs text-muted-foreground">Total Collected</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-md border">
                <DollarSign className="h-6 w-6 mb-1 text-orange-500"/>
                <span className="font-semibold">{formatCurrency(groupSummaryStats.totalPending)}</span>
                <span className="text-xs text-muted-foreground">Total Pending</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-md border">
                <AlertTriangle className="h-6 w-6 mb-1 text-destructive"/>
                <span className="font-semibold">{formatCurrency(groupSummaryStats.totalOverdueAmount)}</span>
                <span className="text-xs text-muted-foreground">Total Overdue</span>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers in this Group ({customersInGroup.length})</CardTitle>
          <CardDescription>Overview of customers and their scheme status within this group.</CardDescription>
        </CardHeader>
        <CardContent>
          {customersInGroup.length === 0 ? (
             <p className="text-muted-foreground text-center py-4">No customers found in this group.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead className="text-center">Schemes in Group</TableHead>
                  <TableHead className="text-right">Collected (Group)</TableHead>
                  <TableHead className="text-right">Pending (Group)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersInGroup.map((customer) => (
                  <TableRow key={customer.name}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-center">{customer.schemes.length} ({customer.activeSchemesInGroupCount} active)</TableCell>
                    <TableCell className="text-right">{formatCurrency(customer.totalCollectedInGroup)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(customer.totalExpectedInGroup - customer.totalCollectedInGroup)}</TableCell>
                    <TableCell className="text-center">
                      {customer.hasOverdueSchemeInGroup ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500/80 hover:bg-green-500/70">Clear</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Schemes in this Group ({allSchemesInGroup.length})</CardTitle>
          <CardDescription>Detailed list of all schemes associated with "{groupName}".</CardDescription>
        </CardHeader>
        <CardContent>
           {allSchemesInGroup.length === 0 ? (
             <p className="text-muted-foreground text-center py-4">No schemes found in this group.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Scheme ID</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead className="text-right">Monthly Amt.</TableHead>
                  <TableHead className="text-center">Payments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSchemesInGroup.map((scheme) => (
                  <TableRow key={scheme.id}>
                    <TableCell className="font-medium">{scheme.customerName}</TableCell>
                    <TableCell className="truncate max-w-[100px] sm:max-w-xs">{scheme.id}</TableCell>
                    <TableCell>{formatDate(scheme.startDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                    <TableCell className="text-center">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                    <TableCell><SchemeStatusBadge status={scheme.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/schemes/${scheme.id}`}>
                          <Eye className="mr-1 h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">View</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    