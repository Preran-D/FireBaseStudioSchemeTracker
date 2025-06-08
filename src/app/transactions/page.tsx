
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Trash2, Filter, MoreHorizontal, Eye, Loader2 } from 'lucide-react';
import type { Scheme, Payment, PaymentMode, SchemeStatus } from '@/types/scheme';
import { getMockSchemes, editMockPaymentDetails, deleteMockPayment } from '@/lib/mock-data';
import { formatCurrency, formatDate, getSchemeStatus, calculateSchemeTotals, getPaymentStatus } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm'; // Reusing for editing
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface TransactionRow extends Payment {
  customerName: string;
  schemeStartDate: string; // Needed for re-calculating status potentially
}

export default function TransactionsPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
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
        .filter(p => p.status === 'Paid' && p.amountPaid && p.paymentDate) // Only show actual paid transactions
        .map(payment => ({
          ...payment,
          customerName: scheme.customerName,
          schemeStartDate: scheme.startDate,
        }))
    ).sort((a,b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime()); // Sort by most recent
    setAllTransactions(transactions);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(transaction =>
      transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.modeOfPayment && transaction.modeOfPayment.some(mode => mode.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [allTransactions, searchTerm]);

  const handleEditPaymentSubmit = (data: { paymentDate: string; amountPaid: number; modeOfPayment: PaymentMode[] }) => {
    if (!selectedPaymentForEdit) return;
    setIsEditingPayment(true);
    const updatedScheme = editMockPaymentDetails(selectedPaymentForEdit.schemeId, selectedPaymentForEdit.id, data);
    if (updatedScheme) {
      toast({ title: 'Payment Updated', description: `Payment for ${selectedPaymentForEdit.customerName} updated successfully.` });
      loadData(); // Reload all data
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
      loadData(); // Reload all data
    } else {
      toast({ title: 'Error', description: 'Failed to delete payment.', variant: 'destructive' });
    }
    setPaymentToDelete(null);
    setIsDeletingPayment(false);
  };


  return (
    <>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-headline font-semibold">All Transactions</h1>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>View and manage all recorded payments. Search by customer or payment mode.</CardDescription>
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Filter by customer or payment mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Scheme ID</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Mode(s)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
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
                      <TableCell>{transaction.modeOfPayment?.join(', ') || '-'}</TableCell>
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
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>No transactions match your filters or no payments recorded yet.</p>
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
