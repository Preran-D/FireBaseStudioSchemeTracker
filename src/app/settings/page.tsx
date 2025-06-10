
'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// Input is removed as we are removing import functionality for now
// import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, /*FileUp, FileSpreadsheet, AlertTriangle, FileText, Activity,*/ Settings as SettingsIcon, SlidersHorizontal, Info, DatabaseZap } from 'lucide-react';
import { getMockSchemes, getGroupDetails } from '@/lib/mock-data'; // getGroupDetails is needed
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme'; // GroupDetail is needed
import { arrayToCSV, downloadCSV } from '@/lib/csvUtils';
import { formatDate, formatCurrency, getPaymentStatus, getSchemeStatus, calculateSchemeTotals } from '@/lib/utils';
// isValid, parse, formatISO from date-fns are removed as import logic is removed
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// ImportMessage and ImportResult interfaces are removed as import functionality is removed

function DataManagementTabContent() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false); // Single state for any export operation

  const handleExportSchemesCSV = () => {
    setIsExporting(true);
    try {
      const schemes = getMockSchemes();
      const dataToExport: any[][] = [[
        'Scheme ID', 'Customer Name', 'Group Name', 'Phone', 'Address', 
        'Start Date', 'Monthly Amount', 'Duration (Months)', 'Status', 'Closure Date',
        'Total Collected', 'Total Remaining', 'Payments Made Count'
      ]];
      schemes.forEach(s => {
        dataToExport.push([
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
      const csvString = arrayToCSV(dataToExport);
      downloadCSV(csvString, 'schemes_data.csv');
      toast({ title: 'Success', description: 'Schemes data exported successfully.' });
    } catch (error) {
      console.error('Error exporting schemes data:', error);
      toast({ title: 'Error', description: 'Failed to export schemes data.', variant: 'destructive' });
    }
    setIsExporting(false);
  };

  const handleExportPaymentsCSV = () => {
    setIsExporting(true);
    try {
      const schemes = getMockSchemes();
      const dataToExport: any[][] = [[
        'Payment ID', 'Scheme ID', 'Customer Name', 'Month #', 'Due Date', 
        'Payment Date', 'Amount Expected', 'Amount Paid', 'Mode of Payment', 'Payment Status'
      ]];
      schemes.forEach(s => {
        s.payments.forEach(p => {
          dataToExport.push([
            p.id,
            s.id.toUpperCase(),
            s.customerName,
            p.monthNumber,
            formatDate(p.dueDate),
            p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
            p.amountExpected,
            p.amountPaid !== undefined ? p.amountPaid : 'N/A',
            p.modeOfPayment?.join(' | ') || 'N/A',
            getPaymentStatus(p, s.startDate) // Ensure current status
          ]);
        });
      });
      if (dataToExport.length <= 1) {
        toast({ title: 'No Data', description: 'No payment data found to export.' });
      } else {
        const csvString = arrayToCSV(dataToExport);
        downloadCSV(csvString, 'payments_data.csv');
        toast({ title: 'Success', description: 'Payments data exported successfully.' });
      }
    } catch (error) {
      console.error('Error exporting payments data:', error);
      toast({ title: 'Error', description: 'Failed to export payments data.', variant: 'destructive' });
    }
    setIsExporting(false);
  };

  const handleExportCustomersCSV = () => {
    setIsExporting(true);
    try {
      const schemes = getMockSchemes();
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
        // Prefer non-N/A values if encountered later
        if (s.customerPhone && customerEntry.phone === 'N/A') customerEntry.phone = s.customerPhone;
        if (s.customerAddress && customerEntry.address === 'N/A') customerEntry.address = s.customerAddress;
      });

      const dataToExport: any[][] = [['Customer Name', 'Phone', 'Address', 'Associated Groups']];
      customerMap.forEach(c => {
        dataToExport.push([
          c.name,
          c.phone,
          c.address,
          Array.from(c.groups).join(' | ') || 'N/A'
        ]);
      });
      
      if (dataToExport.length <= 1) {
        toast({ title: 'No Data', description: 'No customer data found to export.' });
      } else {
        const csvString = arrayToCSV(dataToExport);
        downloadCSV(csvString, 'customers_data.csv');
        toast({ title: 'Success', description: 'Customers data exported successfully.' });
      }
    } catch (error) {
      console.error('Error exporting customers data:', error);
      toast({ title: 'Error', description: 'Failed to export customers data.', variant: 'destructive' });
    }
    setIsExporting(false);
  };

  const handleExportGroupsCSV = () => {
    setIsExporting(true);
    try {
      const groups = getGroupDetails();
      const dataToExport: any[][] = [['Group Name', 'Number of Customers', 'Number of Schemes', 'Customer Names']];
      groups.forEach(g => {
        dataToExport.push([
          g.groupName,
          g.customerNames.length,
          g.totalSchemesInGroup,
          g.customerNames.join(' | ')
        ]);
      });
      if (dataToExport.length <= 1) {
        toast({ title: 'No Data', description: 'No group data found to export.' });
      } else {
        const csvString = arrayToCSV(dataToExport);
        downloadCSV(csvString, 'groups_data.csv');
        toast({ title: 'Success', description: 'Groups data exported successfully.' });
      }
    } catch (error) {
      console.error('Error exporting groups data:', error);
      toast({ title: 'Error', description: 'Failed to export groups data.', variant: 'destructive' });
    }
    setIsExporting(false);
  };

  return (
    <div className="flex flex-col gap-8 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Data as CSV
          </CardTitle>
          <CardDescription>
            Download different categories of your application data. Each button will generate a separate CSV file.
            A single CSV file cannot contain multiple tabs; for that, an Excel (.xlsx) file would be needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          <Button 
            onClick={handleExportSchemesCSV} 
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Schemes Data
          </Button>
          <Button 
            onClick={handleExportPaymentsCSV} 
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Payments Data
          </Button>
          <Button 
            onClick={handleExportCustomersCSV} 
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Customers Data
          </Button>
          <Button 
            onClick={handleExportGroupsCSV} 
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Groups Data
          </Button>
        </CardContent>
      </Card>
      
      {/* Removed all import sections */}
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
