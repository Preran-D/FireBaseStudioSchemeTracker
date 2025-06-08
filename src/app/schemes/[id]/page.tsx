
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, Edit, AlertCircle, DollarSign, BarChart2, FileCheck2, Loader2, XCircle, PieChart, Eye, CalendarIcon, Users2 } from 'lucide-react';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { getMockSchemeById, updateMockSchemePayment, closeMockScheme, getMockSchemes, getUniqueGroupNames, updateSchemeGroup } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Line, LineChart, Legend, Tooltip as RechartsTooltip, BarChart as RechartsBarChart } from "recharts"
import Link from 'next/link';
import { isPast, parseISO, formatISO, startOfDay } from 'date-fns';
import { MonthlyCircularProgress } from '@/components/shared/MonthlyCircularProgress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AssignGroupDialog } from '@/components/dialogs/AssignGroupDialog';

const paymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];

export default function SchemeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const schemeId = params.id as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<Payment | null>(null);
  
  const [isClosingSchemeProcess, setIsClosingSchemeProcess] = useState(false);
  const [isCloseSchemeAlertOpen, setIsCloseSchemeAlertOpen] = useState(false);
  const [closureDate, setClosureDate] = useState<Date | undefined>(new Date());
  const [closureType, setClosureType] = useState<'full_reconciliation' | 'partial_closure'>('full_reconciliation');
  const [closureModeOfPayment, setClosureModeOfPayment] = useState<PaymentMode[]>(['Cash']);

  const [allSchemesForThisCustomer, setAllSchemesForThisCustomer] = useState<Scheme[]>([]);
  const [existingGroupNames, setExistingGroupNames] = useState<string[]>([]);
  const [isAssignGroupDialogOpen, setIsAssignGroupDialogOpen] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);

  const loadSchemeData = useCallback(() => {
    if (schemeId) {
      setIsLoading(true);
      const fetchedScheme = getMockSchemeById(schemeId);
      if (fetchedScheme) {
        const totals = calculateSchemeTotals(fetchedScheme);
        fetchedScheme.payments.forEach(p => p.status = getPaymentStatus(p, fetchedScheme.startDate));
        const status = getSchemeStatus(fetchedScheme); 
        setScheme({ ...fetchedScheme, ...totals, status });

        const allCustomerSchemes = getMockSchemes()
          .filter(s => s.customerName === fetchedScheme.customerName)
          .map(s => {
            const sTotals = calculateSchemeTotals(s);
            s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
            const sStatus = getSchemeStatus(s);
            return { ...s, ...sTotals, status: sStatus };
          })
          .sort((a,b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()); // Sort by start date desc
        setAllSchemesForThisCustomer(allCustomerSchemes);
      }
      setExistingGroupNames(getUniqueGroupNames());
      setIsLoading(false);
    }
  }, [schemeId]);

  useEffect(() => {
    loadSchemeData();
  }, [loadSchemeData]);


  const handleRecordPayment = (data: { paymentDate: string; amountPaid: number; modeOfPayment: PaymentMode[] }) => {
    if (!selectedPaymentForRecord || !scheme || scheme.status === 'Completed') {
      if(scheme?.status === 'Completed') {
        toast({ title: 'Action Denied', description: 'Cannot record payment for a completed scheme.', variant: 'destructive' });
      }
      return;
    }
    setIsRecordingPayment(true);
    const updatedScheme = updateMockSchemePayment(scheme.id, selectedPaymentForRecord.id, data);
    if (updatedScheme) {
      const totals = calculateSchemeTotals(updatedScheme);
      updatedScheme.payments.forEach(p => p.status = getPaymentStatus(p, updatedScheme.startDate));
      const status = getSchemeStatus(updatedScheme);
      setScheme({ ...updatedScheme, ...totals, status }); // Update current scheme
      // Also update this scheme in the allSchemesForThisCustomer list
      setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === updatedScheme.id ? { ...updatedScheme, ...totals, status } : s));
      toast({ title: 'Payment Recorded', description: `Payment for month ${selectedPaymentForRecord.monthNumber} recorded successfully.` });
    } else {
      toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
    }
    setSelectedPaymentForRecord(null);
    setIsRecordingPayment(false);
  };
  
  const handleOpenCloseSchemeDialog = () => {
    if (!scheme || scheme.status === 'Completed') return;
    setClosureDate(scheme.closureDate ? parseISO(scheme.closureDate) : startOfDay(new Date()));
    setClosureType('full_reconciliation'); 
    setClosureModeOfPayment(['Cash']); 
    setIsCloseSchemeAlertOpen(true);
  };

  const handleConfirmCloseScheme = () => {
    if(!scheme || !closureDate) return;
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

    const closedSchemeResult = closeMockScheme(scheme.id, closureOptions);

    if(closedSchemeResult) {
      const refreshedScheme = getMockSchemeById(scheme.id); 
      if (refreshedScheme) {
        setScheme(refreshedScheme);
        setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === refreshedScheme.id ? refreshedScheme : s));
        toast({ title: 'Scheme Closed', description: `${refreshedScheme.customerName}'s scheme has been marked as completed on ${formatDate(refreshedScheme.closureDate!)}.` });
      } else {
         toast({ title: 'Scheme Closed', description: `Scheme ${scheme.id} marked as completed.` });
         setScheme(prev => prev ? {...prev, status: 'Completed', closureDate: formatISO(closureDate)} : null);
         setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === scheme.id ? {...s, status: 'Completed' as SchemeStatus, closureDate: formatISO(closureDate)} : s));
      }
    } else {
       toast({ title: 'Error', description: 'Failed to close scheme.', variant: 'destructive' });
    }
    setIsCloseSchemeAlertOpen(false);
    setIsClosingSchemeProcess(false);
  }

  const handleAssignGroupSubmit = (updatedSchemeId: string, groupName?: string) => {
    setIsUpdatingGroup(true);
    const updatedSchemeFromMock = updateSchemeGroup(updatedSchemeId, groupName);
    if (updatedSchemeFromMock) {
      // If the updated scheme is the current main scheme, update it
      if (scheme && updatedSchemeFromMock.id === scheme.id) {
        setScheme(updatedSchemeFromMock);
      }
      // Update the scheme in the list of all customer's schemes
      setAllSchemesForThisCustomer(prevAll => prevAll.map(s => s.id === updatedSchemeFromMock.id ? updatedSchemeFromMock : s));
      
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


  const paymentChartData = useMemo(() => {
    if (!scheme) return [];
    return scheme.payments.map(p => ({
      month: `M${p.monthNumber}`,
      expected: p.amountExpected,
      paid: p.amountPaid || 0,
    }));
  }, [scheme]);

  const cumulativePaymentData = useMemo(() => {
    if (!scheme) return [];
    let cumulativePaid = 0;
    let cumulativeExpected = 0;
    return scheme.payments.map(p => {
      cumulativePaid += (p.amountPaid || 0);
      cumulativeExpected += p.amountExpected;
      return {
        month: `M${p.monthNumber}`,
        cumulativePaid,
        cumulativeExpected,
      };
    });
  }, [scheme]);

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
    for (let i = 0; i < payment.monthNumber - 1; i++) {
      if (getPaymentStatus(currentScheme.payments[i], currentScheme.startDate) !== 'Paid') {
        return false;
      }
    }
    return true;
  };


  if (isLoading || !scheme) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="font-headline text-2xl">{scheme.customerName}</CardTitle>
            <CardDescription>
              Scheme ID: {scheme.id} <br/> Started on {formatDate(scheme.startDate)}
              {scheme.status === 'Completed' && scheme.closureDate && (
                <><br/>Closed on: {formatDate(scheme.closureDate)}</>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <SchemeStatusBadge status={scheme.status} />
            <Button 
              onClick={() => setIsAssignGroupDialogOpen(true)} 
              variant="outline"
              size="sm"
              disabled={isClosingSchemeProcess || isCloseSchemeAlertOpen || isUpdatingGroup}
            >
              <Users2 className="mr-2 h-4 w-4" /> Manage Group
            </Button>
            {scheme.status !== 'Completed' && (
              <Button onClick={handleOpenCloseSchemeDialog} disabled={isClosingSchemeProcess || isCloseSchemeAlertOpen || isUpdatingGroup} size="sm">
                {isClosingSchemeProcess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                Close Scheme
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><strong>Monthly Amount:</strong> {formatCurrency(scheme.monthlyPaymentAmount)}</div>
          <div><strong>Duration:</strong> {scheme.durationMonths} Months</div>
          <div><strong>Total Expected:</strong> {formatCurrency(scheme.payments.reduce((sum, p) => sum + p.amountExpected, 0))}</div>
          <div><strong>Total Collected:</strong> {formatCurrency(scheme.totalCollected || 0)}</div>
          <div><strong>Total Remaining:</strong> {formatCurrency(scheme.totalRemaining || 0)}</div>
          <div><strong>Payments Made:</strong> {scheme.paymentsMadeCount || 0} / {scheme.durationMonths}</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payments">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-3">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="visuals">Visuals</TabsTrigger>
          <TabsTrigger value="summary" disabled={scheme.status !== 'Completed'}>Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Payment Schedule for Current Scheme</CardTitle>
            </CardHeader>
            <CardContent>
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
                    {scheme.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.monthNumber}</TableCell>
                        <TableCell>{formatDate(payment.dueDate)}</TableCell>
                        <TableCell>{formatCurrency(payment.amountExpected)}</TableCell>
                        <TableCell>{formatCurrency(payment.amountPaid)}</TableCell>
                        <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                        <TableCell>{payment.modeOfPayment?.join(' | ') || '-'}</TableCell>
                        <TableCell><PaymentStatusBadge status={getPaymentStatus(payment, scheme.startDate)} /></TableCell>
                        <TableCell className="text-right">
                          {isPaymentRecordable(payment, scheme) ? (
                            <Dialog onOpenChange={(open) => !open && setSelectedPaymentForRecord(null)}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedPaymentForRecord(payment)}>
                                  <DollarSign className="mr-1 h-4 w-4" /> Record
                                </Button>
                              </DialogTrigger>
                              {selectedPaymentForRecord && selectedPaymentForRecord.id === payment.id && (
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="font-headline">Record Payment for {scheme.customerName}</DialogTitle>
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
                            payment.status === 'Paid' && scheme.status !== 'Completed' && <CheckCircle className="h-5 w-5 text-green-500 inline-block" />
                          )}
                           {scheme.status === 'Completed' && payment.status === 'Paid' && <CheckCircle className="h-5 w-5 text-green-500 inline-block" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visuals">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline">Monthly Progress (Current Scheme)</CardTitle>
                <CardDescription>Visual breakdown of payments by month for the current scheme.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center">
                <MonthlyCircularProgress 
                  payments={scheme.payments} 
                  startDate={scheme.startDate}
                  durationMonths={scheme.durationMonths}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Payment Trends (Current Scheme)</CardTitle>
                <CardDescription>Expected vs. Paid amounts over the scheme duration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="text-md font-semibold mb-2">Monthly Payments</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer>
                      <RechartsBarChart data={paymentChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹', '')} />
                        <RechartsTooltip content={<ChartTooltipContent />} formatter={(value) => formatCurrency(Number(value))}/>
                        <Legend />
                        <Bar dataKey="expected" fill="var(--color-expected)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="paid" fill="var(--color-paid)" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                <div>
                  <h3 className="text-md font-semibold mb-2">Cumulative Payments</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={cumulativePaymentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹', '')} />
                        <RechartsTooltip content={<ChartTooltipContent />} formatter={(value) => formatCurrency(Number(value))}/>
                        <Legend />
                        <Line type="monotone" dataKey="cumulativeExpected" stroke="var(--color-cumulativeExpected)" strokeWidth={2} dot={false}/>
                        <Line type="monotone" dataKey="cumulativePaid" stroke="var(--color-cumulativePaid)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="summary">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Scheme Completion Summary</CardTitle>
                    <CardDescription>Overview of the completed scheme for {scheme.customerName}. 
                        {scheme.closureDate && ` Closed on ${formatDate(scheme.closureDate)}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 border rounded-lg bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                            <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <p className="text-lg font-semibold text-green-700 dark:text-green-400">Successfully Completed</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <DollarSign className="h-8 w-8 text-green-600" />
                            <div>
                                <p className="text-sm text-muted-foreground">Total Amount Paid</p>
                                <p className="text-lg font-semibold text-green-700 dark:text-green-400">{formatCurrency(scheme.totalCollected || 0)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <p>This scheme, initiated on <strong>{formatDate(scheme.startDate)}</strong>, has concluded. 
                    Total amount collected towards this scheme is <strong>{formatCurrency(scheme.totalCollected || 0)}</strong>.</p>
                    
                     <div className="mt-6">
                        <h4 className="font-semibold mb-2">Final Payment Overview</h4>
                        <ResponsiveContainer width="100%" height={200}>
                             <RechartsBarChart data={[{ name: 'Scheme Total', paid: scheme.totalCollected || 0 }]} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(value) => formatCurrency(value).replace('₹', '')} />
                                <YAxis type="category" dataKey="name" width={100} />
                                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="paid" fill="var(--color-paid)" barSize={30} radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                    <Button variant="outline" className="mt-4" disabled>
                        <FileCheck2 className="mr-2 h-4 w-4" /> Generate Final Report (PDF)
                    </Button>
                     <p className="text-xs text-muted-foreground mt-1">(PDF generation coming soon)</p>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {allSchemesForThisCustomer.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-headline">All Schemes Enrolled by {scheme.customerName}</CardTitle>
            <CardDescription>Overview of all schemes associated with this customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {allSchemesForThisCustomer.map((s) => (
                <AccordionItem value={s.id} key={s.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between items-center w-full pr-2">
                      <div className="flex flex-col text-left sm:flex-row sm:items-center gap-x-3 gap-y-1">
                        <span className="font-medium">ID: {s.id.substring(0,8)}...</span>
                        <SchemeStatusBadge status={s.status} />
                        {s.id === scheme.id && <Badge variant="outline" className="text-xs h-5">Currently Viewing</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground hidden md:block">
                        Started: {formatDate(s.startDate)} | Monthly: {formatCurrency(s.monthlyPaymentAmount)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {s.id === scheme.id ? (
                      <p className="p-4 text-sm text-muted-foreground">Details for this scheme are shown above in the main section and tabs.</p>
                    ) : s.status === 'Completed' ? (
                      <div className="p-4 text-sm">
                        <p><strong>Scheme Completed</strong></p>
                        {s.closureDate && <p>Closed on: {formatDate(s.closureDate)}</p>}
                        <p>Total Collected: {formatCurrency(s.totalCollected || 0)}</p>
                        <Button asChild variant="link" size="sm" className="p-0 h-auto mt-1">
                          <Link href={`/schemes/${s.id}`}>View Full Details</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="p-2">
                        <p className="text-sm font-semibold mb-2">Payment Schedule for Scheme ID: {s.id.substring(0,8)}...</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Month</TableHead>
                              <TableHead className="text-xs">Due</TableHead>
                              <TableHead className="text-xs text-right">Expected</TableHead>
                              <TableHead className="text-xs text-right">Paid</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {s.payments.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs">{p.monthNumber}</TableCell>
                                <TableCell className="text-xs">{formatDate(p.dueDate, 'dd/MM/yy')}</TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(p.amountExpected)}</TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(p.amountPaid)}</TableCell>
                                <TableCell className="text-xs"><PaymentStatusBadge status={getPaymentStatus(p, s.startDate)} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <Button asChild variant="link" size="sm" className="p-0 h-auto mt-2">
                          <Link href={`/schemes/${s.id}`}>View Full Details & Record Payments</Link>
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
      

      {isCloseSchemeAlertOpen && scheme && (
        <AlertDialog open={isCloseSchemeAlertOpen} onOpenChange={setIsCloseSchemeAlertOpen}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Scheme Closure for {scheme.customerName}</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
                <div>
                    <Label htmlFor="closure-type">Closure Type</Label>
                    <RadioGroup
                        id="closure-type"
                        value={closureType}
                        onValueChange={(value: 'full_reconciliation' | 'partial_closure') => setClosureType(value)}
                        className="mt-1 space-y-1"
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
                            disabled={(date) => date > new Date() || date < parseISO(scheme.startDate) }
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
              <AlertDialogCancel onClick={() => setIsCloseSchemeAlertOpen(false)} disabled={isClosingSchemeProcess}>Cancel</AlertDialogCancel>
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
