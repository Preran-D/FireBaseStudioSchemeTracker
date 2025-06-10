
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, Edit, DollarSign, Loader2, XCircle, PieChart, Eye, CalendarIcon, Users2, PlusCircle, LineChartIcon, PackageCheck, ListFilter, Pencil, ArrowLeft, FileWarning, CreditCard } from 'lucide-react';
import type { Scheme, Payment, PaymentMode, SchemeStatus } from '@/types/scheme';
import { getMockSchemeById, updateMockSchemePayment, closeMockScheme, getMockSchemes, getUniqueGroupNames, updateSchemeGroup, updateMockCustomerDetails } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, Tooltip as RechartsTooltip, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, formatISO, startOfDay } from 'date-fns';
import { MonthlyCircularProgress } from '@/components/shared/MonthlyCircularProgress';
import { Label } from '@/components/ui/label'; // Removed Popover, PopoverTrigger, PopoverContent, Calendar
// Removed RadioGroup, RadioGroupItem, Checkbox from this import as they are not directly used in the file-level scope for new dialog
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AssignGroupDialog } from '@/components/dialogs/AssignGroupDialog';
import { EditCustomerDetailsDialog, type EditCustomerDetailsFormValues } from '@/components/dialogs/EditCustomerDetailsDialog';
import { Badge } from '@/components/ui/badge';
// Removed FormItem for AlertDialog usage

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI', 'System Closure'];

interface SelectedPaymentContext extends Payment {
  schemeIdToUpdate: string;
}

export default function SchemeDetailsPage() {
  const router = useRouter();
  const urlParams = useParams();
  const { toast } = useToast();
  const schemeIdFromUrl = urlParams.id as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [allSchemesForThisCustomer, setAllSchemesForThisCustomer] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<SelectedPaymentContext | null>(null);
  
  // Removed state for "Settle & Close" (isCloseSchemeAlertOpen, schemeToCloseInDialog, closureDate, closureType, closureModeOfPayment)

  const [isManualCloseDialogOpen, setIsManualCloseDialogOpen] = useState(false);
  const [schemeForManualCloseDialog, setSchemeForManualCloseDialog] = useState<Scheme | null>(null);
  const [manualClosureDate, setManualClosureDate] = useState<Date | undefined>(new Date());
  const [isProcessingManualClose, setIsProcessingManualClose] = useState(false);


  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);
  const [isAssignGroupDialogOpen, setIsAssignGroupDialogOpen] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(schemeIdFromUrl);

  const [isEditCustomerDetailsDialogOpen, setIsEditCustomerDetailsDialogOpen] = useState(false);
  const [isUpdatingCustomerDetails, setIsUpdatingCustomerDetails] = useState(false);

  const loadSchemeData = useCallback((currentCustomerName?: string) => {
    if (schemeIdFromUrl) {
      setIsLoading(true);
      const fetchedScheme = getMockSchemeById(schemeIdFromUrl);
      if (fetchedScheme) {
        const customerNameToFilterBy = currentCustomerName || fetchedScheme.customerName;

        const totals = calculateSchemeTotals(fetchedScheme);
        fetchedScheme.payments.forEach(p => p.status = getPaymentStatus(p, fetchedScheme.startDate));
        const status = getSchemeStatus(fetchedScheme); 
        setScheme({ ...fetchedScheme, ...totals, status });
        setActiveAccordionItem(fetchedScheme.id); 

        const allCustomerSchemes = getMockSchemes()
          .filter(s => s.customerName === customerNameToFilterBy)
          .map(s => {
            const sTotals = calculateSchemeTotals(s);
            s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
            const sStatus = getSchemeStatus(s);
            return { ...s, ...sTotals, status: sStatus };
          })
          .sort((a,b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()); 
        setAllSchemesForThisCustomer(allCustomerSchemes);
      }
      setExistingGroupNames(getUniqueGroupNames());
      setIsLoading(false);
    }
  }, [schemeIdFromUrl]);

  useEffect(() => {
    loadSchemeData();
  }, [loadSchemeData]);

  const handleRecordPayment = (data: { paymentDate: string; amountPaid: number; modeOfPayment: PaymentMode[] }) => {
    if (!selectedPaymentForRecord) return;

    setIsRecordingPayment(true);
    const updatedSchemeFromMock = updateMockSchemePayment(selectedPaymentForRecord.schemeIdToUpdate, selectedPaymentForRecord.id, data);
    
    if (updatedSchemeFromMock) {
       setAllSchemesForThisCustomer(prevAll => 
        prevAll.map(s => s.id === updatedSchemeFromMock.id ? updatedSchemeFromMock : s)
      );
      if (scheme && scheme.id === updatedSchemeFromMock.id) {
        setScheme(updatedSchemeFromMock);
      }
      if (activeAccordionItem === updatedSchemeFromMock.id) {
        setActiveAccordionItem(updatedSchemeFromMock.id); 
      }
      toast({ title: 'Payment Recorded', description: `Payment for month ${selectedPaymentForRecord.monthNumber} of scheme ${selectedPaymentForRecord.schemeIdToUpdate.toUpperCase()} recorded.` });
    } else {
      toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
    }
    setSelectedPaymentForRecord(null);
    setIsRecordingPayment(false);
  };
  
  // Removed openSettleAndCloseDialog and handleConfirmSettleAndClose functions

  const openManualCloseDialog = (targetScheme: Scheme) => {
    if (targetScheme.status === 'Closed') return;
    setSchemeForManualCloseDialog(targetScheme);
    setManualClosureDate(startOfDay(new Date()));
    setIsManualCloseDialogOpen(true);
  };

  const handleConfirmManualCloseScheme = () => {
    if (!schemeForManualCloseDialog || !manualClosureDate) return;
    setIsProcessingManualClose(true);

    const closureOptions = {
      closureDate: formatISO(manualClosureDate),
      type: 'partial_closure' as 'partial_closure', 
    };

    const closedSchemeResult = closeMockScheme(schemeForManualCloseDialog.id, closureOptions);
    if (closedSchemeResult) {
      setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === closedSchemeResult.id ? closedSchemeResult : s));
      if (scheme && scheme.id === closedSchemeResult.id) {
        setScheme(closedSchemeResult);
      }
      if (activeAccordionItem === closedSchemeResult.id) {
        setActiveAccordionItem(closedSchemeResult.id);
      }
      toast({ title: 'Scheme Manually Closed', description: `${closedSchemeResult.customerName}'s scheme (ID: ${closedSchemeResult.id.toUpperCase()}) has been marked as 'Closed'.` });
    } else {
      toast({ title: 'Error', description: 'Failed to manually close scheme.', variant: 'destructive' });
    }
    setIsManualCloseDialogOpen(false);
    setIsProcessingManualClose(false);
    setSchemeForManualCloseDialog(null);
  };


  const handleAssignGroupSubmit = (updatedSchemeId: string, groupName?: string) => {
    setIsUpdatingGroup(true);
    const updatedSchemeFromMock = updateSchemeGroup(updatedSchemeId, groupName);
    if (updatedSchemeFromMock) {
      setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === updatedSchemeFromMock.id ? updatedSchemeFromMock : s));
      if (scheme && updatedSchemeFromMock.id === scheme.id) {
        setScheme(updatedSchemeFromMock);
      }
      toast({
        title: "Group Updated",
        description: `Scheme for ${updatedSchemeFromMock.customerName} has been ${groupName ? `assigned to group "${groupName}"` : 'removed from group'}.`,
      });
    } else {
      toast({ title: "Error", description: "Failed to update scheme group.", variant: "destructive" });
    }
    setIsAssignGroupDialogOpen(false);
    setIsUpdatingGroup(false);
  };
  
  const handleEditCustomerDetailsSubmit = (
    originalName: string,
    newDetails: EditCustomerDetailsFormValues
  ) => {
    setIsUpdatingCustomerDetails(true);
    const result = updateMockCustomerDetails(originalName, newDetails);

    if (result.success) {
      toast({
        title: 'Customer Details Updated',
        description: `Details for ${newDetails.customerName} have been updated.`,
      });
      if (newDetails.customerName !== originalName && scheme && scheme.id === schemeIdFromUrl) {
        loadSchemeData(newDetails.customerName); 
      } else {
        loadSchemeData(scheme?.customerName); 
      }
    } else {
      toast({
        title: 'Error',
        description: result.message || 'Failed to update customer details.',
        variant: 'destructive',
      });
    }
    setIsEditCustomerDetailsDialogOpen(false);
    setIsUpdatingCustomerDetails(false);
  };


  const customerSummaryStats = useMemo(() => {
    if (!allSchemesForThisCustomer.length) {
      return {
        totalSchemesCount: 0,
        activeOverdueSchemesCount: 0,
        completedSchemesCount: 0,
        aggregateTotalCollected: 0,
        aggregateTotalRemaining: 0,
      };
    }
    const totalSchemesCount = allSchemesForThisCustomer.length;
    const activeOverdueSchemesCount = allSchemesForThisCustomer.filter(s => s.status === 'Active' || s.status === 'Overdue').length;
    const completedSchemesCount = allSchemesForThisCustomer.filter(s => s.status === 'Completed' || s.status === 'Closed').length;
    const aggregateTotalCollected = allSchemesForThisCustomer.reduce((sum, s) => sum + (s.totalCollected || 0), 0);
    const aggregateTotalRemaining = allSchemesForThisCustomer
      .filter(s => s.status === 'Active' || s.status === 'Overdue')
      .reduce((sum, s) => sum + (s.totalRemaining || 0), 0);

    return {
      totalSchemesCount,
      activeOverdueSchemesCount,
      completedSchemesCount,
      aggregateTotalCollected,
      aggregateTotalRemaining,
    };
  }, [allSchemesForThisCustomer]);
  
  const schemeForVisuals = useMemo(() => {
    return allSchemesForThisCustomer.find(s => s.id === activeAccordionItem) || scheme;
  }, [activeAccordionItem, allSchemesForThisCustomer, scheme]);


  const paymentChartData = useMemo(() => {
    if (!schemeForVisuals) return [];
    return schemeForVisuals.payments.map(p => ({
      month: `M${p.monthNumber}`,
      expected: p.amountExpected,
      paid: p.amountPaid || 0,
    }));
  }, [schemeForVisuals]);

  const cumulativePaymentData = useMemo(() => {
    if (!schemeForVisuals) return [];
    let cumulativePaid = 0;
    let cumulativeExpected = 0;
    return schemeForVisuals.payments.map(p => {
      cumulativePaid += (p.amountPaid || 0);
      cumulativeExpected += p.amountExpected;
      return {
        month: `M${p.monthNumber}`,
        cumulativePaid,
        cumulativeExpected,
      };
    });
  }, [schemeForVisuals]);

  const chartConfig = {
    paid: { label: "Paid", color: "hsl(var(--chart-2))" },
    expected: { label: "Expected", color: "hsl(var(--chart-4))" },
    cumulativePaid: { label: "Cumulative Paid", color: "hsl(var(--chart-1))" },
    cumulativeExpected: { label: "Cumulative Expected", color: "hsl(var(--chart-5))" },
  }

  const isPaymentRecordable = (payment: Payment, currentScheme: Scheme): boolean => {
    if (currentScheme.status === 'Completed' || currentScheme.status === 'Closed' || payment.status === 'Paid') {
      return false;
    }
    const schemeToCheck = allSchemesForThisCustomer.find(s => s.id === currentScheme.id) || currentScheme;

    for (let i = 0; i < payment.monthNumber - 1; i++) {
      if (getPaymentStatus(schemeToCheck.payments[i], schemeToCheck.startDate) !== 'Paid') {
        return false;
      }
    }
    return true;
  };

  const nextRecordablePaymentForActiveScheme = useMemo(() => {
    if (!schemeForVisuals) return null;
    return schemeForVisuals.payments.find(p => isPaymentRecordable(p, schemeForVisuals));
  }, [schemeForVisuals, allSchemesForThisCustomer]); // Added allSchemes to dependency for isPaymentRecordable
  
  const handleAddNewSchemeForCustomer = () => {
    if (!scheme) return;
    const queryParams = new URLSearchParams();
    queryParams.append('customerName', scheme.customerName);
    if(scheme.customerPhone) queryParams.append('customerPhone', scheme.customerPhone);
    if(scheme.customerAddress) queryParams.append('customerAddress', scheme.customerAddress);
    if (scheme.customerGroupName) {
      queryParams.append('customerGroupName', scheme.customerGroupName);
    }
    queryParams.append('monthlyPaymentAmount', scheme.monthlyPaymentAmount.toString());
    router.push(`/schemes/new?${queryParams.toString()}`);
  };

  const handleRecordPaymentForActiveScheme = () => {
    if (nextRecordablePaymentForActiveScheme && schemeForVisuals) {
      setSelectedPaymentForRecord({
        ...nextRecordablePaymentForActiveScheme,
        schemeIdToUpdate: schemeForVisuals.id,
      });
      // The Dialog with RecordPaymentForm will open due to selectedPaymentForRecord being set
    } else {
      toast({ title: "No Payment Due", description: "No recordable payment found for the active scheme.", variant: "default"});
    }
  };


  if (isLoading || !scheme) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div key={schemeIdFromUrl} className="flex flex-col gap-6">
      <div className="mb-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/schemes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to All Schemes
        </Button>
      </div>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="font-headline text-2xl mb-1">{scheme.customerName}</CardTitle>
            <CardDescription>
              ID: {scheme.id.toUpperCase()}<br/>
              Phone: {scheme.customerPhone || 'N/A'}<br/>
              Address: {scheme.customerAddress || 'N/A'}<br/>
              {scheme.customerGroupName && (<>Group: <Link href={`/groups/${encodeURIComponent(scheme.customerGroupName)}`} className="text-primary hover:underline">{scheme.customerGroupName}</Link><br/></>)}
              {scheme.status === 'Closed' && scheme.closureDate && (<>Manually Closed on: {formatDate(scheme.closureDate)}</>)}
              {scheme.status === 'Completed' && scheme.payments.every(p => p.status === 'Paid') && !scheme.closureDate && (<>Completed on: {formatDate(scheme.payments[scheme.payments.length-1].paymentDate!)} (All payments made)</>)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-wrap">
            <Dialog onOpenChange={(open) => !open && setSelectedPaymentForRecord(null)}>
                 <DialogTrigger asChild>
                    <Button 
                        onClick={handleRecordPaymentForActiveScheme}
                        variant="default" 
                        size="sm"
                        disabled={!nextRecordablePaymentForActiveScheme || isRecordingPayment}
                    >
                        <CreditCard className="mr-2 h-4 w-4" /> Record Payment for Active Scheme
                    </Button>
                 </DialogTrigger>
                 {selectedPaymentForRecord && schemeForVisuals && selectedPaymentForRecord.schemeIdToUpdate === schemeForVisuals.id && (
                    <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-headline">Record Payment for {schemeForVisuals.customerName}</DialogTitle>
                        <CardDescription>Scheme ID: {schemeForVisuals.id.toUpperCase()} (Month {selectedPaymentForRecord.monthNumber})</CardDescription>
                    </DialogHeader>
                    <RecordPaymentForm
                        payment={selectedPaymentForRecord}
                        onSubmit={handleRecordPayment}
                        isLoading={isRecordingPayment}
                    />
                    </DialogContent>
                )}
            </Dialog>
            <Button
              onClick={() => setIsEditCustomerDetailsDialogOpen(true)}
              variant="outline"
              size="sm"
              disabled={isUpdatingGroup || isUpdatingCustomerDetails || isProcessingManualClose}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit Details
            </Button>
             <Button 
                onClick={handleAddNewSchemeForCustomer}
                variant="outline" 
                size="sm"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Scheme for {scheme.customerName.split(' ')[0]}
            </Button>
            <Button 
              onClick={() => setIsAssignGroupDialogOpen(true)} 
              variant="outline"
              size="sm"
              disabled={isUpdatingGroup || isUpdatingCustomerDetails || isProcessingManualClose}
            >
              <Users2 className="mr-2 h-4 w-4" /> Manage Group
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline">All Schemes Enrolled by {scheme.customerName}</CardTitle>
            <CardDescription>View and manage payment schedules for all schemes associated with this customer.</CardDescription>
        </CardHeader>
        <CardContent>
            {allSchemesForThisCustomer.length > 0 ? (
                <Accordion 
                    type="single" 
                    collapsible 
                    className="w-full space-y-3" 
                    value={activeAccordionItem} 
                    onValueChange={setActiveAccordionItem}
                >
                {allSchemesForThisCustomer.map((s) => (
                    <AccordionItem value={s.id} key={s.id} id={s.id + "-accordion"} className="border rounded-md overflow-hidden hover:shadow-md transition-shadow bg-card">
                    <AccordionTrigger className="p-4 hover:bg-muted/50 data-[state=open]:bg-muted/30">
                        <div className="flex justify-between items-center w-full">
                        <div className="flex flex-col text-left sm:flex-row sm:items-center gap-x-3 gap-y-1">
                            <span className="font-medium">ID: {s.id.toUpperCase()}</span>
                            <SchemeStatusBadge status={s.status} />
                            {s.status === 'Completed' && !s.closureDate && <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">All Payments Made</Badge>}
                            {s.id === activeAccordionItem && <Badge variant="outline" className="text-xs h-5 border-primary text-primary">Currently Viewing</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                            <span>Started: {formatDate(s.startDate)}</span><br/>
                            <span>Monthly: {formatCurrency(s.monthlyPaymentAmount)}</span>
                        </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                        <div className="border-t p-4 space-y-4">
                            <p className="text-sm font-semibold mb-2">Details for Scheme {s.id.toUpperCase()}</p>
                            {s.status === 'Closed' || (s.status === 'Completed' && s.payments.every(p => p.status === 'Paid')) ? (
                            <div className="text-sm">
                                <p className="font-semibold">
                                  {s.status === 'Closed' ? 'Scheme Manually Closed' : 'Scheme Completed (All Payments Made)'}
                                </p>
                                {s.closureDate && <p>Closed on: {formatDate(s.closureDate)}</p>}
                                {!s.closureDate && s.status === 'Completed' && s.payments.every(p => p.status === 'Paid') && s.payments[s.payments.length-1].paymentDate &&
                                  <p>Final payment on: {formatDate(s.payments[s.payments.length-1].paymentDate!)}</p>
                                }
                                <p>Total Collected: {formatCurrency(s.totalCollected || 0)}</p>
                            </div>
                            ) : null}

                            {(s.status !== 'Closed' && s.status !== 'Completed') || (s.status === 'Completed' && !s.payments.every(p => p.status === 'Paid')) ? (
                            <>
                                <div className="overflow-x-auto">
                                    <Table>
                                    <TableHeader>
                                        <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Expected</TableHead>
                                        <TableHead>Paid Amount</TableHead>
                                        <TableHead>Payment Date</TableHead>
                                        <TableHead>Mode(s)</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {s.payments.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell>{payment.monthNumber}</TableCell>
                                            <TableCell>{formatDate(payment.dueDate)}</TableCell>
                                            <TableCell>{formatCurrency(payment.amountExpected)}</TableCell>
                                            <TableCell>{formatCurrency(payment.amountPaid)}</TableCell>
                                            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                            <TableCell>{payment.modeOfPayment?.join(' | ') || '-'}</TableCell>
                                            <TableCell><PaymentStatusBadge status={getPaymentStatus(payment, s.startDate)} /></TableCell>
                                            <TableCell className="text-right">
                                            {isPaymentRecordable(payment, s) ? (
                                                <Dialog onOpenChange={(open) => !open && setSelectedPaymentForRecord(null)}>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedPaymentForRecord({...payment, schemeIdToUpdate: s.id })}>
                                                    <DollarSign className="mr-1 h-4 w-4" /> Record
                                                    </Button>
                                                </DialogTrigger>
                                                {selectedPaymentForRecord && selectedPaymentForRecord.id === payment.id && selectedPaymentForRecord.schemeIdToUpdate === s.id && (
                                                    <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle className="font-headline">Record Payment for {s.customerName}</DialogTitle>
                                                        <CardDescription>Scheme ID: {s.id.toUpperCase()} (Month {selectedPaymentForRecord.monthNumber})</CardDescription>
                                                    </DialogHeader>
                                                    <RecordPaymentForm
                                                        payment={selectedPaymentForRecord}
                                                        onSubmit={handleRecordPayment}
                                                        isLoading={isRecordingPayment}
                                                    />
                                                    </DialogContent>
                                                )}
                                                </Dialog>
                                            ) : (
                                                (getPaymentStatus(payment, s.startDate) === 'Paid') && <CheckCircle className="h-5 w-5 text-green-500 inline-block" />
                                            )}
                                            </TableCell>
                                        </TableRow>
                                        ))}
                                    </TableBody>
                                    </Table>
                                </div>
                            </>
                            ): null }

                            <div className="flex justify-end items-center mt-4 space-x-2">
                                {/* Removed Settle & Close (Full Payment) button */}
                                <Button 
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => openManualCloseDialog(s)}
                                    disabled={s.status === 'Closed' || isUpdatingGroup || isProcessingManualClose}
                                >
                                    <FileWarning className="mr-2 h-4 w-4" /> Close Manually
                                </Button>
                            </div>
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            ) : (
                <p className="text-center text-muted-foreground py-4">No schemes found for this customer.</p>
            )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><ListFilter className="h-5 w-5 text-primary" />Overall Customer Summary for {scheme.customerName}</CardTitle>
            <CardDescription>Aggregate financial overview across all enrolled schemes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 border rounded-md bg-muted/30"><strong>Total Schemes:</strong> {customerSummaryStats.totalSchemesCount}</div>
            <div className="p-3 border rounded-md bg-muted/30"><strong>Active/Overdue:</strong> {customerSummaryStats.activeOverdueSchemesCount}</div>
            <div className="p-3 border rounded-md bg-muted/30"><strong>Completed/Closed:</strong> {customerSummaryStats.completedSchemesCount}</div>
            <div className="p-3 border rounded-md bg-muted/30"><strong>Total Collected (All Schemes):</strong> {formatCurrency(customerSummaryStats.aggregateTotalCollected)}</div>
            <div className="p-3 border rounded-md bg-muted/30"><strong>Total Remaining (Active/Overdue):</strong> {formatCurrency(customerSummaryStats.aggregateTotalRemaining)}</div>
        </CardContent>
      </Card>
      
      {schemeForVisuals && (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2"><LineChartIcon className="h-5 w-5 text-primary" />Visuals for Scheme ID: {schemeForVisuals.id.toUpperCase()}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                    <Card className="flex flex-col shadow-none border">
                        <CardHeader>
                            <CardTitle className="font-headline text-base">Monthly Progress</CardTitle>
                            <CardDescription className="text-xs">Visual breakdown of payments for the selected scheme.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow flex items-center justify-center p-2 sm:p-4">
                            <MonthlyCircularProgress 
                            payments={schemeForVisuals.payments} 
                            startDate={schemeForVisuals.startDate}
                            durationMonths={schemeForVisuals.durationMonths}
                            />
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border">
                    <CardHeader>
                        <CardTitle className="font-headline text-base">Payment Trends</CardTitle>
                        <CardDescription className="text-xs">Expected vs. Paid amounts over time for the selected scheme.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-2 sm:p-4">
                        <div>
                        <h3 className="text-sm font-semibold mb-1">Monthly Payments</h3>
                        <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] w-full">
                            <ResponsiveContainer>
                            <RechartsBarChart data={paymentChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" fontSize={10} />
                                <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹', '')} fontSize={10} width={70} />
                                <RechartsTooltip content={<ChartTooltipContent />} formatter={(value) => formatCurrency(Number(value))}/>
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="expected" fill="var(--color-expected)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="paid" fill="var(--color-paid)" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                        </div>
                        <div>
                        <h3 className="text-sm font-semibold mb-1">Cumulative Payments</h3>
                        <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] w-full">
                            <ResponsiveContainer>
                            <LineChart data={cumulativePaymentData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" fontSize={10} />
                                <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹', '')} fontSize={10} width={70} />
                                <RechartsTooltip content={<ChartTooltipContent />} formatter={(value) => formatCurrency(Number(value))}/>
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="monotone" dataKey="cumulativeExpected" stroke="var(--color-cumulativeExpected)" strokeWidth={2} dot={false}/>
                                <Line type="monotone" dataKey="cumulativePaid" stroke="var(--color-cumulativePaid)" strokeWidth={2} />
                            </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                        </div>
                    </CardContent>
                    </Card>
                </div>
                {(schemeForVisuals.status === 'Completed' || schemeForVisuals.status === 'Closed') && (
                    <div className="mt-6">
                        <h3 className="font-semibold mb-2 text-lg">Scheme {schemeForVisuals.status} Summary</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                            <div className="flex items-center gap-3">
                                <PackageCheck className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                                        {schemeForVisuals.status === 'Closed' ? 'Manually Closed' : 'Successfully Completed'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Amount Paid</p>
                                    <p className="text-lg font-semibold text-green-700 dark:text-green-400">{formatCurrency(schemeForVisuals.totalCollected || 0)}</p>
                                </div>
                            </div>
                        </div>
                        {schemeForVisuals.closureDate && <p className="mt-2 text-sm">This scheme was marked closed on <strong>{formatDate(schemeForVisuals.closureDate)}</strong>.</p>}
                         {!schemeForVisuals.closureDate && schemeForVisuals.status === 'Completed' && schemeForVisuals.payments.every(p=>p.status === 'Paid') &&
                           <p className="mt-2 text-sm">All payments for this scheme were completed on <strong>{formatDate(schemeForVisuals.payments[schemeForVisuals.payments.length - 1].paymentDate!)}</strong>.</p>
                        }
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      {/* Dialog for Settle & Close (Full Payment) - REMOVED */}
      
      {/* Dialog for Manual Close */}
      {isManualCloseDialogOpen && schemeForManualCloseDialog && (
        <AlertDialog open={isManualCloseDialogOpen} onOpenChange={(open) => {
            if (!open) {
                setIsManualCloseDialogOpen(false);
                if (!isProcessingManualClose) {
                    setSchemeForManualCloseDialog(null);
                }
            }
        }}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Manually Close Scheme: {schemeForManualCloseDialog.customerName}</AlertDialogTitle>
              <AlertDialogDescription>Scheme ID: {schemeForManualCloseDialog.id.toUpperCase()}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
                <div>
                    <Label htmlFor="manual-closure-date">Closure Date</Label>
                    <Dialog> {/* Using Dialog to wrap Popover for better styling/focus control in AlertDialog */}
                        <DialogTrigger asChild>
                             <Button
                                id="manual-closure-date"
                                variant={'outline'}
                                className={cn('w-full justify-start text-left font-normal mt-1', !manualClosureDate && 'text-muted-foreground')}
                                disabled={isProcessingManualClose}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {manualClosureDate ? formatDate(manualClosureDate.toISOString()) : <span>Pick a date</span>}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-auto p-0"> {/* PopoverContent becomes DialogContent */}
                             <Calendar
                                mode="single"
                                selected={manualClosureDate}
                                onSelect={(date) => {
                                    setManualClosureDate(date);
                                    // Consider closing the popover-like dialog here if needed
                                }}
                                disabled={(date) => date > new Date() || (schemeForManualCloseDialog?.startDate ? date < parseISO(schemeForManualCloseDialog.startDate) : false) }
                                initialFocus
                            />
                        </DialogContent>
                    </Dialog>
                </div>
                 <AlertDialogDescription className="text-xs pt-2">
                    This action will mark the scheme as 'Closed' on the selected date. 
                    Any pending payments will remain as they are. This is an administrative closure.
                </AlertDialogDescription>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsManualCloseDialogOpen(false); setSchemeForManualCloseDialog(null);}} disabled={isProcessingManualClose}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmManualCloseScheme} 
                disabled={isProcessingManualClose || !manualClosureDate}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isProcessingManualClose ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Manual Closure
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {scheme && isAssignGroupDialogOpen && (
        <AssignGroupDialog
          isOpen={isAssignGroupDialogOpen}
          onClose={() => setIsAssignGroupDialogOpen(false)}
          scheme={scheme}
          existingGroupNames={existingGroupNames}
          onSubmit={handleAssignGroupSubmit}
          isLoading={isUpdatingGroup}
        />
      )}
      {scheme && isEditCustomerDetailsDialogOpen && (
        <EditCustomerDetailsDialog
          isOpen={isEditCustomerDetailsDialogOpen}
          onClose={() => setIsEditCustomerDetailsDialogOpen(false)}
          originalCustomerName={scheme.customerName}
          currentPhone={scheme.customerPhone}
          currentAddress={scheme.customerAddress}
          onSubmit={handleEditCustomerDetailsSubmit}
          isLoading={isUpdatingCustomerDetails}
        />
      )}
    </div>
  );
}
    
