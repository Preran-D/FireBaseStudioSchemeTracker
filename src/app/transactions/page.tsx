
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Edit, Trash2, Filter, MoreHorizontal, Eye, Loader2, X } from 'lucide-react';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { getMockSchemes, editMockPaymentDetails, deleteMockPayment, archiveMockPayment } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseISO } from 'date-fns'; // formatISO, isWithinInterval, startOfDay, endOfDay removed
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface TransactionRow extends Payment {
  customerName: string;
  customerGroupName?: string;
  schemeStartDate: string;
}

interface TransactionsOnDate {
  date: string; // YYYY-MM-DD
  formattedDate: string;
  transactions: TransactionRow[];
  totalAmountOnDate: number;
  distinctCustomerCountOnDate: number;
}

interface GroupedTransactionDisplay {
  groupName: string;
  datesWithTransactions: TransactionsOnDate[];
  totalAmountInGroup: number;
  customerNames: string[]; // All unique customer names in the group for the filtered range
}

// DateRange interface removed

export default function TransactionsPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [allFlatTransactions, setAllFlatTransactions] = useState<TransactionRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  // dateRange state removed
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<TransactionRow | null>(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<TransactionRow | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all-transactions');

  const { toast } = useToast();

  const loadData = useCallback(() => {
    const loadedSchemes = getMockSchemes().map(s => {
      const totals = calculateSchemeTotals(s);
      const status = getSchemeStatus(s);
      s.payments.forEach(p => p.status = getPaymentStatus(p, s.startDate));
      return { ...s, ...totals, status };
    });
    setAllSchemes(loadedSchemes);

    const transactions = loadedSchemes.flatMap(scheme =>
      scheme.payments
        .filter(p => p.status === 'Paid' && p.amountPaid && p.paymentDate)
        .map(payment => ({
          ...payment,
          customerName: scheme.customerName,
          customerGroupName: scheme.customerGroupName,
          schemeStartDate: scheme.startDate,
        }))
    ).sort((a,b) => parseISO(b.paymentDate!).getTime() - parseISO(a.paymentDate!).getTime());
    setAllFlatTransactions(transactions);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const {
    filteredTransactions, // For "All Transactions" tab
    groupedDisplayData,    // For "Grouped View" tab
    individualDisplayData  // For "Grouped View" tab (non-grouped items)
  } = useMemo(() => {
    let currentFilteredTransactions = allFlatTransactions;

    // Date range filtering block removed

    if (searchTerm) {
      currentFilteredTransactions = currentFilteredTransactions.filter(transaction =>
        transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.customerGroupName && transaction.customerGroupName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        transaction.schemeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.modeOfPayment && transaction.modeOfPayment.some(mode => mode.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    const groupsMapTemp = new Map<string, {
      allCustomerNamesInGroup: Set<string>;
      totalAmountInGroup: number;
      transactionsByDateMap: Map<string, { transactionsOnDate: TransactionRow[]; totalAmountOnDate: number; distinctCustomersOnDate: Set<string> }>;
    }>();
    const individualsForGroupedView: TransactionRow[] = [];

    currentFilteredTransactions.forEach(transaction => {
      if (transaction.customerGroupName) {
        let groupEntry = groupsMapTemp.get(transaction.customerGroupName);
        if (!groupEntry) {
          groupEntry = {
            allCustomerNamesInGroup: new Set(),
            totalAmountInGroup: 0,
            transactionsByDateMap: new Map(),
          };
          groupsMapTemp.set(transaction.customerGroupName, groupEntry);
        }

        groupEntry.allCustomerNamesInGroup.add(transaction.customerName);
        groupEntry.totalAmountInGroup += transaction.amountPaid || 0;

        const paymentDateKey = transaction.paymentDate ? parseISO(transaction.paymentDate).toISOString().split('T')[0] : 'UnknownDate'; // formatISO removed
        let dateEntry = groupEntry.transactionsByDateMap.get(paymentDateKey);
        if (!dateEntry) {
          dateEntry = { transactionsOnDate: [], totalAmountOnDate: 0, distinctCustomersOnDate: new Set() };
          groupEntry.transactionsByDateMap.set(paymentDateKey, dateEntry);
        }
        dateEntry.transactionsOnDate.push(transaction);
        dateEntry.totalAmountOnDate += transaction.amountPaid || 0;
        dateEntry.distinctCustomersOnDate.add(transaction.customerName);

      } else {
        individualsForGroupedView.push(transaction);
      }
    });

    const finalGroupedDisplayData: GroupedTransactionDisplay[] = Array.from(groupsMapTemp.entries()).map(
      ([groupName, data]) => {
        const datesWithTransactionsArray: TransactionsOnDate[] = Array.from(data.transactionsByDateMap.entries())
          .map(([dateISO, dateData]) => ({
            date: dateISO,
            formattedDate: dateISO === 'UnknownDate' ? 'Unknown Date' : formatDate(dateISO),
            transactions: dateData.transactionsOnDate.sort((a,b) => a.customerName.localeCompare(b.customerName)),
            totalAmountOnDate: dateData.totalAmountOnDate,
            distinctCustomerCountOnDate: dateData.distinctCustomersOnDate.size,
          }))
          .sort((a,b) => (b.date === 'UnknownDate' ? -1 : a.date === 'UnknownDate' ? 1 : parseISO(b.date).getTime() - parseISO(a.date).getTime()));

        return {
          groupName,
          datesWithTransactions: datesWithTransactionsArray,
          totalAmountInGroup: data.totalAmountInGroup,
          customerNames: Array.from(data.allCustomerNamesInGroup).sort(),
        };
      }
    ).sort((a,b) => a.groupName.localeCompare(b.groupName));

    return {
      filteredTransactions: currentFilteredTransactions.sort((a,b) => parseISO(b.paymentDate!).getTime() - parseISO(a.paymentDate!).getTime()),
      groupedDisplayData: finalGroupedDisplayData,
      individualDisplayData: individualsForGroupedView.sort((a,b) => parseISO(b.paymentDate!).getTime() - parseISO(a.paymentDate!).getTime())
    };
  }, [allFlatTransactions, searchTerm]); // dateRange removed from dependency array

  const handleEditPaymentSubmit = (data: { paymentDate: string; amountPaid: number; modeOfPayment: PaymentMode[] }) => {
    if (!selectedPaymentForEdit) return;
    setIsEditingPayment(true);
    const updatedScheme = editMockPaymentDetails(selectedPaymentForEdit.schemeId, selectedPaymentForEdit.id, data);
    if (updatedScheme) {
      toast({ title: 'Payment Updated', description: `Payment for ${selectedPaymentForEdit.customerName} updated successfully.` });
      loadData();
    } else {
      toast({ title: 'Error', description: 'Failed to update payment.', variant: 'destructive' });
    }
    setSelectedPaymentForEdit(null);
    setIsEditingPayment(false);
  };

  const handleDeletePaymentConfirm = () => {
    if (!paymentToDelete) return;
    setIsDeletingPayment(true);
    const updatedScheme = archiveMockPayment(paymentToDelete.schemeId, paymentToDelete.id); // Changed to archiveMockPayment
    if (updatedScheme) {
      toast({ title: 'Payment Archived', description: `Payment record for ${paymentToDelete.customerName} (Month ${paymentToDelete.monthNumber}) has been moved to trash.` }); // Changed toast
      loadData();
    } else {
      toast({ title: 'Error Archiving Payment', description: 'Failed to move payment to trash.', variant: 'destructive' }); // Changed toast
    }
    setPaymentToDelete(null);
    setIsDeletingPayment(false);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    // setDateRange call removed
  };

  const renderTransactionTable = (transactions: TransactionRow[], isNestedTable: boolean = false, showPaymentDateColumn: boolean = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Scheme ID</TableHead>
          <TableHead>Month</TableHead>
          {showPaymentDateColumn ? <TableHead>Payment Date</TableHead> : null }
          <TableHead>Amount Paid</TableHead>
          <TableHead>Mode(s)</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className="font-medium">
              <Link href={`/schemes/${transaction.schemeId}`} passHref>
                <Button variant="link" className="p-0 h-auto text-left">
                  {transaction.customerName}
                </Button>
              </Link>
            </TableCell>
            <TableCell>
              <Button variant="link" asChild className="p-0 h-auto">
                  <Link href={`/schemes/${transaction.schemeId}`} className="truncate max-w-[100px] sm:max-w-xs block">
                    {transaction.schemeId.toUpperCase()}
                  </Link>
              </Button>
            </TableCell>
            <TableCell>{transaction.monthNumber}</TableCell>
            {showPaymentDateColumn ? <TableCell>{formatDate(transaction.paymentDate)}</TableCell> : null}
            <TableCell>{formatCurrency(transaction.amountPaid)}</TableCell>
            <TableCell>{transaction.modeOfPayment?.join(' | ') || '-'}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedPaymentForEdit(transaction)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPaymentToDelete(transaction)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" /> Move to Trash
                  </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/schemes/${transaction.schemeId}`} className="flex items-center">
                        <Eye className="mr-2 h-4 w-4" /> View Scheme
                      </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-headline font-semibold">All Transactions</h1>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>View and manage all recorded payments. Filter by text or date range.</CardDescription>
            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <Input
                placeholder="Filter by customer, group, scheme ID, mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              {/* Date picker divs removed */}
              {(searchTerm) && (
                <Button variant="ghost" onClick={clearAllFilters} size="sm">
                  <X className="mr-2 h-4 w-4" /> Clear Filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
                <TabsTrigger value="grouped-view">Grouped View</TabsTrigger>
              </TabsList>
              <TabsContent value="all-transactions" className="mt-4">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No transactions match your filters or no payments recorded yet.</p>
                  </div>
                ) : (
                  renderTransactionTable(filteredTransactions, false, true)
                )}
              </TabsContent>
              <TabsContent value="grouped-view" className="mt-4">
                {groupedDisplayData.length === 0 && individualDisplayData.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No transactions match your filters or no payments recorded yet for the grouped view.</p>
                  </div>
                )}

                {groupedDisplayData.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Grouped Transactions</h2>
                    <Accordion type="multiple" className="w-full">
                      {groupedDisplayData.map((group) => (
                        <AccordionItem value={`group-${group.groupName}`} key={`group-${group.groupName}`} className="mb-2 border rounded-md overflow-hidden">
                          <AccordionTrigger className="p-3 hover:bg-muted/80 text-left data-[state=open]:bg-muted/50 data-[state=open]:border-b">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-1">
                              <span className="font-semibold text-base text-primary">Group: {group.groupName}</span>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center">
                                <span>{group.datesWithTransactions.reduce((sum, d) => sum + d.transactions.length, 0)} recorded payment(s)</span>
                                <span className="font-medium">Group Total (filtered): {formatCurrency(group.totalAmountInGroup)}</span>
                                {group.customerNames.length > 0 && (
                                  <span className="truncate max-w-xs">
                                    Involving: {group.customerNames.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 pb-2 px-2 bg-background space-y-1">
                            {group.datesWithTransactions.length > 0 ? (
                              <Accordion type="multiple" className="w-full mt-2">
                                {group.datesWithTransactions.map((dateItem) => (
                                  <AccordionItem value={`date-${group.groupName}-${dateItem.date}`} key={`date-${group.groupName}-${dateItem.date}`} className="mb-1 border-t last:border-b-0">
                                    <AccordionTrigger className="py-2 px-3 text-sm hover:bg-muted/50 data-[state=open]:bg-muted/40">
                                      <div className="flex justify-between items-center w-full">
                                        <span>Date: {dateItem.formattedDate}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {dateItem.distinctCustomerCountOnDate} customer(s), Total: {formatCurrency(dateItem.totalAmountOnDate)}
                                        </span>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-1 pb-2 px-1">
                                      {renderTransactionTable(dateItem.transactions, true, false)}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            ) : (
                              <p className="p-4 text-center text-sm text-muted-foreground">No transactions for this group with the current filters.</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}

                {individualDisplayData.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-2 pt-4">Individual Transactions (Not in a Group)</h2>
                    {renderTransactionTable(individualDisplayData, false, true)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {selectedPaymentForEdit && (
        <Dialog open={!!selectedPaymentForEdit} onOpenChange={(open) => !open && setSelectedPaymentForEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline">Edit Payment for {selectedPaymentForEdit.customerName} (Month {selectedPaymentForEdit.monthNumber})</DialogTitle>
               <CardDescription>Scheme ID: {selectedPaymentForEdit.schemeId.toUpperCase()}</CardDescription>
            </DialogHeader>
            <RecordPaymentForm
              payment={selectedPaymentForEdit}
              onSubmit={handleEditPaymentSubmit}
              isLoading={isEditingPayment}
              isEdit={true}
            />
          </DialogContent>
        </Dialog>
      )}

      {paymentToDelete && (
        <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Archive Payment</AlertDialogTitle> {/* Changed title */}
              <AlertDialogDescription>
                Are you sure you want to move the payment record for {paymentToDelete.customerName} (Month {paymentToDelete.monthNumber}, Amount: {formatCurrency(paymentToDelete.amountPaid)}) to trash?
                This action can be undone from the archive. {/* Changed description */}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPaymentToDelete(null)} disabled={isDeletingPayment}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePaymentConfirm} disabled={isDeletingPayment} className="bg-destructive hover:bg-destructive/90">
                {isDeletingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Move to Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
    

    

