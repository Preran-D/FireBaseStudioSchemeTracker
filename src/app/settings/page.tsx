
'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, FileUp, FileSpreadsheet, Loader2, AlertTriangle, FileText, Activity, Settings as SettingsIcon, SlidersHorizontal, Info, DatabaseZap } from 'lucide-react';
import { getMockSchemes, addMockScheme, importSchemeClosureUpdates } from '@/lib/mock-data';
import type { Scheme, Payment, PaymentMode } from '@/types/scheme';
import { arrayToCSV, downloadCSV, parseCSV } from '@/lib/csvUtils';
import { formatDate, formatCurrency, getPaymentStatus, getSchemeStatus, calculateSchemeTotals } from '@/lib/utils';
import { isValid, parse, formatISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ImportMessage {
  type: 'success' | 'error' | 'info';
  content: string;
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  messages: string[];
}

function DataManagementTabContent() {
  const { toast } = useToast();
  const [isExportingCustomers, setIsExportingCustomers] = useState(false);
  const [isExportingTransactions, setIsExportingTransactions] = useState(false);
  const [isExportingComprehensive, setIsExportingComprehensive] = useState(false);
  const [isExportingSchemeStatus, setIsExportingSchemeStatus] = useState(false);
  
  const [isImportingSchemes, setIsImportingSchemes] = useState(false);
  const [selectedSchemeImportFile, setSelectedSchemeImportFile] = useState<File | null>(null);
  const [schemeImportMessages, setSchemeImportMessages] = useState<ImportMessage[]>([]);

  const [isImportingClosures, setIsImportingClosures] = useState(false);
  const [selectedClosureImportFile, setSelectedClosureImportFile] = useState<File | null>(null);
  const [closureImportMessages, setClosureImportMessages] = useState<ImportMessage[]>([]);

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
              scheme.id.toUpperCase(),
              scheme.customerGroupName || 'N/A',
              payment.monthNumber,
              formatDate(payment.paymentDate),
              payment.amountPaid || '',
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
      const schemes = getMockSchemes(); 
      const reportData: any[][] = [[
        'Customer Name', 'Customer Group Name', 'Scheme ID', 'Scheme Start Date', 
        'Scheme Monthly Amount', 'Scheme Duration (Months)', 'Overall Scheme Status', 'Scheme Closure Date',
        'Payment Month #', 'Payment Due Date', 'Actual Payment Date', 
        'Amount Expected', 'Amount Paid', 'Individual Payment Status', 'Mode of Payment'
      ]];

      schemes.forEach(scheme => {
        const currentSchemeStatus = getSchemeStatus(scheme);
        scheme.payments.forEach(payment => {
          const currentPaymentStatus = getPaymentStatus(payment, scheme.startDate);
          reportData.push([
            scheme.customerName,
            scheme.customerGroupName || 'N/A',
            scheme.id.toUpperCase(),
            formatDate(scheme.startDate),
            scheme.monthlyPaymentAmount,
            scheme.durationMonths,
            currentSchemeStatus,
            scheme.closureDate ? formatDate(scheme.closureDate) : 'N/A',
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

  const handleExportSchemeStatusReport = () => {
    setIsExportingSchemeStatus(true);
    try {
      const schemes = getMockSchemes();
      const reportData: any[][] = [[
        'Customer Name', 'Scheme ID', 'Scheme Start Date', 'Monthly Amount', 
        'Payments Made Count', 'Scheme Status', 'Scheme Closure Date'
      ]];

      schemes.forEach(scheme => {
        reportData.push([
          scheme.customerName,
          scheme.id.toUpperCase(),
          formatDate(scheme.startDate),
          scheme.monthlyPaymentAmount,
          scheme.paymentsMadeCount || 0,
          scheme.status,
          scheme.closureDate ? formatDate(scheme.closureDate) : 'N/A'
        ]);
      });
      
      if (reportData.length <= 1) {
        toast({ title: 'No Data', description: 'No schemes found to export for the status report.' });
        setIsExportingSchemeStatus(false);
        return;
      }

      const csvString = arrayToCSV(reportData);
      downloadCSV(csvString, 'scheme_status_report.csv');
      toast({ title: 'Success', description: 'Scheme status report exported successfully.' });

    } catch (error) {
      console.error('Error exporting scheme status report:', error);
      toast({ title: 'Error', description: 'Failed to export scheme status report.', variant: 'destructive' });
    }
    setIsExportingSchemeStatus(false);
  };

  const handleDownloadNewSchemeSample = () => {
    const sampleData: any[][] = [
      ['CustomerName', 'StartDate (YYYY-MM-DD)', 'MonthlyPaymentAmount', 'CustomerGroupName (Optional)', 'CustomerPhone (Optional)', 'CustomerAddress (Optional)'],
      ['John Doe', '2024-01-15', '1000', 'Friends Circle', '9988776655', '123 Main St, Anytown'],
      ['Jane Smith', '2024-02-01', '500', '', '1122334455', ''],
    ];
    const csvString = arrayToCSV(sampleData);
    downloadCSV(csvString, 'sample_new_scheme_import.csv');
  };

  const handleSchemeImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedSchemeImportFile(event.target.files[0]);
      setSchemeImportMessages([]);
    } else {
      setSelectedSchemeImportFile(null);
    }
  };

  const handleImportNewSchemes = async () => {
    if (!selectedSchemeImportFile) {
      toast({ title: 'No File', description: 'Please select a CSV file to import new schemes.', variant: 'destructive' });
      return;
    }
    setIsImportingSchemes(true);
    setSchemeImportMessages([{ type: 'info', content: `Starting import from ${selectedSchemeImportFile.name}...` }]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setSchemeImportMessages(prev => [...prev, { type: 'error', content: 'File is empty or could not be read.' }]);
        setIsImportingSchemes(false);
        return;
      }

      const { headers, rows } = parseCSV(text);
      const expectedHeaders = ['CustomerName', 'StartDate (YYYY-MM-DD)', 'MonthlyPaymentAmount', 'CustomerGroupName (Optional)', 'CustomerPhone (Optional)', 'CustomerAddress (Optional)'];
      const lcExpectedHeaders = expectedHeaders.map(h => h.toLowerCase());
      const lcHeaders = headers.map(h => h.toLowerCase());

      if (!lcExpectedHeaders.every((h, i) => lcHeaders[i] === h)) {
         setSchemeImportMessages(prev => [...prev, { type: 'error', content: `CSV headers do not match. Expected: ${expectedHeaders.join(', ')}` }]);
         setIsImportingSchemes(false);
         return;
      }
      
      let successCount = 0;
      let errorCount = 0;
      const newMessages: ImportMessage[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; 
        
        const customerName = row[0]?.trim();
        const startDateStr = row[1]?.trim();
        const monthlyPaymentAmountStr = row[2]?.trim();
        const customerGroupName = row[3]?.trim() || undefined;
        const customerPhone = row[4]?.trim() || undefined;
        const customerAddress = row[5]?.trim() || undefined;


        if (!customerName || !startDateStr || !monthlyPaymentAmountStr) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Missing required fields (CustomerName, StartDate, MonthlyPaymentAmount). Skipping.` });
          errorCount++;
          continue;
        }
        
        const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
        if (!isValid(startDate)) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Invalid StartDate for '${customerName}'. Skipping.` });
          errorCount++;
          continue;
        }

        const monthlyPaymentAmount = parseFloat(monthlyPaymentAmountStr);
        if (isNaN(monthlyPaymentAmount) || monthlyPaymentAmount <= 0) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Invalid MonthlyPaymentAmount for '${customerName}'. Skipping.` });
          errorCount++;
          continue;
        }

        try {
          addMockScheme({
            customerName,
            startDate: startDate.toISOString(),
            monthlyPaymentAmount,
            customerGroupName,
            customerPhone,
            customerAddress,
          });
          successCount++;
        } catch (err) {
          newMessages.push({ type: 'error', content: `Row ${rowNum}: Error adding scheme for '${customerName}'. ${(err as Error).message}. Skipping.` });
          errorCount++;
        }
      }
      
      newMessages.unshift({ type: 'info', content: `Import finished. ${successCount} schemes imported. ${errorCount} errors.` });
      setSchemeImportMessages(prev => [...prev.slice(0,1), ...newMessages]);
      toast({ title: 'Import Complete', description: `${successCount} new schemes imported. ${errorCount} errors.`});
      setIsImportingSchemes(false);
      setSelectedSchemeImportFile(null); 
    };
    reader.onerror = () => {
      setSchemeImportMessages(prev => [...prev, { type: 'error', content: 'Error reading the file.'}]);
      setIsImportingSchemes(false);
    };
    reader.readAsText(selectedSchemeImportFile);
  };

  const handleDownloadClosureSample = () => {
    const sampleData: any[][] = [
      ['SchemeID', 'MarkAsClosed (TRUE/FALSE)', 'ClosureDate (YYYY-MM-DD, Optional if MarkAsClosed=TRUE)'],
      ['SCHEME1', 'TRUE', '2024-07-20'],
      ['SCHEME2', 'TRUE', ''],
      ['SCHEME3', 'FALSE', ''],
    ];
    const csvString = arrayToCSV(sampleData);
    downloadCSV(csvString, 'sample_scheme_closure_import.csv');
  };

  const handleClosureImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedClosureImportFile(event.target.files[0]);
      setClosureImportMessages([]);
    } else {
      setSelectedClosureImportFile(null);
    }
  };

  const handleImportSchemeClosures = async () => {
    if (!selectedClosureImportFile) {
      toast({ title: 'No File', description: 'Please select a CSV file to import scheme closures.', variant: 'destructive' });
      return;
    }
    setIsImportingClosures(true);
    setClosureImportMessages([{ type: 'info', content: `Starting closure import from ${selectedClosureImportFile.name}...` }]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setClosureImportMessages(prev => [...prev, { type: 'error', content: 'File is empty or could not be read.' }]);
        setIsImportingClosures(false);
        return;
      }

      const { headers, rows } = parseCSV(text);
      const expectedHeaders = ['SchemeID', 'MarkAsClosed (TRUE/FALSE)', 'ClosureDate (YYYY-MM-DD, Optional if MarkAsClosed=TRUE)'];
      const lcExpectedHeaders = expectedHeaders.map(h => h.toLowerCase());
      const lcHeaders = headers.map(h => h.toLowerCase().trim());


      if (!lcExpectedHeaders.every((h, i) => lcHeaders[i] === h)) {
         setClosureImportMessages(prev => [...prev, { type: 'error', content: `CSV headers do not match. Expected: ${expectedHeaders.join(', ')}` }]);
         setIsImportingClosures(false);
         return;
      }

      const dataToImport = rows.map(row => ({
        SchemeID: row[0]?.trim(),
        MarkAsClosed: row[1]?.trim().toUpperCase() as 'TRUE' | 'FALSE' | '',
        ClosureDate: row[2]?.trim(),
      }));
      
      const result: ImportResult = importSchemeClosureUpdates(dataToImport);
      
      const newMessages: ImportMessage[] = result.messages.map(msg => ({ type: msg.includes('Error') || msg.includes('Missing') || msg.includes('not found') ? 'error' : 'info', content: msg }));
      newMessages.unshift({ type: 'info', content: `Closure import finished. ${result.successCount} schemes updated. ${result.errorCount} rows had errors/were skipped.` });
      setClosureImportMessages(prev => [...prev.slice(0,1), ...newMessages]);
      toast({ title: 'Closure Import Complete', description: `${result.successCount} schemes updated. ${result.errorCount} errors.`});
      setIsImportingClosures(false);
      setSelectedClosureImportFile(null); 
    };
    reader.onerror = () => {
      setClosureImportMessages(prev => [...prev, { type: 'error', content: 'Error reading the file.'}]);
      setIsImportingClosures(false);
    };
    reader.readAsText(selectedClosureImportFile);
  };

  const anyOperationInProgress = isExportingCustomers || isExportingTransactions || isExportingComprehensive || isExportingSchemeStatus || isImportingSchemes || isImportingClosures;

  return (
    <div className="flex flex-col gap-8 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Data
          </CardTitle>
          <CardDescription>Download your application data in CSV format.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          <Button 
            onClick={handleExportCustomers} 
            disabled={anyOperationInProgress}
          >
            {isExportingCustomers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Customer List
          </Button>
          <Button 
            onClick={handleExportTransactions} 
            disabled={anyOperationInProgress}
          >
            {isExportingTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Paid Transactions
          </Button>
          <Button 
            onClick={handleExportComprehensiveReport} 
            disabled={anyOperationInProgress}
            className="sm:col-span-1"
          >
            {isExportingComprehensive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Export Comprehensive Report
          </Button>
          <Button 
            onClick={handleExportSchemeStatusReport} 
            disabled={anyOperationInProgress}
            className="sm:col-span-1"
          >
            {isExportingSchemeStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
            Export Scheme Status Report
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Import New Schemes
            </CardTitle>
            <CardDescription>Import multiple new schemes using a CSV file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Button 
                variant="outline" 
                onClick={handleDownloadNewSchemeSample} 
                disabled={anyOperationInProgress}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download New Schemes Sample (CSV)
              </Button>
            </div>
            <div className="space-y-2">
              <label htmlFor="new-scheme-import" className="text-sm font-medium">Upload CSV File</label>
              <Input
                id="new-scheme-import"
                type="file"
                accept=".csv"
                onChange={handleSchemeImportFileChange}
                disabled={anyOperationInProgress}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            <Button 
              onClick={handleImportNewSchemes} 
              disabled={anyOperationInProgress || !selectedSchemeImportFile}
            >
              {isImportingSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Import New Schemes
            </Button>
            {schemeImportMessages.length > 0 && (
              <div className="mt-4 space-y-2 p-3 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-xs">
                <h4 className="font-semibold">Import Log:</h4>
                {schemeImportMessages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-1.5 ${ msg.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {msg.type === 'error' && <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                    <span>{msg.content}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Import Scheme Closure Updates
            </CardTitle>
            <CardDescription>Update existing schemes to 'Completed' status using a CSV file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Button 
                variant="outline" 
                onClick={handleDownloadClosureSample} 
                disabled={anyOperationInProgress}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Closure Sample (CSV)
              </Button>
            </div>
            <div className="space-y-2">
              <label htmlFor="closure-import" className="text-sm font-medium">Upload CSV File</label>
              <Input
                id="closure-import"
                type="file"
                accept=".csv"
                onChange={handleClosureImportFileChange}
                disabled={anyOperationInProgress}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            <Button 
              onClick={handleImportSchemeClosures} 
              disabled={anyOperationInProgress || !selectedClosureImportFile}
            >
              {isImportingClosures ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Import Scheme Closures
            </Button>
             {closureImportMessages.length > 0 && (
              <div className="mt-4 space-y-2 p-3 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-xs">
                <h4 className="font-semibold">Import Log:</h4>
                {closureImportMessages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-1.5 ${ msg.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {msg.type === 'error' && <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                    <span>{msg.content}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type DefaultPaymentModeType = "Cash" | "Card" | "UPI";

function RecommendedSettingsTabContent() {
  const [autoArchive, setAutoArchive] = useState(false);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<DefaultPaymentModeType>("Cash");
  const paymentModeOptions: DefaultPaymentModeType[] = ["Cash", "Card", "UPI"];

  return (
    <div className="space-y-8 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Notification Preferences</CardTitle>
          <CardDescription>Manage how you receive updates and alerts from the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <div>
                <Label htmlFor="notification-sms" className="font-medium">SMS Alerts (Coming Soon)</Label>
                <p className="text-xs text-muted-foreground">Get text message alerts for critical updates.</p>
            </div>
            <Switch id="notification-sms" disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Data & Automation</CardTitle>
          <CardDescription>Configure settings related to data handling and automated tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <div>
              <Label htmlFor="auto-archive" className="font-medium">Auto-Archive Completed Schemes</Label>
              <p className="text-xs text-muted-foreground">Automatically archive schemes 90 days after completion.</p>
            </div>
            <Switch
              id="auto-archive"
              checked={autoArchive}
              onCheckedChange={setAutoArchive}
            />
          </div>
           <div className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <Label className="font-medium block mb-2">Default Payment Mode for New Entries</Label>
            <RadioGroup
              value={defaultPaymentMode}
              onValueChange={(value: DefaultPaymentModeType) => setDefaultPaymentMode(value)}
              className="flex flex-col space-y-2"
            >
              {paymentModeOptions.map((mode) => (
                <div key={mode} className="flex items-center space-x-2">
                  <RadioGroupItem value={mode} id={`pm-${mode}`} />
                  <Label htmlFor={`pm-${mode}`} className="font-normal cursor-pointer">
                    {mode}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Info className="h-3 w-3"/>
                This will pre-select the payment mode when recording new payments.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline">Appearance (Theme)</CardTitle>
            <CardDescription>Theme settings are managed via the theme toggle in the navigation bar.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                You can switch between Light, Dark, and System default themes using the Sun/Moon icon in the top navigation.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-headline font-semibold flex items-center gap-2">
        <SettingsIcon className="h-8 w-8 text-primary" />
        Application Settings
      </h1>
      <Tabs defaultValue="data-management" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="data-management" className="text-base py-2.5">
            <DatabaseZap className="mr-2 h-5 w-5" /> Data Management
          </TabsTrigger>
          <TabsTrigger value="recommended-settings" className="text-base py-2.5">
            <SlidersHorizontal className="mr-2 h-5 w-5" /> App Preferences
          </TabsTrigger>
        </TabsList>
        <TabsContent value="data-management">
          <DataManagementTabContent />
        </TabsContent>
        <TabsContent value="recommended-settings">
          <RecommendedSettingsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

