
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Filter, Users2, Loader2, Trash2, XCircle, ListChecks, ArrowUpDown } from 'lucide-react';
import type { Scheme, SchemeStatus } from '@/types/scheme';
import { getMockSchemes, getUniqueGroupNames, updateSchemeGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, calculateSchemeTotals, getSchemeStatus, getPaymentStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { BulkAssignGroupDialog } from '@/components/dialogs/BulkAssignGroupDialog';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { parseISO } from 'date-fns';

const statusPriorityMap: Record<SchemeStatus, number> = {
  'Overdue': 0,
  'Active': 1,
  'Upcoming': 2,
  'Fully Paid': 3,
  'Closed': 4,
};

type SortByType = 
  | 'customerNameAsc' 
  | 'customerNameDesc' 
  | 'startDateAsc' 
  | 'startDateDesc' 
  | 'statusPriority';

export default function SchemesPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SchemeStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortByType>('customerNameAsc');
  const { toast } = useToast();

  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);
  
  const [isBulkAssignMode, setIsBulkAssignMode] = useState(false);
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<number[]>([]); // Store numbers
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
    let schemes = allSchemes
      .filter(scheme =>
        statusFilter === 'all' || scheme.status === statusFilter
      )
      .filter(scheme =>
        scheme.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (scheme.customerGroupName && scheme.customerGroupName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        scheme.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) // Convert number to string for search
      );

    schemes.sort((a, b) => {
      switch (sortBy) {
        case 'customerNameAsc':
          return a.customerName.localeCompare(b.customerName);
        case 'customerNameDesc':
          return b.customerName.localeCompare(a.customerName);
        case 'startDateAsc': // Oldest first
          return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
        case 'startDateDesc': // Newest first
          return parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime();
        case 'statusPriority':
          return (statusPriorityMap[a.status] ?? 4) - (statusPriorityMap[b.status] ?? 4);
        default:
          return 0;
      }
    });
    return schemes;

  }, [allSchemes, searchTerm, statusFilter, sortBy]);

  const schemeStatusOptions: { value: SchemeStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Overdue', label: 'Overdue' },
    { value: 'Fully Paid', label: 'Fully Paid' },
    { value: 'Upcoming', label: 'Upcoming' },
    { value: 'Closed', label: 'Closed' },
  ];

  const sortOptions: { value: SortByType; label: string }[] = [
    { value: 'customerNameAsc', label: 'Customer Name (A-Z)' },
    { value: 'customerNameDesc', label: 'Customer Name (Z-A)' },
    { value: 'startDateDesc', label: 'Start Date (Newest First)' },
    { value: 'startDateAsc', label: 'Start Date (Oldest First)' },
    { value: 'statusPriority', label: 'Status Priority' },
  ];

  const handleToggleBulkAssignMode = () => {
    setIsBulkAssignMode(prev => !prev);
    setSelectedSchemeIds([]); 
  };

  const handleSelectAllSchemes = (checked: boolean) => {
    if (checked) {
      setSelectedSchemeIds(filteredSchemes.map(s => s.id));
    } else {
      setSelectedSchemeIds([]);
    }
  };

  const handleSchemeSelection = (schemeId: number, checked: boolean) => { // schemeId is number
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

    selectedSchemeIds.forEach(schemeId => { // schemeId is now a number
      const updated = updateSchemeGroup(schemeId, groupName); // updateSchemeGroup expects number
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
      <div className="flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <h1 className="text-4xl font-headline font-semibold text-foreground flex items-center">
            <ListChecks className="mr-3 h-10 w-10 text-primary" />
            Scheme Management
          </h1>
          <div className="flex gap-3">
            {!isBulkAssignMode && (
              <Button variant="outline" onClick={handleToggleBulkAssignMode} className="rounded-lg shadow-md hover:shadow-lg transition-shadow h-11 px-5 text-base">
                <Users2 className="mr-2 h-5 w-5" /> Bulk Assign Group
              </Button>
            )}
            <Link href="/schemes/new">
              <Button className="rounded-lg shadow-lg hover:shadow-xl transition-shadow h-11 px-5 text-base">
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Scheme
              </Button>
            </Link>
          </div>
        </motion.div>
        
        {isBulkAssignMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="rounded-xl shadow-lg bg-card/80 dark:bg-card/70 backdrop-blur-md border border-border/50">
              <CardHeader>
                <CardTitle className="text-xl font-headline text-foreground">Bulk Group Assignment Mode</CardTitle>
                <CardDescription>Select schemes from the table below to assign them to a group or remove them from their current group.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 items-center">
                 <Button 
                  onClick={() => setIsBulkAssignDialogOpen(true)} 
                  disabled={selectedSchemeIds.length === 0 || isProcessingBulkAssign}
                  className="rounded-lg h-10 px-5 text-base"
                >
                  {isProcessingBulkAssign ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Users2 className="mr-2 h-5 w-5" />}
                  Assign Group to {selectedSchemeIds.length} Selected
                </Button>
                <Button variant="ghost" onClick={handleToggleBulkAssignMode} className="text-muted-foreground rounded-lg h-10 px-5 text-base">
                  <XCircle className="mr-2 h-5 w-5" /> Cancel Bulk Mode
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Card className="rounded-xl shadow-xl overflow-hidden glassmorphism">
            <CardHeader className="p-6">
              <CardTitle className="text-2xl font-headline text-foreground">Scheme Overview ({filteredSchemes.length})</CardTitle>
              <CardDescription>Manage and track all customer schemes. Filter and sort the list as needed.</CardDescription>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <Input
                  placeholder="Filter by customer, group or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-lg text-base h-11"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as SchemeStatus | 'all');
                    setSelectedSchemeIds([]); 
                  }}
                >
                  <SelectTrigger className="rounded-lg text-base h-11">
                    <Filter className="mr-2 h-5 w-5 text-muted-foreground" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {schemeStatusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-base py-2">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as SortByType)}
                >
                  <SelectTrigger className="rounded-lg text-base h-11">
                    <ArrowUpDown className="mr-2 h-5 w-5 text-muted-foreground" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {sortOptions.map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-base py-2">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSchemes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 dark:bg-muted/20">
                        {isBulkAssignMode && (
                          <TableHead padding="checkbox" className="w-12 sticky left-0 bg-card z-10">
                            <Checkbox
                              className="h-5 w-5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                              checked={isAllFilteredSelected}
                              onCheckedChange={handleSelectAllSchemes}
                              aria-label="Select all filtered schemes"
                              disabled={filteredSchemes.length === 0}
                            />
                          </TableHead>
                        )}
                        <TableHead className={`text-base font-semibold ${isBulkAssignMode ? "pl-0" : ""}`}>Customer Name</TableHead>
                        <TableHead className="text-base font-semibold">Scheme ID</TableHead>
                        <TableHead className="text-base font-semibold">Group Name</TableHead>
                        <TableHead className="text-base font-semibold">Start Date</TableHead>
                        <TableHead className="text-base font-semibold">Monthly Amount</TableHead>
                        <TableHead className="text-base font-semibold text-center">Payments Made</TableHead>
                        <TableHead className="text-base font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchemes.map((scheme, index) => (
                        <motion.tr 
                          key={scheme.id} 
                          data-state={selectedSchemeIds.includes(scheme.id) ? 'selected' : ''}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors data-[state=selected]:bg-primary/10"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.3 }}
                        >
                           {isBulkAssignMode && (
                            <TableCell padding="checkbox" className="sticky left-0 bg-card data-[state=selected]:bg-primary/5 z-10">
                              <Checkbox
                                className="h-5 w-5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                checked={selectedSchemeIds.includes(scheme.id)}
                                onCheckedChange={(checked) => handleSchemeSelection(scheme.id, !!checked)} // Pass number
                                aria-label={`Select scheme ${scheme.id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className={`font-medium text-base ${isBulkAssignMode ? "pl-0" : ""}`}>
                            <Link href={`/schemes/${scheme.id}`} className="hover:underline text-primary">
                              {scheme.customerName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-base text-muted-foreground">{scheme.id}</TableCell>
                          <TableCell className="text-base text-muted-foreground">{scheme.customerGroupName || 'N/A'}</TableCell>
                          <TableCell className="text-base text-muted-foreground">{formatDate(scheme.startDate)}</TableCell>
                          <TableCell className="text-base font-semibold">{formatCurrency(scheme.monthlyPaymentAmount)}</TableCell>
                          <TableCell className="text-base text-center text-muted-foreground">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</TableCell>
                          <TableCell>
                            <SchemeStatusBadge status={scheme.status} />
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg mb-2">No schemes match your filters.</p>
                  {searchTerm === '' && statusFilter === 'all' && (
                    <Link href="/schemes/new" className="text-primary hover:underline text-base">
                        Click here to add your first scheme
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
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
    
