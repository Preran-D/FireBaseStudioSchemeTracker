
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, FileUp, FileSpreadsheet, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { getMockSchemes, addMockScheme } from '@/lib/mock-data';
import type { Scheme, Payment } from '@/types/scheme';
import { arrayToCSV, downloadCSV, parseCSV } from '@/lib/csvUtils';
import { formatDate, formatCurrency, getPaymentStatus, getSchemeStatus, calculateSchemeTotals } from '@/lib/utils';
import { isValid, parse } from 'date-fns';

interface ImportMessage {
  type: 'success' | 'error' | 'info';
  content: string;
}

export default function DataManagementPage() {
  const { toast } = useToast();
  const [isExportingCustomers, setIsExportingCustomers] = useState(false);
  const [isExportingTransactions, setIsExportingTransactions] = useState(false);
  const [isExportingComprehensive, setIsExportingComprehensive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMessages, setImportMessages] = useState<ImportMessage[]>([]);

  const handleExportCustomers = () => {
    setIsExportingCustomers(true);
    try {
      const schemes = getMockSchemes();
      const uniqueCustomers = new Map<string, { groups: Set<string> }>();
      schemes.forEach(scheme => {
        if (!uniqueCustomers.has(scheme.customerName)) {
          uniqueCustomers.set(scheme.customerName, { groups: new Set() });
        }
        if (scheme.customerGroupName) {
          uniqueCustomers.get(scheme.customerName)?.groups.add(scheme.customerGroupName);
        }
      });

      const dataToExport: any[][] = [['Customer Name', 'Associated Groups']];
      uniqueCustomers.forEach((details, name) => {
        dataToExport.push([name, Array.from(details.groups).join(' | ') || 'N/A']);
      });

      const csvString = arrayToCSV(dataToExport);
      downloadCSV(csvString, 'customer_list.csv');
      toast({ title: 'Success', description: 'Customer list exported successfully.' });
    } catch (error) {
      console.error('Error exporting customers:', error);
      toast({ title: 'Error', description: 'Failed to export customer list.', variant: 'destructive' });
    }
    setIsExportingCustomers(false);
  };

  const handleExportTransactions = () => {
    setIsExportingTransactions(true);
    try {
      const schemes = getMockSchemes();
      const paidTransactions: any[][] = [['Customer Name', 'Scheme ID', 'Group Name', 'Month Number', 'Payment Date', 'Amount Paid', 'Mode of Payment']];
      
      schemes.forEach(scheme => {
        scheme.payments.forEach(payment => {
          const paymentStatus = getPaymentStatus(payment, scheme.startDate);
          if (paymentStatus === 'Paid' && payment.paymentDate && payment.amountPaid !== undefined) {
            paidTransactions.push([
              scheme.customerName,
              scheme.id,
              scheme.customerGroupName || 'N/A',
              payment.monthNumber,
              formatDate(payment.paymentDate),
              payment.amountPaid,
              payment.modeOfPayment?.join(' | ') || 'N/A'
            ]);
          }
        });
      });

      if (paidTransactions.length <= 1) {
        toast({ title: 'No Data', description: 'No paid transactions found to export.' });
        setIsExportingTransactions(false);
        return;
      }

      const csvString = arrayToCSV(paidTransactions);
      downloadCSV(csvString, 'paid_transactions.csv');
      toast({ title: 'Success', description: 'Paid transactions exported successfully.' });
    } catch (error) {
      console.error('Error exporting transactions:', error);
      toast({ title: 'Error', description: 'Failed to export transaction data.', variant: 'destructive' });
    }
    setIsExportingTransactions(false);
  };

  const handleExportComprehensiveReport = () => {
    setIsExportingComprehensive(true);
    try {
      const schemes = getMockSchemes(); // Fetches schemes with updated statuses and totals
      const reportData: any[][] = [[
        'Customer Name', 'Customer Group Name', 'Scheme ID', 'Scheme Start Date', 
        'Scheme Monthly Amount', 'Scheme Duration (Months)', 'Overall Scheme Status',
        'Payment Month #', 'Payment Due Date', 'Actual Payment Date', 
        'Amount Expected', 'Amount Paid', 'Individual Payment Status', 'Mode of Payment'
      ]];

      schemes.forEach(scheme => {
        // Recalculate status and totals just in case, though getMockSchemes should handle it
        const currentSchemeStatus = getSchemeStatus(scheme);
        const totals = calculateSchemeTotals(scheme);

        scheme.payments.forEach(payment => {
          const currentPaymentStatus = getPaymentStatus(payment, scheme.startDate);
          reportData.push([
            scheme.customerName,
            scheme.customerGroupName || 'N/A',
            scheme.id,
            formatDate(scheme.startDate),
            scheme.monthlyPaymentAmount,
            scheme.durationMonths,
            currentSchemeStatus,
            payment.monthNumber,
            formatDate(payment.dueDate),
            payment.paymentDate ? formatDate(payment.paymentDate) : 'N/A',
            payment.amountExpected,
            payment.amountPaid !== undefined ? payment.amountPaid : 'N/A',
            currentPaymentStatus,
            payment.modeOfPayment?.join(' | ') || 'N/A'
          ]);
        });
      });

      if (reportData.length <= 1) {
        toast({ title: 'No Data', description: 'No data found to export for the comprehensive report.' });
        setIsExportingComprehensive(false);
        return;
      }

      const csvString = arrayToCSV(reportData);
      downloadCSV(csvString, 'comprehensive_customer_report.csv');
      toast({ title: 'Success', description: 'Comprehensive customer report exported successfully.' });
    } catch (error) {
      console.error('Error exporting comprehensive report:', error);
      toast({ title: 'Error', description: 'Failed to export comprehensive report.', variant: 'destructive' });
    }
    setIsExportingComprehensive(false);
  };


  const handleDownloadSample = () => {
    const sampleData: any[][] = [
      ['CustomerName', 'StartDate (YYYY-MM-DD)', 'MonthlyPaymentAmount', 'CustomerGroupName (Optional)'],
      ['John Doe', '2024-01-15', '1000', 'Friends Circle'],
      ['Jane Smith', '2024-02-01', '500', ''],
      ['Mike Brown', '2023-12-20', '1500', 'Office Team'],
    ];
    const csvString = arrayToCSV(sampleData);
    downloadCSV(csvString, 'sample_scheme_import.csv');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setImportMessages([]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImportSchemes = async () => {
    if (!selectedFile) {
      toast({ title: 'No File', description: 'Please select a CSV file to import.', variant: 'destructive' });
      return;
    }
    setIsImporting(true);
    setImportMessages([{ type: 'info', content: `Starting import from ${selectedFile.name}...` }]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setImportMessages(prev => [...prev, { type: 'error', content: 'File is empty or could not be read.' }]);
        setIsImporting(false);
        return;
      }

      const { headers, rows } = parseCSV(text);
      const expectedHeaders = ['CustomerName', 'StartDate (YYYY-MM-DD)', 'MonthlyPaymentAmount', 'CustomerGroupName (Optional)'];
      const lcExpectedHeaders = expectedHeaders.map(h => h.toLowerCase());
      const lcHeaders = headers.map(h => h.toLowerCase());

      if (!lcExpectedHeaders.every((h, i) => lcHeaders[i] === h)) {
         setImportMessages(prev => [...prev, { type: 'error', content: `CSV headers do not match the expected format. Expected: ${expectedHeaders.join(', ')}` }]);
         setIsImporting(false);
         return;
      }
      
      let successCount = 0;
      let errorCount = 0;
      const newMessages: ImportMessage[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // CSV row number (1-indexed headers + 1)
        
        const customerName = row[0]?.trim();
        const startDateStr = row[1]?.trim();
        const monthlyPaymentAmountStr = row[2]?.trim();
        const customerGroupName = row[3]?.trim() || undefined;

        if (!customerName || !startDateStr || !monthlyPaymentAmountStr) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Missing required fields (CustomerName, StartDate, MonthlyPaymentAmount). Skipping.` });
          errorCount++;
          continue;
        }
        
        const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
        if (!isValid(startDate)) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Invalid StartDate format for '${customerName}'. Expected YYYY-MM-DD. Skipping.` });
          errorCount++;
          continue;
        }

        const monthlyPaymentAmount = parseFloat(monthlyPaymentAmountStr);
        if (isNaN(monthlyPaymentAmount) || monthlyPaymentAmount <= 0) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Invalid MonthlyPaymentAmount for '${customerName}'. Must be a positive number. Skipping.` });
          errorCount++;
          continue;
        }

        try {
          addMockScheme({
            customerName,
            startDate: startDate.toISOString(),
            monthlyPaymentAmount,
            customerGroupName,
          });
          successCount++;
        } catch (err) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Error adding scheme for '${customerName}'. ${(err as Error).message}. Skipping.` });
          errorCount++;
        }
      }
      
      newMessages.unshift({ type: 'info', content: `Import finished. ${successCount} schemes imported successfully. ${errorCount} rows had errors.` });
      setImportMessages(prev => [...prev.slice(0,1), ...newMessages]);
      toast({ title: 'Import Complete', description: `${successCount} schemes imported. ${errorCount} errors.`});
      setIsImporting(false);
      setSelectedFile(null); 
    };

    reader.onerror = () => {
      setImportMessages(prev => [...prev, { type: 'error', content: 'Error reading the file.'}]);
      toast({ title: 'File Read Error', description: 'Could not read the selected file.', variant: 'destructive' });
      setIsImporting(false);
    };

    reader.readAsText(selectedFile);
  };


  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-headline font-semibold">Data Management</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Data
          </CardTitle>
          <CardDescription>Download your application data in CSV format.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button 
            onClick={handleExportCustomers} 
            disabled={isExportingCustomers || isImporting || isExportingTransactions || isExportingComprehensive}
          >
            {isExportingCustomers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Customer List (CSV)
          </Button>
          <Button 
            onClick={handleExportTransactions} 
            disabled={isExportingTransactions || isImporting || isExportingCustomers || isExportingComprehensive}
          >
            {isExportingTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Paid Transactions (CSV)
          </Button>
          <Button 
            onClick={handleExportComprehensiveReport} 
            disabled={isExportingComprehensive || isImporting || isExportingCustomers || isExportingTransactions}
            className="sm:col-span-2 lg:col-span-1"
          >
            {isExportingComprehensive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Export Comprehensive Report (CSV)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Import Schemes
          </CardTitle>
          <CardDescription>Import multiple schemes at once using a CSV file. Download the sample file for the correct format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Button 
              variant="outline" 
              onClick={handleDownloadSample} 
              disabled={isImporting || isExportingCustomers || isExportingTransactions || isExportingComprehensive}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Sample Import File (CSV)
            </Button>
          </div>
          <div className="space-y-2">
            <label htmlFor="csv-import" className="text-sm font-medium">Upload CSV File</label>
            <Input
              id="csv-import"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isImporting || isExportingCustomers || isExportingTransactions || isExportingComprehensive}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </div>
          <Button 
            onClick={handleImportSchemes} 
            disabled={isImporting || !selectedFile || isExportingCustomers || isExportingTransactions || isExportingComprehensive}
          >
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Import Schemes from CSV
          </Button>

          {importMessages.length > 0 && (
            <div className="mt-4 space-y-2 p-4 border rounded-md max-h-60 overflow-y-auto bg-muted/50">
              <h4 className="font-semibold text-sm">Import Log:</h4>
              {importMessages.map((msg, index) => (
                <div key={index} className={`text-xs flex items-start gap-2 ${
                  msg.type === 'success' ? 'text-green-700 dark:text-green-400' :
                  msg.type === 'error' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {msg.type === 'error' && <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{msg.content}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
