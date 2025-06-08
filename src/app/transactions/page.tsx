
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Edit, Trash2, Filter, MoreHorizontal, Eye, Loader2 } from 'lucide-react';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { getMockSchemes, editMockPaymentDetails, deleteMockPayment } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
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


interface TransactionRow extends Payment {
  customerName: string;
  customerGroupName?: string;
  schemeStartDate: string; 
}

interface GroupedTransactionDisplay {
  groupName: string;
  transactions: TransactionRow[];
  totalAmount: number;
  customerNames: string[]; 
}


export default function TransactionsPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [allFlatTransactions, setAllFlatTransactions] = useState<TransactionRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<TransactionRow | null>(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<TransactionRow | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

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
    ).sort((a,b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime()); 
    setAllFlatTransactions(transactions);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { groupedDisplayData, individualDisplayData } = useMemo(() => {
    const filtered = allFlatTransactions.filter(transaction =>
      transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.customerGroupName && transaction.customerGroupName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      transaction.schemeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.modeOfPayment && transaction.modeOfPayment.some(mode => mode.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const groupsMap = new Map<string, GroupedTransactionDisplay>();
    const individuals: TransactionRow[] = [];

    filtered.forEach(transaction => {
      if (transaction.customerGroupName) {
        let groupEntry = groupsMap.get(transaction.customerGroupName);
        if (!groupEntry) {
          groupEntry = { 
            groupName: transaction.customerGroupName, 
            transactions: [], 
            totalAmount: 0, 
            customerNames: [] 
          };
        }
        groupEntry.transactions.push(transaction);
        groupEntry.totalAmount += transaction.amountPaid || 0;
        if (!groupEntry.customerNames.includes(transaction.customerName)) {
          groupEntry.customerNames.push(transaction.customerName);
        }
        groupsMap.set(transaction.customerGroupName, groupEntry);
      } else {
        individuals.push(transaction);
      }
    });
    
    return { 
      groupedDisplayData: Array.from(groupsMap.values()), 
      individualDisplayData: individuals 
    };
  }, [allFlatTransactions, searchTerm]);

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
    const updatedScheme = deleteMockPayment(paymentToDelete.schemeId, paymentToDelete.id);
    if (updatedScheme) {
      toast({ title: 'Payment Deleted', description: `Payment record for ${paymentToDelete.customerName} (Month ${paymentToDelete.monthNumber}) has been removed.` });
      loadData(); 
    } else {
      toast({ title: 'Error', description: 'Failed to delete payment.', variant: 'destructive' });
    }
    setPaymentToDelete(null);
    setIsDeletingPayment(false);
  };

  const renderTransactionTable = (transactions: TransactionRow[], isGroupedTable: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          {!isGroupedTable && <TableHead>Customer</TableHead>}
          {isGroupedTable && <TableHead>Customer (in Group)</TableHead>}
          <TableHead>Scheme ID</TableHead>
          <TableHead>Month</TableHead>
          <TableHead>Payment Date</TableHead>
          <TableHead>Amount Paid</TableHead>
          <TableHead>Mode(s)</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className="font-medium">{transaction.customerName}</TableCell>
            <TableCell>
              <Button variant="link" asChild className="p-0 h-auto">
                  <Link href={`/schemes/${transaction.schemeId}`} className="truncate max-w-[100px] sm:max-w-xs block">
                    {transaction.schemeId}
                  </Link>
              </Button>
            </TableCell>
            <TableCell>{transaction.monthNumber}</TableCell>
            <TableCell>{formatDate(transaction.paymentDate)}</TableCell>
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
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            <CardDescription>View and manage all recorded payments. Search by customer, group, scheme ID, or payment mode.</CardDescription>
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Filter transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupedDisplayData.length === 0 && individualDisplayData.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <p>No transactions match your filters or no payments recorded yet.</p>
              </div>
            )}

            {groupedDisplayData.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Grouped Transactions</h2>
                <Accordion type="multiple" className="w-full">
                  {groupedDisplayData.map((group) => (
                    <AccordionItem value={group.groupName} key={group.groupName}>
                      <AccordionTrigger className="p-3 hover:bg-muted/80 text-left rounded-md border mb-1 data-[state=open]:bg-muted/50">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-1">
                          <span className="font-semibold text-base text-primary">Group: {group.groupName}</span>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center">
                            <span>{group.transactions.length} recorded payment(s)</span>
                            <span className="font-medium">Group Total (filtered): {formatCurrency(group.totalAmount)}</span>
                            {group.customerNames.length > 0 && (
                              <span className="truncate max-w-xs">
                                Involving: {group.customerNames.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0 pb-2 px-1">
                        {renderTransactionTable(group.transactions, true)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {individualDisplayData.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 pt-4">Individual Transactions</h2>
                {renderTransactionTable(individualDisplayData, false)}
              </div>
            )}
            
          </CardContent>
        </Card>
      </div>

      {/* Edit Payment Dialog */}
      {selectedPaymentForEdit && (
        <Dialog open={!!selectedPaymentForEdit} onOpenChange={(open) => !open && setSelectedPaymentForEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline">Edit Payment for {selectedPaymentForEdit.customerName} (Month {selectedPaymentForEdit.monthNumber})</DialogTitle>
               <CardDescription>Scheme ID: {selectedPaymentForEdit.schemeId}</CardDescription>
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

      {/* Delete Payment Confirmation Dialog */}
      {paymentToDelete && (
        <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the payment record for {paymentToDelete.customerName} (Month {paymentToDelete.monthNumber}, Amount: {formatCurrency(paymentToDelete.amountPaid)})?
                This action will mark the payment as unpaid and cannot be undone easily.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPaymentToDelete(null)} disabled={isDeletingPayment}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePaymentConfirm} disabled={isDeletingPayment} className="bg-destructive hover:bg-destructive/90">
                {isDeletingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Payment
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
    