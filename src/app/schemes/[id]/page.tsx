
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, Edit, AlertCircle, DollarSign, BarChart2, FileCheck2, Loader2, XCircle, PieChart } from 'lucide-react';
import type { Scheme, Payment } from '@/types/scheme';
import { getMockSchemeById, updateMockSchemePayment, closeMockScheme } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { SchemeStatusBadge } from '@/components/shared/SchemeStatusBadge';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Line, LineChart, Legend, Tooltip as RechartsTooltip, BarChart as RechartsBarChart } from "recharts"
import Link from 'next/link';
import { isPast, parseISO } from 'date-fns';
import { MonthlyCircularProgress } from '@/components/shared/MonthlyCircularProgress';


export default function SchemeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const schemeId = params.id as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<Payment | null>(null);
  const [isClosingScheme, setIsClosingScheme] = useState(false);


  useEffect(() => {
    if (schemeId) {
      const fetchedScheme = getMockSchemeById(schemeId);
      if (fetchedScheme) {
        const totals = calculateSchemeTotals(fetchedScheme);
        const status = getSchemeStatus(fetchedScheme);
        fetchedScheme.payments.forEach(p => p.status = getPaymentStatus(p, fetchedScheme.startDate));
        setScheme({ ...fetchedScheme, ...totals, status });
      }
      setIsLoading(false);
    }
  }, [schemeId]);

  const handleRecordPayment = (data: { paymentDate: string; amountPaid: number }) => {
    if (!selectedPaymentForRecord || !scheme) return;
    setIsRecordingPayment(true);
    const updatedScheme = updateMockSchemePayment(scheme.id, selectedPaymentForRecord.id, data);
    if (updatedScheme) {
      const totals = calculateSchemeTotals(updatedScheme);
      const status = getSchemeStatus(updatedScheme);
      updatedScheme.payments.forEach(p => p.status = getPaymentStatus(p, updatedScheme.startDate));
      setScheme({ ...updatedScheme, ...totals, status });
      toast({ title: 'Payment Recorded', description: `Payment for month ${selectedPaymentForRecord.monthNumber} recorded successfully.` });
    } else {
      toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
    }
    setSelectedPaymentForRecord(null);
    setIsRecordingPayment(false);
  };
  
  const handleCloseScheme = () => {
    if(!scheme) return;
    setIsClosingScheme(true);
    const closedScheme = closeMockScheme(scheme.id);
    if(closedScheme) {
      const totals = calculateSchemeTotals(closedScheme);
      const status = getSchemeStatus(closedScheme);
      closedScheme.payments.forEach(p => p.status = getPaymentStatus(p, closedScheme.startDate));
      setScheme({ ...closedScheme, ...totals, status });
      toast({ title: 'Scheme Closed', description: `${scheme.customerName}'s scheme has been marked as completed.` });
    } else {
       toast({ title: 'Error', description: 'Failed to close scheme.', variant: 'destructive' });
    }
    setIsClosingScheme(false);
  }

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

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!scheme) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle className="font-headline text-destructive">Scheme Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <p>The requested scheme could not be found.</p>
          <Button asChild variant="link" className="mt-4">
            <Link href="/schemes">Go back to Schemes</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canCloseScheme = scheme.status === 'Active' && scheme.payments.every(p => p.status === 'Paid' || isPast(parseISO(p.dueDate)));


  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="font-headline text-2xl">{scheme.customerName}</CardTitle>
            <CardDescription>Scheme started on {formatDate(scheme.startDate)}</CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <SchemeStatusBadge status={scheme.status} />
            {canCloseScheme && scheme.status !== 'Completed' && (
              <Button onClick={handleCloseScheme} disabled={isClosingScheme} size="sm">
                {isClosingScheme ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                Close Scheme
              </Button>
            )}
             {scheme.status === 'Completed' && (
              <Button variant="outline" size="sm" disabled>
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Scheme Closed
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
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
              <CardTitle className="font-headline">Payment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Paid Amount</TableHead>
                    <TableHead>Payment Date</TableHead>
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
                      <TableCell><PaymentStatusBadge status={getPaymentStatus(payment, scheme.startDate)} /></TableCell>
                      <TableCell className="text-right">
                        {getPaymentStatus(payment, scheme.startDate) !== 'Paid' && scheme.status !== 'Completed' && (
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
                        )}
                         {getPaymentStatus(payment, scheme.startDate) === 'Paid' && <CheckCircle className="h-5 w-5 text-green-500 inline-block" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visuals">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Monthly Progress</CardTitle>
                <CardDescription>Visual breakdown of payments by month.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyCircularProgress 
                  payments={scheme.payments} 
                  startDate={scheme.startDate}
                  durationMonths={scheme.durationMonths}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Payment Trends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Monthly Payments (Expected vs. Paid)</h3>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
                  <h3 className="text-lg font-semibold mb-2">Cumulative Payments Over Time</h3>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
                    <CardDescription>Overview of the completed scheme for {scheme.customerName}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 border rounded-lg bg-green-50 dark:bg-green-900/20">
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
                    
                    <p>This scheme, initiated on <strong>{formatDate(scheme.startDate)}</strong>, has concluded successfully. All {scheme.durationMonths} payments have been recorded, amounting to a total of <strong>{formatCurrency(scheme.totalCollected || 0)}</strong>.</p>
                    
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
                    <Button variant="outline" className="mt-4">
                        <FileCheck2 className="mr-2 h-4 w-4" /> Generate Final Report (PDF)
                    </Button>
                </CardContent>
            </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
