
'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Settings as SettingsIcon, SlidersHorizontal, Info, DatabaseZap, FileSpreadsheet, UploadCloud, FileText, AlertCircle } from 'lucide-react';
import { getMockSchemes, getGroupDetails } from '@/lib/mock-data';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelUtils';
import { processImportData } from '@/lib/importUtils'; // New import
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // New import
import { ScrollArea } from "@/components/ui/scroll-area"; // New import
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


function DataManagementTabContent() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImportSectionVisible, setIsImportSectionVisible] = useState(false);
  const [importPastedData, setImportPastedData] = useState('');
  const [isImportProcessing, setIsImportProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{ successCount: number; errorCount: number; messages: string[] } | null>(null);


  const handleExportAllToExcel = () => {
    setIsExporting(true);
    try {
      const schemes = getMockSchemes();
      const schemesSheetData: any[][] = [[
        'Scheme ID', 'Customer Name', 'Group Name', 'Phone', 'Address',
        'Start Date', 'Monthly Amount', 'Duration (Months)', 'Status', 'Closure Date',
        'Total Collected', 'Total Remaining', 'Payments Made Count'
      ]];
      schemes.forEach(s => {
        schemesSheetData.push([
          s.id.toUpperCase(),
          s.customerName,
          s.customerGroupName || 'N/A',
          s.customerPhone || 'N/A',
          s.customerAddress || 'N/A',
          formatDate(s.startDate),
          s.monthlyPaymentAmount,
          s.durationMonths,
          s.status,
          s.closureDate ? formatDate(s.closureDate) : 'N/A',
          s.totalCollected || 0,
          s.totalRemaining || 0,
          s.paymentsMadeCount || 0
        ]);
      });

      const paymentsSheetData: any[][] = [[
        'Payment ID', 'Scheme ID', 'Customer Name', 'Month #', 'Due Date',
        'Payment Date', 'Amount Expected', 'Amount Paid', 'Mode of Payment', 'Payment Status'
      ]];
      schemes.forEach(s => {
        s.payments.forEach(p => {
          paymentsSheetData.push([
            p.id,
            s.id.toUpperCase(),
            s.customerName,
            p.monthNumber,
            formatDate(p.dueDate),
            p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
            p.amountExpected,
            p.amountPaid !== undefined ? p.amountPaid : 'N/A',
            p.modeOfPayment?.join(' | ') || 'N/A',
            getPaymentStatus(p, s.startDate)
          ]);
        });
      });

      const customerMap = new Map<string, { name: string, phone: string, address: string, groups: Set<string> }>();
      schemes.forEach(s => {
        if (!customerMap.has(s.customerName)) {
          customerMap.set(s.customerName, {
            name: s.customerName,
            phone: s.customerPhone || 'N/A',
            address: s.customerAddress || 'N/A',
            groups: new Set<string>()
          });
        }
        const customerEntry = customerMap.get(s.customerName)!;
        if (s.customerGroupName) customerEntry.groups.add(s.customerGroupName);
        if (s.customerPhone && customerEntry.phone === 'N/A') customerEntry.phone = s.customerPhone;
        if (s.customerAddress && customerEntry.address === 'N/A') customerEntry.address = s.customerAddress;
      });
      const customersSheetData: any[][] = [['Customer Name', 'Phone', 'Address', 'Associated Groups']];
      customerMap.forEach(c => {
        customersSheetData.push([
          c.name,
          c.phone,
          c.address,
          Array.from(c.groups).join(' | ') || 'N/A'
        ]);
      });

      const groups = getGroupDetails();
      const groupsSheetData: any[][] = [['Group Name', 'Number of Customers', 'Number of Schemes', 'Customer Names']];
      groups.forEach(g => {
        groupsSheetData.push([
          g.groupName,
          g.customerNames.length,
          g.totalSchemesInGroup,
          g.customerNames.join(' | ')
        ]);
      });

      exportToExcel([
        { name: 'Schemes', data: schemesSheetData.length > 1 ? schemesSheetData : [['No scheme data to export']] },
        { name: 'Payments', data: paymentsSheetData.length > 1 ? paymentsSheetData : [['No payment data to export']] },
        { name: 'Customers', data: customersSheetData.length > 1 ? customersSheetData : [['No customer data to export']] },
        { name: 'Groups', data: groupsSheetData.length > 1 ? groupsSheetData : [['No group data to export']] }
      ], 'scheme_tracker_all_data');

      toast({ title: 'Success', description: 'All data exported to Excel successfully.' });
    } catch (error) {
      console.error('Error exporting all data to Excel:', error);
      toast({ title: 'Error', description: 'Failed to export data to Excel.', variant: 'destructive' });
    }
    setIsExporting(false);
  };

  const handleProcessImport = () => {
    if (!importPastedData.trim()) {
      toast({ title: 'No Data', description: 'Please paste data into the text area.', variant: 'destructive' });
      return;
    }
    setIsImportProcessing(true);
    setImportResults(null); // Clear previous results
    
    // Simulate async operation for UX
    setTimeout(() => {
      const results = processImportData(importPastedData);
      setImportResults(results);
      setIsImportProcessing(false);
      if (results.successCount > 0 && results.errorCount === 0) {
        toast({ title: 'Import Successful', description: `${results.successCount} schemes imported successfully.` });
      } else if (results.successCount > 0 && results.errorCount > 0) {
        toast({ title: 'Import Partially Successful', description: `${results.successCount} schemes imported, ${results.errorCount} errors. Check details below.`, variant: 'default' });
      } else if (results.errorCount > 0) {
        toast({ title: 'Import Failed', description: `${results.errorCount} errors occurred. Check details below.`, variant: 'destructive' });
      } else {
         toast({ title: 'Import Complete', description: 'No schemes were imported. Check logs if data was provided.', variant: 'default' });
      }
      // Optionally clear data or hide section
      // setImportPastedData('');
      // setIsImportSectionVisible(false);
    }, 500);
  };

  const cancelImport = () => {
    setIsImportSectionVisible(false);
    setImportPastedData('');
    setImportResults(null);
  };


  return (
    <div className="flex flex-col gap-8 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Export All Data to Excel
          </CardTitle>
          <CardDescription>
            Download a single Excel (.xlsx) file containing all your application data, organized into separate sheets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportAllToExcel}
            disabled={isExporting || isImportProcessing}
            className="w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export All Data (.xlsx)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Bulk Import Schemes
          </CardTitle>
          <CardDescription>
            Import multiple schemes by pasting data from a spreadsheet (e.g., Excel, Google Sheets).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isImportSectionVisible ? (
            <Button
              onClick={() => setIsImportSectionVisible(true)}
              disabled={isExporting || isImportProcessing}
              className="w-full sm:w-auto"
            >
              <FileText className="mr-2 h-4 w-4" /> Show Import Form
            </Button>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-1">Instructions:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Paste data from your spreadsheet. Data should be comma-separated (CSV) or tab-separated (TSV).</li>
                  <li>The expected columns are, in order:
                    <ol className="list-decimal list-inside pl-4 mt-1">
                        <li><strong>Customer Name</strong> (Required)</li>
                        <li><strong>Group Name</strong> (Optional)</li>
                        <li><strong>Phone</strong> (Optional)</li>
                        <li><strong>Address</strong> (Optional)</li>
                        <li><strong>Start Date</strong> (Required, format: YYYY-MM-DD)</li>
                        <li><strong>Monthly Payment Amount</strong> (Required, numeric)</li>
                        <li><strong>Number of Initial Payments Paid</strong> (Optional, numeric, defaults to 0)</li>
                    </ol>
                  </li>
                  <li>Do not include a header row in the pasted data.</li>
                  <li>Schemes are assumed to be for 12 months.</li>
                </ul>
              </div>
              <Label htmlFor="import-data-textarea">Paste Scheme Data Here:</Label>
              <Textarea
                id="import-data-textarea"
                value={importPastedData}
                onChange={(e) => setImportPastedData(e.target.value)}
                placeholder="John Doe,Alpha Group,1234567890,1 Test St,2023-01-15,1000,2..."
                rows={10}
                disabled={isImportProcessing}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleProcessImport}
                  disabled={isImportProcessing || !importPastedData.trim()}
                >
                  {isImportProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Process Import
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelImport}
                  disabled={isImportProcessing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {importResults && isImportSectionVisible && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Import Results
            </CardTitle>
            <CardDescription>
              Successfully imported: {importResults.successCount} | Errors: {importResults.errorCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importResults.messages.length > 0 ? (
              <ScrollArea className="h-60 w-full rounded-md border p-3 text-sm">
                {importResults.messages.map((msg, index) => (
                  <p key={index} className={`mb-1 ${msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') ? 'text-destructive' : msg.toLowerCase().includes('info') ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {msg.startsWith('Row') && <AlertCircle className="inline h-3.5 w-3.5 mr-1.5 relative -top-px" />}
                    {msg}
                  </p>
                ))}
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground">No messages from the import process.</p>
            )}
          </CardContent>
        </Card>
      )}
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
              onValueChange={(value: string) => setDefaultPaymentMode(value as DefaultPaymentModeType)}
              className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0"
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
