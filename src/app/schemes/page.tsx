
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Filter, Users2, Loader2, Trash2, XCircle } from 'lucide-react';
import type { Scheme, SchemeStatus } from '@/types/scheme';
import { getMockSchemes, getUniqueGroupNames, updateSchemeGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, calculateSchemeTotals, getSchemeStatus, getPaymentStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { BulkAssignGroupDialog } from '@/components/dialogs/BulkAssignGroupDialog';
import { useToast } from '@/hooks/use-toast';

export default function SchemesPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SchemeStatus | 'all'>('all');
  const { toast } = useToast();

  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);
  
  const [isBulkAssignMode, setIsBulkAssignMode] = useState(false);
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [isBulkAssignDialogOpen, setIsBulkAssignDialogOpen] = useState(false);
  const [isProcessingBulkAssign, setIsProcessingBulkAssign] = useState(false);


  const loadSchemesAndGroups = useCallback(() => {
    const loadedSchemes = getMockSchemes().map(s => {
      const totals = calculateSchemeTotals(s);
      s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      const status = getSchemeStatus(s);
      return { ...s, ...totals, status };
    });
    setAllSchemes(loadedSchemes);
    setExistingGroupNames(getUniqueGroupNames());
  }, []);

  useEffect(() => {
    loadSchemesAndGroups();
  }, [loadSchemesAndGroups]);

  const filteredSchemes = useMemo(() => {
    return allSchemes
      .filter(scheme =>
        statusFilter === 'all' || scheme.status === statusFilter
      )
      .filter(scheme =>
        scheme.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (scheme.customerGroupName && scheme.customerGroupName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        scheme.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [allSchemes, searchTerm, statusFilter]);

  const schemeStatusOptions: { value: SchemeStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Overdue', label: 'Overdue' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Upcoming', label: 'Upcoming' },
  ];

  const handleToggleBulkAssignMode = () => {
    setIsBulkAssignMode(prev => !prev);
    setSelectedSchemeIds([]); // Clear selections when toggling mode
  };

  const handleSelectAllSchemes = (checked: boolean) => {
    if (checked) {
      setSelectedSchemeIds(filteredSchemes.map(s => s.id));
    } else {
      setSelectedSchemeIds([]);
    }
  };

  const handleSchemeSelection = (schemeId: string, checked: boolean) => {
    if (checked) {
      setSelectedSchemeIds(prev => [...prev, schemeId]);
    } else {
      setSelectedSchemeIds(prev => prev.filter(id => id !== schemeId));
    }
  };

  const handleBulkAssignSubmit = (groupName?: string) => {
    if (selectedSchemeIds.length === 0) {
      toast({ title: "No Schemes Selected", description: "Please select at least one scheme to assign a group.", variant: "destructive" });
      return;
    }
    setIsProcessingBulkAssign(true);
    let updatedCount = 0;
    let errorCount = 0;

    selectedSchemeIds.forEach(schemeId => {
      const updated = updateSchemeGroup(schemeId, groupName);
      if (updated) {
        updatedCount++;
      } else {
        errorCount++;
      }
    });

    toast({
      title: "Bulk Group Assignment Complete",
      description: `${updatedCount} scheme(s) ${groupName ? `assigned to group "${groupName}"` : 'removed from group'}. ${errorCount > 0 ? `${errorCount} error(s).` : ''}`,
    });
    
    loadSchemesAndGroups();
    setIsBulkAssignDialogOpen(false);
    setIsBulkAssignMode(false);
    setSelectedSchemeIds([]);
    setIsProcessingBulkAssign(false);
  };
  
  const isAllFilteredSelected = filteredSchemes.length > 0 && selectedSchemeIds.length === filteredSchemes.length;


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-headline font-semibold">All Schemes</h1>
          <div className="flex gap-2">
            {!isBulkAssignMode && (
              <Button variant="outline" onClick={handleToggleBulkAssignMode}>
                <Users2 className="mr-2 h-4 w-4" /> Bulk Assign Group
              </Button>
            )}
            <Link href="/schemes/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Scheme
              </Button>
            </Link>
          </div>
        </div>
        
        {isBulkAssignMode && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Bulk Group Assignment Mode</CardTitle>
              <CardDescription>Select schemes from the table below to assign them to a group or remove them from their current group.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2 items-center">
               <Button 
                onClick={() => setIsBulkAssignDialogOpen(true)} 
                disabled={selectedSchemeIds.length === 0 || isProcessingBulkAssign}
              >
                {isProcessingBulkAssign ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users2 className="mr-2 h-4 w-4" />}
                Assign Group to {selectedSchemeIds.length} Selected
              </Button>
              <Button variant="ghost" onClick={handleToggleBulkAssignMode} className="text-muted-foreground">
                <XCircle className="mr-2 h-4 w-4" /> Cancel Bulk Mode
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Scheme Overview</CardTitle>
            <CardDescription>Manage and track all customer schemes. Filter by name, group, or status.</CardDescription>
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Filter by customer, group name or scheme ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as SchemeStatus | 'all');
                  setSelectedSchemeIds([]); // Clear selection when filter changes
                }}
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
                    {isBulkAssignMode && (
                      <TableHead padding="checkbox" className="w-12">
                        <Checkbox
                          checked={isAllFilteredSelected}
                          onCheckedChange={handleSelectAllSchemes}
                          aria-label="Select all filtered schemes"
                          disabled={filteredSchemes.length === 0}
                        />
                      </TableHead>
                    )}
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Monthly Amount</TableHead>
                    <TableHead>Payments Made</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchemes.map((scheme) => (
                    <TableRow key={scheme.id} data-state={selectedSchemeIds.includes(scheme.id) ? 'selected' : ''}>
                       {isBulkAssignMode && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSchemeIds.includes(scheme.id)}
                            onCheckedChange={(checked) => handleSchemeSelection(scheme.id, !!checked)}
                            aria-label={`Select scheme ${scheme.id}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <Link href={`/schemes/${scheme.id}`} className="hover:underline text-primary">
                          {scheme.customerName}
                        </Link>
                      </TableCell>
                      <TableCell>{scheme.customerGroupName || '-'}</TableCell>
                      <TableCell>{formatDate(scheme.startDate)}</TableCell>
                      <TableCell>{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                      <TableCell>{scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                      <TableCell>
                        <SchemeStatusBadge status={scheme.status} />
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
      
      {isBulkAssignMode && (
        <BulkAssignGroupDialog
          isOpen={isBulkAssignDialogOpen}
          onClose={() => setIsBulkAssignDialogOpen(false)}
          selectedSchemeCount={selectedSchemeIds.length}
          existingGroupNames={existingGroupNames}
          onSubmit={handleBulkAssignSubmit}
          isLoading={isProcessingBulkAssign}
        />
      )}
    </>
  );
}
