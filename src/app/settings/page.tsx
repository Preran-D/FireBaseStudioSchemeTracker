
'use client';

import { useState, type ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Settings as SettingsIcon, SlidersHorizontal, Info, DatabaseZap, FileSpreadsheet, UploadCloud, FileText, AlertCircle, Trash2, PlusCircle, CalendarIcon, FileUp } from 'lucide-react';
import { getMockSchemes, getGroupDetails, addMockScheme, updateMockSchemePayment, getUniqueGroupNames } from '@/lib/mock-data';
import type { Scheme, PaymentMode, GroupDetail, Payment } from '@/types/scheme';
import { formatDate, formatCurrency, getPaymentStatus, generateId } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelUtils';
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatISO, format as formatDateFns, parseISO, isValid as isValidDate } from 'date-fns';

interface ImportUIRow {
  id: string;
  customerName: string;
  groupName: string;
  phone: string;
  address: string;
  startDate: Date | undefined;
  monthlyPaymentAmount: string;
  initialPaymentsPaid: string;
}

function DataManagementTabContent() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImportSectionVisible, setIsImportSectionVisible] = useState(false);
  
  const [importRows, setImportRows] = useState<ImportUIRow[]>([]);
  const [isImportProcessing, setIsImportProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{ successCount: number; errorCount: number; messages: string[] } | null>(null);
  const [existingGroupNamesForImport, setExistingGroupNamesForImport] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isImportSectionVisible) {
      setExistingGroupNamesForImport(getUniqueGroupNames());
    }
  }, [isImportSectionVisible]);

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

  const handleAddImportRow = () => {
    setImportRows(prevRows => [
      ...prevRows,
      {
        id: generateId(),
        customerName: '',
        groupName: '',
        phone: '',
        address: '',
        startDate: undefined,
        monthlyPaymentAmount: '',
        initialPaymentsPaid: '0',
      }
    ]);
  };

  const handleRemoveImportRow = (id: string) => {
    setImportRows(prevRows => prevRows.filter(row => row.id !== id));
  };

  const handleImportRowChange = (id: string, field: keyof Omit<ImportUIRow, 'id'>, value: string | Date | undefined) => {
    setImportRows(prevRows =>
      prevRows.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImportProcessing(true);
    setImportResults(null); // Clear previous results
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 }); // Read as array of arrays

        if (jsonData.length < 1) {
            toast({ title: "Empty Excel File", description: "The Excel file appears to be empty or has no data in the first sheet.", variant: "destructive"});
            setImportRows([]);
            setIsImportProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        
        const headers = (jsonData[0] as Array<any>).map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, ' '));
        const expectedHeaders = ["customer name", "group name", "phone", "address", "start date (yyyy-mm-dd)", "monthly payment amount", "initial payments paid (0-12)"];
        
        const colMap: Record<string, number> = {};
        expectedHeaders.forEach(eh => {
            const idx = headers.indexOf(eh);
            if(idx !== -1) colMap[eh] = idx;
        });

        // Check for mandatory headers
        if (colMap["customer name"] === undefined || colMap["start date (yyyy-mm-dd)"] === undefined || colMap["monthly payment amount"] === undefined) {
            toast({ title: "Missing Mandatory Columns", description: "Excel file must contain 'Customer Name', 'Start Date (YYYY-MM-DD)', and 'Monthly Payment Amount' columns.", variant: "destructive", duration: 7000});
            setImportRows([]);
            setIsImportProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }


        const newImportRows: ImportUIRow[] = jsonData.slice(1).map((excelRowArray, index): ImportUIRow | null => {
          const excelRow = excelRowArray as Array<any>;
          const customerName = String(excelRow[colMap["customer name"]] || '').trim();
          let startDateRaw = excelRow[colMap["start date (yyyy-mm-dd)"]];
          let startDate: Date | undefined = undefined;
          
          if (!customerName) {
            // If customer name is missing for a row, we might skip it or mark for user to fix later.
            // For now, let's skip with a general message after processing if some rows are bad.
            return null; 
          }
          
          if (startDateRaw) {
            if (startDateRaw instanceof Date && isValidDate(startDateRaw)) {
              startDate = startDateRaw;
            } else if (typeof startDateRaw === 'string') {
              const parsedDate = parseISO(startDateRaw.trim());
              if (isValidDate(parsedDate)) startDate = parsedDate;
            } else if (typeof startDateRaw === 'number') { // Excel date serial number
              const dateInfo = XLSX.SSF.parse_date_code(startDateRaw);
              if (dateInfo) {
                 startDate = new Date(dateInfo.y, dateInfo.m - 1, dateInfo.d, dateInfo.H, dateInfo.M, dateInfo.S);
                 if (!isValidDate(startDate)) startDate = undefined;
              }
            }
          }

          const monthlyAmountStr = String(excelRow[colMap["monthly payment amount"]] || '').trim();
          const initialPaymentsStr = String(excelRow[colMap["initial payments paid (0-12)"]] || '0').trim();

          return {
            id: generateId(),
            customerName: customerName,
            groupName: String(excelRow[colMap["group name"]] || '').trim(),
            phone: String(excelRow[colMap["phone"]] || '').trim(),
            address: String(excelRow[colMap["address"]] || '').trim(),
            startDate: startDate,
            monthlyPaymentAmount: monthlyAmountStr,
            initialPaymentsPaid: initialPaymentsStr,
          };
        }).filter(row => row !== null && row.customerName) as ImportUIRow[];


        if (newImportRows.length === 0 && jsonData.length > 1) {
             toast({ title: "No Valid Data Rows", description: "No valid data rows could be processed from the Excel file. Please check column names and data.", variant: "destructive", duration: 7000 });
        } else if (newImportRows.length > 0) {
             toast({ title: "Excel File Processed", description: `${newImportRows.length} rows loaded into the table for review. Please verify and click "Process Import".` });
        } else {
             toast({ title: "No Data Loaded", description: "No data was loaded from the Excel file.", variant: "default" });
        }
        setImportRows(newImportRows);

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ title: "Error Parsing File", description: "Could not parse the Excel file. Ensure it's a valid .xlsx format and structure.", variant: "destructive" });
        setImportRows([]);
      } finally {
        setIsImportProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; 
        }
      }
    };
    reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
        setIsImportProcessing(false);
         if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadSampleExcel = () => {
    const headers = ["Customer Name", "Group Name", "Phone", "Address", "Start Date (YYYY-MM-DD)", "Monthly Payment Amount", "Initial Payments Paid (0-12)"];
    const exampleRow = ["John Sample", "Alpha Group", "9988776655", "123 Main St, Anytown", "2024-08-01", "1000", "1"];
    const data = [headers, exampleRow];
    
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, 
        { wch: 20 }, { wch: 20 }, { wch: 20 } 
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schemes Import");
    XLSX.writeFile(workbook, "Scheme_Import_Sample.xlsx");
    toast({title: "Sample File Downloaded", description: "Scheme_Import_Sample.xlsx has been downloaded."});
  };


  const handleProcessImportFromUI = async () => {
    if (importRows.length === 0) {
      toast({ title: 'No Data', description: 'Please add at least one scheme to import, either manually or by uploading an Excel file.', variant: 'destructive' });
      return;
    }
    setIsImportProcessing(true);
    setImportResults(null); // Clear previous results
    const localResults: { successCount: number; errorCount: number; messages: string[] } = {
      successCount: 0,
      errorCount: 0,
      messages: [],
    };
    const processedCustomerNamesInThisBatch = new Set<string>();

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      const rowNumForMsg = `Row ${i + 1} (Table)`;
      const customerNameForProcessing = row.customerName.trim();

      if (!customerNameForProcessing) {
        localResults.messages.push(`${rowNumForMsg}: Customer Name is required. Skipping.`);
        localResults.errorCount++;
        continue; 
      }

      const lowerCaseCustomerName = customerNameForProcessing.toLowerCase();
      if (processedCustomerNamesInThisBatch.has(lowerCaseCustomerName)) {
        localResults.messages.push(`${rowNumForMsg}: Customer Name "${customerNameForProcessing}" is a duplicate within this import batch. Skipping.`);
        localResults.errorCount++;
        continue; 
      }
      // Only add to set if it's not a duplicate *so far*. Other validations might still make it fail.
      // The purpose of this set is to prevent multiple attempts for the same name *within this batch*.
      processedCustomerNamesInThisBatch.add(lowerCaseCustomerName);

      if (!row.startDate || !isValidDate(row.startDate)) {
        localResults.messages.push(`${rowNumForMsg}: Start Date is required and must be valid for "${customerNameForProcessing}". Skipping.`);
        localResults.errorCount++;
        continue;
      }
      const monthlyAmount = parseFloat(row.monthlyPaymentAmount);
      if (isNaN(monthlyAmount) || monthlyAmount <= 0) {
        localResults.messages.push(`${rowNumForMsg}: Monthly Payment Amount for "${customerNameForProcessing}" must be a positive number. Skipping.`);
        localResults.errorCount++;
        continue;
      }
      const initialPayments = parseInt(row.initialPaymentsPaid, 10);
      if (isNaN(initialPayments) || initialPayments < 0 || initialPayments > 12) {
        localResults.messages.push(`${rowNumForMsg}: Initial Payments Paid for "${customerNameForProcessing}" must be a number between 0 and 12. Skipping.`);
        localResults.errorCount++;
        continue;
      }

      try {
        const newSchemeData = {
          customerName: customerNameForProcessing,
          customerGroupName: row.groupName.trim() || undefined,
          customerPhone: row.phone.trim() || undefined,
          customerAddress: row.address.trim() || undefined,
          startDate: formatISO(row.startDate),
          monthlyPaymentAmount: monthlyAmount,
        };
        const createdScheme = addMockScheme(newSchemeData);
        if (!createdScheme) {
          localResults.messages.push(`${rowNumForMsg}: Failed to create scheme for "${customerNameForProcessing}". This could be due to an internal issue or if the customer name already exists globally with different details.`);
          localResults.errorCount++;
          continue; // Skip payment processing for this failed scheme
        }
        localResults.messages.push(`${rowNumForMsg}: Successfully created scheme for "${createdScheme.customerName}" (ID: ${createdScheme.id.toUpperCase()}).`);
        
        let recordedInitialPaymentsCount = 0;
        if (initialPayments > 0 && createdScheme.payments.length > 0) {
          let schemeForPaymentRecording: Scheme | undefined = createdScheme;
          for (let j = 0; j < initialPayments; j++) {
            if (schemeForPaymentRecording && j < schemeForPaymentRecording.payments.length) {
              const paymentToUpdate = schemeForPaymentRecording.payments[j];
              const paymentStatus = getPaymentStatus(paymentToUpdate, schemeForPaymentRecording.startDate);

              if (paymentStatus !== 'Paid') {
                const updatedSchemeResult = updateMockSchemePayment(schemeForPaymentRecording.id, paymentToUpdate.id, {
                  paymentDate: schemeForPaymentRecording.startDate, // Initial payments are recorded on scheme start date
                  amountPaid: schemeForPaymentRecording.monthlyPaymentAmount,
                  modeOfPayment: ['Imported'] as PaymentMode[],
                });

                if (updatedSchemeResult) {
                  recordedInitialPaymentsCount++;
                  schemeForPaymentRecording = updatedSchemeResult; // Use the updated scheme for the next payment iteration
                } else {
                  localResults.messages.push(`${rowNumForMsg}: Error recording initial payment ${j + 1} for scheme ${createdScheme.id.toUpperCase()}.`);
                  break; 
                }
              } else {
                 recordedInitialPaymentsCount++; // Count already paid initial months as successfully "processed"
              }
            } else {
              localResults.messages.push(`${rowNumForMsg}: Attempted to record more initial payments (${initialPayments}) than available months (${createdScheme.payments.length}) for scheme ${createdScheme.id.toUpperCase()}.`);
              break;
            }
          }
          if (recordedInitialPaymentsCount > 0) {
            localResults.messages.push(`${rowNumForMsg}: Recorded/confirmed ${recordedInitialPaymentsCount} initial payment(s) for scheme ${createdScheme.id.toUpperCase()}.`);
          }
        }
        localResults.successCount++;
      } catch (error: any) {
        localResults.messages.push(`${rowNumForMsg}: Error processing scheme for "${customerNameForProcessing}": ${error.message || 'Unknown error'}. Skipping.`);
        localResults.errorCount++;
      }
    }

    setImportResults(localResults);
    if (localResults.successCount > 0 && localResults.errorCount === 0) {
      toast({ title: 'Import Successful', description: `${localResults.successCount} schemes imported successfully.` });
      setImportRows([]); 
    } else if (localResults.successCount > 0 && localResults.errorCount > 0) {
      toast({ title: 'Import Partially Successful', description: `${localResults.successCount} schemes imported, ${localResults.errorCount} errors/skipped. Check results below.`, variant: 'default', duration: 10000 });
    } else if (localResults.errorCount > 0) {
      toast({ title: 'Import Failed', description: `${localResults.errorCount} errors/skipped rows. Check results below.`, variant: 'destructive', duration: 10000 });
    } else { // Only if importRows was not empty but nothing was processed.
      toast({ title: 'Import Complete', description: 'No schemes were processed (possibly all rows had issues or were empty).', variant: 'default' });
    }
    setIsImportProcessing(false);
    setExistingGroupNamesForImport(getUniqueGroupNames()); // Refresh group names in case new ones were added
  };

  const cancelImport = () => {
    setIsImportSectionVisible(false);
    setImportRows([]);
    setImportResults(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
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
            Upload an Excel file or manually add scheme details in the table below for bulk import. Only unique customer names per batch will be processed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isImportSectionVisible ? (
            <Button
              onClick={() => {
                setIsImportSectionVisible(true);
                if(importRows.length === 0) handleAddImportRow(); 
                setExistingGroupNamesForImport(getUniqueGroupNames());
                setImportResults(null); // Clear previous results when showing section
              }}
              disabled={isExporting || isImportProcessing}
              className="w-full sm:w-auto"
            >
              <FileText className="mr-2 h-4 w-4" /> Show Import Table / Upload
            </Button>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div>
                    <Label htmlFor="excel-upload" className="text-sm font-medium">Upload Excel File (.xlsx)</Label>
                    <Input
                        id="excel-upload"
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleFileChange}
                        className="mt-1 max-w-xs text-sm"
                        disabled={isImportProcessing}
                        ref={fileInputRef}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Overrides current table data. Uses first sheet.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleDownloadSampleExcel}
                    disabled={isImportProcessing}
                    size="sm"
                    className="mt-4 sm:mt-6"
                >
                    <Download className="mr-2 h-4 w-4" /> Download Sample.xlsx
                </Button>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-md font-medium mb-2">Or, Add/Edit Schemes Manually:</h3>
                {importRows.length > 0 && (
                  <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                    <Table className="min-w-[1200px]"> 
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-2 py-2 w-[180px] sticky left-0 bg-background z-10">Customer Name*</TableHead>
                          <TableHead className="px-2 py-2 w-[150px]">Group Name</TableHead>
                          <TableHead className="px-2 py-2 w-[120px]">Phone</TableHead>
                          <TableHead className="px-2 py-2 w-[200px]">Address</TableHead>
                          <TableHead className="px-2 py-2 w-[150px]">Start Date*</TableHead>
                          <TableHead className="px-2 py-2 w-[120px]">Monthly Amt*</TableHead>
                          <TableHead className="px-2 py-2 w-[100px]">Initial Paid (0-12)</TableHead>
                          <TableHead className="px-2 py-2 w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="p-1 sticky left-0 bg-background z-10">
                              <Input
                                value={row.customerName}
                                onChange={(e) => handleImportRowChange(row.id, 'customerName', e.target.value)}
                                placeholder="John Doe"
                                disabled={isImportProcessing}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.groupName}
                                onChange={(e) => handleImportRowChange(row.id, 'groupName', e.target.value)}
                                placeholder="Optional"
                                disabled={isImportProcessing}
                                className="h-8 text-xs"
                                list="existing-group-names-datalist"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.phone}
                                onChange={(e) => handleImportRowChange(row.id, 'phone', e.target.value)}
                                placeholder="Optional"
                                disabled={isImportProcessing}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Textarea
                                value={row.address}
                                onChange={(e) => handleImportRowChange(row.id, 'address', e.target.value)}
                                placeholder="Optional"
                                disabled={isImportProcessing}
                                rows={1}
                                className="h-8 text-xs resize-none leading-tight py-1.5"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={'outline'}
                                    className={cn("w-full justify-start text-left font-normal h-8 text-xs px-2", !row.startDate && "text-muted-foreground")}
                                    disabled={isImportProcessing}
                                  >
                                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                                    {row.startDate ? formatDateFns(row.startDate, "dd MMM yy") : <span>Pick date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={row.startDate}
                                    onSelect={(date) => handleImportRowChange(row.id, 'startDate', date)}
                                    initialFocus
                                    disabled={isImportProcessing}
                                  />
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                value={row.monthlyPaymentAmount}
                                onChange={(e) => handleImportRowChange(row.id, 'monthlyPaymentAmount', e.target.value)}
                                placeholder="e.g., 1000"
                                disabled={isImportProcessing}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                value={row.initialPaymentsPaid}
                                onChange={(e) => handleImportRowChange(row.id, 'initialPaymentsPaid', e.target.value)}
                                placeholder="0-12"
                                min="0" max="12"
                                disabled={isImportProcessing}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveImportRow(row.id)}
                                className="h-7 w-7"
                                disabled={isImportProcessing}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <datalist id="existing-group-names-datalist">
                      {existingGroupNamesForImport.map(name => <option key={name} value={name} />)}
                    </datalist>
                    <div className="p-2 text-xs text-muted-foreground">
                      Scroll horizontally if table content is clipped. Start Date for Excel should be YYYY-MM-DD.
                    </div>
                  </ScrollArea>
                )}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={handleAddImportRow}
                  disabled={isImportProcessing}
                  size="sm"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Scheme Row Manually
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  onClick={handleProcessImportFromUI}
                  disabled={isImportProcessing || importRows.length === 0}
                  className="w-full sm:w-auto"
                >
                  {isImportProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                  Process Import ({importRows.length} {importRows.length === 1 ? "Scheme" : "Schemes"})
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelImport}
                  disabled={isImportProcessing}
                  className="w-full sm:w-auto"
                >
                  Cancel Import Section
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
              Successfully imported: {importResults.successCount} | Errors/Skipped: {importResults.errorCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importResults.messages.length > 0 ? (
              <ScrollArea className="h-60 w-full rounded-md border p-3 text-sm">
                {importResults.messages.map((msg, index) => (
                  <p key={index} className={`mb-1 ${msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('skipping') || msg.toLowerCase().includes('duplicate') ? 'text-destructive' : msg.toLowerCase().includes('successfully') || msg.toLowerCase().includes('created') ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {(msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('skipping') || msg.toLowerCase().includes('duplicate')) && <AlertCircle className="inline h-3.5 w-3.5 mr-1.5 relative -top-px" />}
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

    