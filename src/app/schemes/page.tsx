
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Eye, MoreHorizontal, Filter } from 'lucide-react';
import type { Scheme, SchemeStatus } from '@/types/scheme';
import { getMockSchemes } from '@/lib/mock-data';
import { formatCurrency, formatDate, calculateSchemeTotals, getSchemeStatus, getPaymentStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SchemesPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SchemeStatus | 'all'>('all');

  useEffect(() => {
    const loadedSchemes = getMockSchemes().map(s => {
      const totals = calculateSchemeTotals(s);
      // Ensure payment statuses are up-to-date before getting scheme status
      s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      const status = getSchemeStatus(s);
      return { ...s, ...totals, status };
    });
    setAllSchemes(loadedSchemes);
  }, []);

  const filteredSchemes = useMemo(() => {
    return allSchemes
      .filter(scheme =>
        statusFilter === 'all' || scheme.status === statusFilter
      )
      .filter(scheme =>
        scheme.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [allSchemes, searchTerm, statusFilter]);

  const schemeStatusOptions: { value: SchemeStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Overdue', label: 'Overdue' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Upcoming', label: 'Upcoming' },
  ];

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
          <CardDescription>Manage and track all customer schemes. Apply filters to refine your view.</CardDescription>
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Filter by customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as SchemeStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {schemeStatusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSchemes.length > 0 ? (
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
                {filteredSchemes.map((scheme) => (
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>No schemes match your filters.</p>
              {searchTerm === '' && statusFilter === 'all' && (
                 <Link href="/schemes/new" className="text-primary hover:underline">
                    Add your first scheme
                 </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
