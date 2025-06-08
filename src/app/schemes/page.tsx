'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Eye, Edit3, MoreHorizontal } from 'lucide-react';
import type { Scheme } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, calculateSchemeTotals, getSchemeStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);

  useEffect(() => {
    const loadedSchemes = getMockSchemes().map(s => {
      const totals = calculateSchemeTotals(s);
      const status = getSchemeStatus(s);
      return { ...s, ...totals, status };
    });
    setSchemes(loadedSchemes);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-headline font-semibold">All Schemes</h1>
        <Link href="/schemes/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Scheme
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheme Overview</CardTitle>
          <CardDescription>Manage and track all customer schemes.</CardDescription>
        </CardHeader>
        <CardContent>
          {schemes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Monthly Amount</TableHead>
                  <TableHead>Payments Made</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schemes.map((scheme) => (
                  <TableRow key={scheme.id}>
                    <TableCell className="font-medium">{scheme.customerName}</TableCell>
                    <TableCell>{formatDate(scheme.startDate)}</TableCell>
                    <TableCell>{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                    <TableCell>{scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                    <TableCell>
                      <SchemeStatusBadge status={scheme.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/schemes/${scheme.id}`} className="flex items-center">
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          {/* Placeholder for Edit functionality */}
                          {/* <DropdownMenuItem className="flex items-center" disabled> 
                            <Edit3 className="mr-2 h-4 w-4" /> Edit Scheme
                          </DropdownMenuItem> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>No schemes found.</p>
              <Link href="/schemes/new" className="text-primary hover:underline">
                Add your first scheme
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
