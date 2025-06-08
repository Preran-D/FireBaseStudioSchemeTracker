
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, Edit, DollarSign, FileCheck2, Loader2, XCircle, PieChart, Eye, CalendarIcon, Users2, PlusCircle, LineChartIcon, PackageCheck, ListFilter } from 'lucide-react';
import type { Scheme, Payment, PaymentMode, SchemeStatus } from '@/types/scheme';
import { getMockSchemeById, updateMockSchemePayment, closeMockScheme, getMockSchemes, getUniqueGroupNames, updateSchemeGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, Tooltip as RechartsTooltip, BarChart as RechartsBarChart } from "recharts"
import { isPast, parseISO, formatISO, startOfDay } from 'date-fns';
import { MonthlyCircularProgress } from '@/components/shared/MonthlyCircularProgress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AssignGroupDialog } from '@/components/dialogs/AssignGroupDialog';
import { Badge } from '@/components/ui/badge';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

interface SelectedPaymentContext extends Payment {
  schemeIdToUpdate: string;
}

export default function SchemeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const schemeIdFromUrl = params.id as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [allSchemesForThisCustomer, setAllSchemesForThisCustomer] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<SelectedPaymentContext | null>(null);
  
  const [isClosingSchemeProcess, setIsClosingSchemeProcess] = useState(false);
  const [isCloseSchemeAlertOpen, setIsCloseSchemeAlertOpen] = useState(false);
  const [closureDate, setClosureDate] = useState<Date | undefined>(new Date());
  const [closureType, setClosureType] = useState<'full_reconciliation' | 'partial_closure'>('full_reconciliation');
  const [closureModeOfPayment, setClosureModeOfPayment] = useState<PaymentMode[]>(['Cash']);
  const [schemeToCloseInDialog, setSchemeToCloseInDialog] = useState<Scheme | null>(null);

  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);
  const [isAssignGroupDialogOpen, setIsAssignGroupDialogOpen] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(schemeIdFromUrl);

  const loadSchemeData = useCallback(() => {
    if (schemeIdFromUrl) {
      setIsLoading(true);
      const fetchedScheme = getMockSchemeById(schemeIdFromUrl);
      if (fetchedScheme) {
        const totals = calculateSchemeTotals(fetchedScheme);
        fetchedScheme.payments.forEach(p => p.status = getPaymentStatus(p, fetchedScheme.startDate));
        const status = getSchemeStatus(fetchedScheme); 
        setScheme({ ...fetchedScheme, ...totals, status });
        setActiveAccordionItem(fetchedScheme.id); 

        const allCustomerSchemes = getMockSchemes()
          .filter(s => s.customerName === fetchedScheme.customerName)
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
  
  const openClosureDialogForSpecificScheme = (targetScheme: Scheme) => {
    if (targetScheme.status === 'Completed') return;
    setSchemeToCloseInDialog(targetScheme);
    setClosureDate(targetScheme.closureDate ? parseISO(targetScheme.closureDate) : startOfDay(new Date()));
    setClosureType('full_reconciliation'); 
    setClosureModeOfPayment(['Cash']); 
    setIsCloseSchemeAlertOpen(true);
  };

  const handleConfirmCloseScheme = () => {
    if(!schemeToCloseInDialog || !closureDate) return;
    if(closureType === 'full_reconciliation' && closureModeOfPayment.length === 0) {
        toast({ title: 'Mode of Payment Required', description: 'Please select at least one mode of payment for full reconciliation.', variant: 'destructive' });
        return;
    }
    setIsClosingSchemeProcess(true);

    const closureOptions = {
        closureDate: formatISO(closureDate),
        type: closureType,
        modeOfPayment: closureType === 'full_reconciliation' ? closureModeOfPayment : undefined,
    };

    const closedSchemeResult = closeMockScheme(schemeToCloseInDialog.id, closureOptions);

    if(closedSchemeResult) {
      setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === closedSchemeResult.id ? closedSchemeResult : s));
      if(scheme && scheme.id === closedSchemeResult.id) { 
        setScheme(closedSchemeResult);
      }
      if (activeAccordionItem === closedSchemeResult.id) {
        setActiveAccordionItem(closedSchemeResult.id); 
      }
      toast({ title: 'Scheme Closed', description: `${closedSchemeResult.customerName}'s scheme (ID: ${closedSchemeResult.id.toUpperCase()}) has been updated.` });
    } else {
       toast({ title: 'Error', description: 'Failed to close scheme.', variant: 'destructive' });
    }
    setIsCloseSchemeAlertOpen(false);
    setIsClosingSchemeProcess(false);
    setSchemeToCloseInDialog(null);
  }

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
    const completedSchemesCount = allSchemesForThisCustomer.filter(s => s.status === 'Completed').length;
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
    if (currentScheme.status === 'Completed' || payment.status === 'Paid') {
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

  if (isLoading || !scheme) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div key={schemeIdFromUrl} className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="font-headline text-2xl mb-1">{scheme.customerName}</CardTitle>
            <CardDescription>
              ID: {scheme.id.toUpperCase()}<br/>
              Phone: {scheme.customerPhone || 'N/A'}<br/>
              Address: {scheme.customerAddress || 'N/A'}<br/>
              {scheme.customerGroupName && (<>Group: <Link href={`/groups/${encodeURIComponent(scheme.customerGroupName)}`} className="text-primary hover:underline">{scheme.customerGroupName}</Link><br/></>)}
              {scheme.status === 'Completed' && scheme.closureDate && (<>Closed on: {formatDate(scheme.closureDate)}</>)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-wrap">
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
              disabled={isClosingSchemeProcess || isCloseSchemeAlertOpen || isUpdatingGroup}
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
                            {s.status === 'Completed' ? (
                            <div className="text-sm">
                                <p className="font-semibold">Scheme Completed</p>
                                {s.closureDate && <p>Closed on: {formatDate(s.closureDate)}</p>}
                                <p>Total Collected: {formatCurrency(s.totalCollected || 0)}</p>
                            </div>
                            ) : (
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
                                                (getPaymentStatus(payment, s.startDate) === 'Paid' || s.status === 'Completed') && <CheckCircle className="h-5 w-5 text-green-500 inline-block" />
                                            )}
                                            </TableCell>
                                        </TableRow>
                                        ))}
                                    </TableBody>
                                    </Table>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <Button 
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => openClosureDialogForSpecificScheme(s)}
                                      disabled={isClosingSchemeProcess || isCloseSchemeAlertOpen || isUpdatingGroup || s.status === 'Completed'}
                                    >
                                      <FileCheck2 className="mr-2 h-4 w-4" /> Close This Scheme
                                    </Button>
                                </div>
                            </>
                            )}
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
            <div className="p-3 border rounded-md bg-muted/30"><strong>Completed:</strong> {customerSummaryStats.completedSchemesCount}</div>
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
                {schemeForVisuals.status === 'Completed' && (
                    <div className="mt-6">
                        <h3 className="font-semibold mb-2 text-lg">Scheme Completion Summary</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                            <div className="flex items-center gap-3">
                                <PackageCheck className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <p className="text-lg font-semibold text-green-700 dark:text-green-400">Successfully Completed</p>
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
                        {schemeForVisuals.closureDate && <p className="mt-2 text-sm">This scheme was closed on <strong>{formatDate(schemeForVisuals.closureDate)}</strong>.</p>}
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      {isCloseSchemeAlertOpen && schemeToCloseInDialog && (
        <AlertDialog open={isCloseSchemeAlertOpen} onOpenChange={(open) => {
            if (!open) {
                setIsCloseSchemeAlertOpen(false);
                if (!isClosingSchemeProcess) { 
                    setSchemeToCloseInDialog(null);
                }
            }
        }}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Scheme Closure for {schemeToCloseInDialog.customerName}</AlertDialogTitle>
               <AlertDialogDescription>Scheme ID: {schemeToCloseInDialog.id.toUpperCase()}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
                <div>
                    <Label htmlFor="closure-type">Closure Type</Label>
                    <RadioGroup
                        id="closure-type"
                        value={closureType}
                        onValueChange={(value: 'full_reconciliation' | 'partial_closure') => setClosureType(value)}
                        className="mt-1 space-y-1"
                        disabled={isClosingSchemeProcess}
                    >
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full_reconciliation" id="full_reconciliation" />
                        <Label htmlFor="full_reconciliation" className="font-normal">Reconcile & Close (Mark pending as paid)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="partial_closure" id="partial_closure" />
                        <Label htmlFor="partial_closure" className="font-normal">Close Partially (Leave pending as is)</Label>
                        </div>
                    </RadioGroup>
                </div>

                {closureType === 'full_reconciliation' && (
                    <div className="space-y-2 rounded-md border p-3">
                        <Label>Mode of Payment (for reconciled payments)</Label>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {paymentModes.filter(m => m !== 'System Closure').map((mode) => (
                            <div key={mode} className="flex items-center space-x-2">
                            <Checkbox
                                id={`closure-mop-${mode}`}
                                checked={closureModeOfPayment.includes(mode)}
                                onCheckedChange={(checked) => {
                                setClosureModeOfPayment(prev => 
                                    checked ? [...prev, mode] : prev.filter(m => m !== mode)
                                );
                                }}
                                disabled={isClosingSchemeProcess}
                            />
                            <Label htmlFor={`closure-mop-${mode}`} className="font-normal">{mode}</Label>
                            </div>
                        ))}
                        </div>
                        {closureModeOfPayment.length === 0 && <p className="text-xs text-destructive">Please select at least one payment mode for reconciliation.</p>}
                    </div>
                )}
              
                <div>
                    <Label htmlFor="closure-date">Closure Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="closure-date"
                            variant={'outline'}
                            className={cn('w-full justify-start text-left font-normal mt-1', !closureDate && 'text-muted-foreground')}
                            disabled={isClosingSchemeProcess}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {closureDate ? formatDate(closureDate.toISOString()) : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={closureDate}
                            onSelect={setClosureDate}
                            disabled={(date) => date > new Date() || (schemeToCloseInDialog?.startDate ? date < parseISO(schemeToCloseInDialog.startDate) : false) }
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                 <AlertDialogDescription className="text-xs pt-2">
                    {closureType === 'full_reconciliation' 
                        ? "All pending payments will be marked as fully paid as of the selected closure date using the chosen mode(s). "
                        : "The scheme will be marked 'Completed', but pending payments will remain as they are. "
                    }
                    This action cannot be easily undone.
                </AlertDialogDescription>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsCloseSchemeAlertOpen(false); setSchemeToCloseInDialog(null);}} disabled={isClosingSchemeProcess}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmCloseScheme} 
                disabled={isClosingSchemeProcess || !closureDate || (closureType === 'full_reconciliation' && closureModeOfPayment.length === 0)}
              >
                {isClosingSchemeProcess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Closure
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
    </div>
  );
}
