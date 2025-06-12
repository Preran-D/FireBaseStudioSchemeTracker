'use client';

import { useEffect, useState, useMemo } from 'react';
import { getMockSchemes } from '@/lib/mock-data';
import type { Scheme, SchemeStatus } from '@/types/scheme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileText as FileTextIcon, Search, Download } from 'lucide-react'; // Using FileTextIcon alias for clarity
import { exportCustomerReportsToPdf } from '@/lib/pdfUtils'; // Import the new PDF export function
import { useToast } from '@/hooks/use-toast'; // Import useToast
import ExportPdfDialog from '@/components/dialogs/ExportPdfDialog';

// Define a structure for customer-centric data
export interface CustomerReportData {
  customerId: string; // Using customerName as ID for this mock setup
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  groups: string[];
  schemesSummary: {
    totalSchemes: number;
    activeSchemes: number;
    completedSchemes: number;
    closedSchemes: number;
    overdueSchemes: number;
    totalCollected: number;
  };
  detailedSchemes: Scheme[];
}

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allCustomersData, setAllCustomersData] = useState<CustomerReportData[]>([]);
  const [displayedCustomers, setDisplayedCustomers] = useState<CustomerReportData[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportPdfDialogOpen, setIsExportPdfDialogOpen] = useState(false); // State for the export dialog
  const { toast } = useToast(); // Initialize useToast

  useEffect(() => {
    setIsLoading(true);
    const schemes = getMockSchemes({ includeArchived: false });

    const customerMap = new Map<string, CustomerReportData>();

    schemes.forEach(scheme => {
      let customerEntry = customerMap.get(scheme.customerName);
      if (!customerEntry) {
        customerEntry = {
          customerId: scheme.customerName, // Using name as ID
          customerName: scheme.customerName,
          customerPhone: scheme.customerPhone,
          customerAddress: scheme.customerAddress,
          groups: [],
          schemesSummary: {
            totalSchemes: 0,
            activeSchemes: 0,
            completedSchemes: 0,
            closedSchemes: 0,
            overdueSchemes: 0,
            totalCollected: 0,
          },
          detailedSchemes: [],
        };
      }

      customerEntry.detailedSchemes.push(scheme);
      customerEntry.schemesSummary.totalSchemes++;
      customerEntry.schemesSummary.totalCollected += scheme.totalCollected || 0;

      if (scheme.status === 'Active') customerEntry.schemesSummary.activeSchemes++;
      if (scheme.status === 'Fully Paid') customerEntry.schemesSummary.completedSchemes++;
      if (scheme.status === 'Closed') customerEntry.schemesSummary.closedSchemes++;
      if (scheme.status === 'Overdue') customerEntry.schemesSummary.overdueSchemes++;

      if (scheme.customerGroupName && !customerEntry.groups.includes(scheme.customerGroupName)) {
        customerEntry.groups.push(scheme.customerGroupName);
      }

      // Update phone/address if current scheme has more info than previous
      if (scheme.customerPhone && !customerEntry.customerPhone) customerEntry.customerPhone = scheme.customerPhone;
      if (scheme.customerAddress && !customerEntry.customerAddress) customerEntry.customerAddress = scheme.customerAddress;

      customerMap.set(scheme.customerName, customerEntry);
    });

    const processedData = Array.from(customerMap.values()).sort((a,b) => a.customerName.localeCompare(b.customerName));
    setAllCustomersData(processedData);
    setDisplayedCustomers(processedData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = allCustomersData.filter(customer =>
      customer.customerName.toLowerCase().includes(lowerSearchTerm)
    );
    setDisplayedCustomers(filtered);
    setSelectedCustomerIds([]); // Clear selection on search
  }, [searchTerm, allCustomersData]);

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    setSelectedCustomerIds(prev =>
      checked ? [...prev, customerId] : prev.filter(id => id !== customerId)
    );
  };

  const handleSelectAllCustomers = (checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds(displayedCustomers.map(c => c.customerId));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const isAllDisplayedSelected = displayedCustomers.length > 0 && selectedCustomerIds.length === displayedCustomers.length;

  const handleExportCustomerPdf = () => {
    if (selectedCustomerIds.length === 0) {
      toast({
        title: "No Customers Selected",
        description: "Please select at least one customer to export their report.",
        variant: "default", // Or "warning" if you have one
      });
      return;
    }
    // Open the dialog
    setIsExportPdfDialogOpen(true);
  };

  const handleConfirmExportCustomerPdf = async (exportType: 'condensed' | 'detailed') => {
    setIsExportingPdf(true);
    setIsExportPdfDialogOpen(false); // Close dialog

    const customersToExport = allCustomersData.filter(c => selectedCustomerIds.includes(c.customerId));

    try {
      // Brief delay to allow UI to update (dialog close, button loader)
      await new Promise(resolve => setTimeout(resolve, 100));

      await exportCustomerReportsToPdf(customersToExport, exportType); // Pass exportType
      toast({
        title: "PDF Export Successful",
        description: `${exportType.charAt(0).toUpperCase() + exportType.slice(1)} report for ${customersToExport.length} customer(s) is being downloaded.`,
      });
    } catch (error) {
      console.error("Failed to export customer reports to PDF:", error);
      toast({
        title: "PDF Export Failed",
        description: `An error occurred while generating the ${exportType} PDF.`,
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading customer data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center">
          <FileTextIcon className="mr-3 h-8 w-8 text-primary" />
          Customer Reports
        </h1>
        <Button
          onClick={handleExportCustomerPdf} // This now opens the dialog
          disabled={selectedCustomerIds.length === 0 || isExportingPdf}
          size="lg"
        >
          {isExportingPdf ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
          Export Selected to PDF ({selectedCustomerIds.length})
        </Button>
      </div>

      <ExportPdfDialog
        isOpen={isExportPdfDialogOpen}
        onOpenChange={setIsExportPdfDialogOpen}
        onExport={handleConfirmExportCustomerPdf}
        isExporting={isExportingPdf}
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Filter Customers</CardTitle>
          <CardDescription>Search for customers by name and select them for PDF export.</CardDescription>
           <div className="mt-4 max-w-md">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by customer name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-10 rounded-lg"
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayedCustomers.length === 0 && !isLoading && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-lg">{searchTerm ? "No customers match your search." : "No customer data available."}</p>
            </div>
          )}
          {displayedCustomers.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllDisplayedSelected}
                        onCheckedChange={handleSelectAllCustomers}
                        aria-label="Select all displayed customers"
                        disabled={displayedCustomers.length === 0}
                      />
                    </TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Groups</TableHead>
                    <TableHead className="text-center">Total Schemes</TableHead>
                    <TableHead className="text-center">Active Schemes</TableHead>
                    <TableHead className="text-right">Total Collected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedCustomers.map((customer) => (
                    <TableRow key={customer.customerId} data-state={selectedCustomerIds.includes(customer.customerId) ? 'selected' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCustomerIds.includes(customer.customerId)}
                          onCheckedChange={(checked) => handleSelectCustomer(customer.customerId, !!checked)}
                          aria-label={`Select customer ${customer.customerName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{customer.customerName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{customer.groups.join(', ') || 'N/A'}</TableCell>
                      <TableCell className="text-center">{customer.schemesSummary.totalSchemes}</TableCell>
                      <TableCell className="text-center">{customer.schemesSummary.activeSchemes}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(customer.schemesSummary.totalCollected)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
