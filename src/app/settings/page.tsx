
'use client';

import { useState, type ReactNode, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Settings as SettingsIcon, SlidersHorizontal, Info, DatabaseZap, FileSpreadsheet, UploadCloud, FileText, AlertCircle, Trash2, PlusCircle, CalendarIcon, FileUp, RefreshCcw, ArchiveRestore, AlertTriangle as AlertTriangleIcon, Archive, Users2 as Users2Icon, ListChecks as ListChecksIcon } from 'lucide-react'; // Added Archive, Users2Icon (for groups), ListChecksIcon
import { getMockSchemes, getGroupDetails, addMockScheme, updateMockSchemePayment, getUniqueGroupNames, reopenMockScheme, deleteFullMockScheme, getArchivedMockSchemes, unarchiveMockScheme, archiveMockScheme, getArchivedGroups, unarchiveMockGroup, deleteFullMockGroup, getArchivedPaymentsForAllSchemes, unarchiveMockPayment, deleteFullMockPayment, type ArchivedPaymentAugmented } from '@/lib/mock-data'; // Added group and payment archival functions and type
import type { Scheme, PaymentMode, GroupDetail, Payment, SchemeStatus, MockGroup } from '@/types/scheme'; // Added SchemeStatus, MockGroup
import { formatDate, formatCurrency, getPaymentStatus, generateId, getSchemeStatus } from '@/lib/utils'; // Added getSchemeStatus
// import { exportToExcel } from '@/lib/excelUtils'; // This was removed in a previous task
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
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { formatISO, format as formatDateFns, parseISO, isValid as isValidDate, isBefore, subDays, } from 'date-fns'; // Added comma

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

  // State for Closed Scheme Management
  const [completedSchemes, setCompletedSchemes] = useState<Scheme[]>([]);
  const [selectedClosedSchemeIds, setSelectedClosedSchemeIds] = useState<string[]>([]);
  const [isReopeningClosedSchemes, setIsReopeningClosedSchemes] = useState(false);
  const [isDeletingClosedSchemes, setIsDeletingClosedSchemes] = useState(false);
  const [isArchivingSelectedSchemes, setIsArchivingSelectedSchemes] = useState(false); // New state

  // State for Archived Scheme Management
  const [archivedSchemesList, setArchivedSchemesList] = useState<Scheme[]>([]);
  const [selectedArchivedSchemeIds, setSelectedArchivedSchemeIds] = useState<string[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isRestoringSchemes, setIsRestoringSchemes] = useState(false);
  const [isDeletingArchivedSchemes, setIsDeletingArchivedSchemes] = useState(false);
  const [showDeleteArchivedConfirmDialog, setShowDeleteArchivedConfirmDialog] = useState(false);
  const [archivedSchemesPendingDeletionInfo, setArchivedSchemesPendingDeletionInfo] = useState<{ id: string; customerName: string; schemeId: string }[]>([]);

  // State for Archived Group Management
  const [archivedGroupsList, setArchivedGroupsList] = useState<MockGroup[]>([]);
  const [selectedArchivedGroupNames, setSelectedArchivedGroupNames] = useState<string[]>([]);
  const [isLoadingArchivedGroups, setIsLoadingArchivedGroups] = useState(false);
  const [isRestoringGroups, setIsRestoringGroups] = useState(false);
  const [isDeletingArchivedGroupsFull, setIsDeletingArchivedGroupsFull] = useState(false);
  const [showDeleteArchivedGroupsConfirmDialog, setShowDeleteArchivedGroupsConfirmDialog] = useState(false);
  const [archivedGroupsPendingDeletionInfo, setArchivedGroupsPendingDeletionInfo] = useState<{ groupName: string }[]>([]);

  // State for Archived Transaction Management
  const [archivedTransactionsList, setArchivedTransactionsList] = useState<ArchivedPaymentAugmented[]>([]);
  const [selectedArchivedPaymentIds, setSelectedArchivedPaymentIds] = useState<string[]>([]);
  const [isLoadingArchivedTransactions, setIsLoadingArchivedTransactions] = useState(false);
  const [isRestoringTransactions, setIsRestoringTransactions] = useState(false);
  const [isDeletingArchivedTransactionsFull, setIsDeletingArchivedTransactionsFull] = useState(false);
  const [showDeleteArchivedTransactionsConfirmDialog, setShowDeleteArchivedTransactionsConfirmDialog] = useState(false);
  const [archivedTransactionsPendingDeletionInfo, setArchivedTransactionsPendingDeletionInfo] = useState<ArchivedPaymentAugmented[]>([]);


  const loadAllData = useCallback(() => {
    if (isImportSectionVisible) {
      setExistingGroupNamesForImport(getUniqueGroupNames());
    }
    const allSchemes = getMockSchemes();
    // Filter for 'Closed' status
    const completedAndClosed = allSchemes
      .filter(s => s.status === 'Closed')
      .sort((a, b) => {
        // Prioritize sorting by closureDate if available, then by startDate or some other criteria
        const dateA = a.closureDate ? parseISO(a.closureDate) : (a.startDate ? parseISO(a.startDate) : new Date(0));
        const dateB = b.closureDate ? parseISO(b.closureDate) : (b.startDate ? parseISO(b.startDate) : new Date(0));
        return dateB.getTime() - dateA.getTime(); // Sort descending by date (most recent first)
      });
    setCompletedSchemes(completedAndClosed);
    setSelectedClosedSchemeIds([]);

    // Load archived schemes
    setIsLoadingArchived(true);
    const archived = getArchivedMockSchemes().sort((a,b) => {
        const dateA = a.archivedDate ? parseISO(a.archivedDate) : (a.closureDate ? parseISO(a.closureDate) : new Date(0));
        const dateB = b.archivedDate ? parseISO(b.archivedDate) : (b.closureDate ? parseISO(b.closureDate) : new Date(0));
        return dateB.getTime() - dateA.getTime(); // Sort descending by date (most recent archived/closed first)
    });
    setArchivedSchemesList(archived);
    setSelectedArchivedSchemeIds([]);
    setIsLoadingArchived(false);

    // Load archived groups
    setIsLoadingArchivedGroups(true);
    const fetchedArchivedGroups = getArchivedGroups().sort((a, b) => {
      const dateA = a.archivedDate ? parseISO(a.archivedDate) : new Date(0);
      const dateB = b.archivedDate ? parseISO(b.archivedDate) : new Date(0);
      if (dateB.getTime() === dateA.getTime()) {
        return a.groupName.localeCompare(b.groupName); // Secondary sort by name
      }
      return dateB.getTime() - dateA.getTime(); // Primary sort by date desc
    });
    setArchivedGroupsList(fetchedArchivedGroups);
    setSelectedArchivedGroupNames([]);
    setIsLoadingArchivedGroups(false);

    // Load archived transactions
    setIsLoadingArchivedTransactions(true);
    const fetchedArchivedTransactions = getArchivedPaymentsForAllSchemes().sort((a, b) => {
      const dateA = a.archivedDate ? parseISO(a.archivedDate) : new Date(0);
      const dateB = b.archivedDate ? parseISO(b.archivedDate) : new Date(0);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime(); // Primary sort by archived date desc
      }
      const nameCompare = a.customerName.localeCompare(b.customerName);
      if (nameCompare !== 0) {
        return nameCompare; // Secondary sort by customer name
      }
      return a.schemeId.localeCompare(b.schemeId); // Tertiary sort by schemeId
    });
    setArchivedTransactionsList(fetchedArchivedTransactions);
    setSelectedArchivedPaymentIds([]);
    setIsLoadingArchivedTransactions(false);

  }, [isImportSectionVisible]); // Add other dependencies if they affect data loading for archived

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);


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
    setImportResults(null); 
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 }); 

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
            return null; 
          }
          
          if (startDateRaw) {
            if (startDateRaw instanceof Date && isValidDate(startDateRaw)) {
              startDate = startDateRaw;
            } else if (typeof startDateRaw === 'string') {
              const parsedDate = parseISO(startDateRaw.trim());
              if (isValidDate(parsedDate)) startDate = parsedDate;
            } else if (typeof startDateRaw === 'number') { 
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
    setImportResults(null);
    const localResults: { successCount: number; errorCount: number; messages: string[] } = {
      successCount: 0,
      errorCount: 0,
      messages: [],
    };
    const processedCustomerNamesInThisBatch = new Set<string>();
    const allExistingSchemes = getMockSchemes(); 

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      const rowNumForMsg = `Row ${i + 1} (Table)`;
      const customerNameForProcessing = row.customerName.trim();

      if (!customerNameForProcessing) {
        localResults.messages.push(`${rowNumForMsg}: Customer Name is required. Skipping.`);
        localResults.errorCount++;
        continue;
      }
      const lowerCaseCustomerNameFromRow = customerNameForProcessing.toLowerCase();

      const isGloballyExisting = allExistingSchemes.some(
        (scheme) => scheme.customerName.trim().toLowerCase() === lowerCaseCustomerNameFromRow
      );
      if (isGloballyExisting) {
        localResults.messages.push(`${rowNumForMsg}: Customer "${customerNameForProcessing}" already exists in the system. Skipping.`);
        localResults.errorCount++;
        continue;
      }

      if (processedCustomerNamesInThisBatch.has(lowerCaseCustomerNameFromRow)) {
        localResults.messages.push(`${rowNumForMsg}: Customer Name "${customerNameForProcessing}" is a duplicate within this import batch. Skipping.`);
        localResults.errorCount++;
        continue;
      }
      
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
      
      processedCustomerNamesInThisBatch.add(lowerCaseCustomerNameFromRow);

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
          localResults.messages.push(`${rowNumForMsg}: Failed to create scheme for "${customerNameForProcessing}". This could be due to an internal issue.`);
          localResults.errorCount++;
          continue;
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
                  paymentDate: schemeForPaymentRecording.startDate, 
                  amountPaid: schemeForPaymentRecording.monthlyPaymentAmount,
                  modeOfPayment: ['Imported'] as PaymentMode[],
                });

                if (updatedSchemeResult) {
                  recordedInitialPaymentsCount++;
                  schemeForPaymentRecording = updatedSchemeResult; 
                } else {
                  localResults.messages.push(`${rowNumForMsg}: Error recording initial payment ${j + 1} for scheme ${createdScheme.id.toUpperCase()}.`);
                  break; 
                }
              } else {
                 recordedInitialPaymentsCount++; 
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
      loadAllData();
    } else if (localResults.successCount > 0 && localResults.errorCount > 0) {
      toast({ title: 'Import Partially Successful', description: `${localResults.successCount} schemes imported, ${localResults.errorCount} errors/skipped. Check results below.`, variant: 'default', duration: 10000 });
      loadAllData();
    } else if (localResults.errorCount > 0) {
      toast({ title: 'Import Failed', description: `${localResults.errorCount} errors/skipped rows. Check results below.`, variant: 'destructive', duration: 10000 });
    } else { 
      toast({ title: 'Import Complete', description: 'No schemes were processed (possibly all rows had issues or were empty).', variant: 'default' });
    }
    setIsImportProcessing(false);
    setExistingGroupNamesForImport(getUniqueGroupNames()); 
  };

  const cancelImport = () => {
    setIsImportSectionVisible(false);
    setImportRows([]);
    setImportResults(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
  };

  // --- Closed Scheme Management Logic ---
  const handleSelectClosedScheme = (schemeId: string, checked: boolean) => {
    setSelectedClosedSchemeIds(prev =>
      checked ? [...prev, schemeId] : prev.filter(id => id !== schemeId)
    );
  };

  const handleSelectAllClosedSchemes = (checked: boolean) => {
    if (checked) {
      setSelectedClosedSchemeIds(completedSchemes.map(s => s.id));
    } else {
      setSelectedClosedSchemeIds([]);
    }
  };

  const handleReopenSelectedSchemes = async () => {
    if (selectedClosedSchemeIds.length === 0) return;
    setIsReopeningClosedSchemes(true);
    let successCount = 0;
    let errorCount = 0;

    for (const schemeId of selectedClosedSchemeIds) {
      const reopened = reopenMockScheme(schemeId);
      if (reopened) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    toast({
      title: "Reopen Operation Complete",
      description: `${successCount} scheme(s) reopened. ${errorCount > 0 ? `${errorCount} error(s).` : ''}`
    });
    loadAllData(); // Refresh the list of completed schemes and other data potentially
    setIsReopeningClosedSchemes(false);
  };

  const handleArchiveSelectedSchemes = async () => {
    if (selectedClosedSchemeIds.length === 0) {
      toast({ title: "No Schemes Selected", description: "Please select schemes to archive.", variant: "destructive" });
      return;
    }
    setIsArchivingSelectedSchemes(true);
    let successCount = 0;
    let errorCount = 0;

    // Directly use MOCK_SCHEMES from import for checking current status before archiving
    // This is a temporary workaround for not having a direct 'getNonReactiveMockSchemes()'
    // In a real scenario, you'd fetch the latest full list or ensure `completedSchemes` is always perfectly up-to-date.
    const currentSystemSchemes = getMockSchemes({ includeArchived: true });


    for (const schemeId of selectedClosedSchemeIds) {
      const schemeInList = completedSchemes.find(s => s.id === schemeId); // Check if it was in the displayed list
      if (schemeInList) {
        const actualSchemeToArchive = currentSystemSchemes.find(s => s.id === schemeId); // Get its most current state

        if (actualSchemeToArchive && actualSchemeToArchive.status === 'Closed') {
            const result = archiveMockScheme(schemeId); // archiveMockScheme is from mock-data
            if (result) {
              successCount++;
            } else {
              errorCount++;
              toast({ title: "Archive Error", description: `Failed to archive scheme ${schemeId}. It might not be in a state suitable for archiving.`, variant: "destructive" });
            }
        } else if (actualSchemeToArchive && actualSchemeToArchive.status === 'Fully Paid') {
            errorCount++;
            toast({ title: "Not Archived", description: `Scheme ${schemeId} (${actualSchemeToArchive.customerName}) is 'Fully Paid' but not 'Closed'. Please close it first if you wish to archive it immediately.`, variant: "default", duration: 6000 });
        } else if (actualSchemeToArchive && actualSchemeToArchive.status === 'Archived') {
            errorCount++;
            toast({ title: "Already Archived", description: `Scheme ${schemeId} (${actualSchemeToArchive.customerName}) is already archived.`, variant: "default" });
        } else {
            errorCount++;
            toast({ title: "Not Archived", description: `Scheme ${schemeId} (${actualSchemeToArchive?.customerName}) could not be archived (current status: ${actualSchemeToArchive?.status}).`, variant: "destructive" });
        }
      } else {
        errorCount++;
         toast({ title: "Scheme not found", description: `Scheme with ID ${schemeId} not found in the current list. It might have been updated.`, variant: "destructive" });
      }
    }

    if (successCount > 0) {
      toast({
        title: "Archiving Complete",
        description: `${successCount} selected scheme(s) archived. ${errorCount > 0 ? `${errorCount} other(s) not archived (see other messages).` : ''}`,
      });
    } else if (errorCount > 0 && successCount === 0) {
      // Individual toasts for errors/non-actions already shown.
      // Optionally, show a summary toast if no successes occurred but there were attempts.
      // toast({ title: "Archiving Processed", description: "No schemes were archived. See previous messages for details.", variant: "default"});
    }


    loadAllData();
    setIsArchivingSelectedSchemes(false);
    // setSelectedClosedSchemeIds([]); // Clear selection after action
  };

  const isAllCompletedSelected = completedSchemes.length > 0 && selectedClosedSchemeIds.length === completedSchemes.length;
  const isAllArchivedSelected = archivedSchemesList.length > 0 && selectedArchivedSchemeIds.length === archivedSchemesList.length;

  // --- Archived Scheme Management Logic (selection handlers) ---
  const handleSelectArchivedScheme = (schemeId: string, checked: boolean) => {
    setSelectedArchivedSchemeIds(prev =>
      checked ? [...prev, schemeId] : prev.filter(id => id !== schemeId)
    );
  };

  const handleSelectAllArchivedSchemes = (checked: boolean) => {
    if (checked) {
      setSelectedArchivedSchemeIds(archivedSchemesList.map(s => s.id));
    } else {
      setSelectedArchivedSchemeIds([]);
    }
  };

  const handleRestoreSelectedArchivedSchemes = async () => {
    if (selectedArchivedSchemeIds.length === 0) return;
    setIsRestoringSchemes(true);
    let successCount = 0;
    let errorCount = 0;

    for (const schemeId of selectedArchivedSchemeIds) {
      const restoredScheme = unarchiveMockScheme(schemeId);
      if (restoredScheme) {
        successCount++;
      } else {
        errorCount++;
        // Attempt to find the scheme in the main list to log its current status if unarchive failed
        const currentSchemeState = getMockSchemes({ includeArchived: true }).find(s => s.id === schemeId);
        console.warn(`Failed to restore scheme ${schemeId}. Current status: ${currentSchemeState?.status}`);
      }
    }
    toast({
      title: "Restore Operation Complete",
      description: `${successCount} scheme(s) restored. ${errorCount > 0 ? `${errorCount} error(s) - check console for details.` : ''}`,
      variant: errorCount > 0 ? "destructive" : "default"
    });
    loadAllData();
    setSelectedArchivedSchemeIds([]); // Clear selection
    setIsRestoringSchemes(false);
  };

  const handleInitiateDeleteArchivedSchemes = () => {
    if (selectedArchivedSchemeIds.length === 0) return;
    const info = selectedArchivedSchemeIds.map(id => {
      const scheme = archivedSchemesList.find(s => s.id === id); // Use archivedSchemesList
      return { id, customerName: scheme?.customerName || 'Unknown', schemeId: scheme?.id.toUpperCase() || 'Unknown ID' };
    });
    setArchivedSchemesPendingDeletionInfo(info); // Use dedicated state
    setShowDeleteArchivedConfirmDialog(true); // Use dedicated dialog state
  };

  const handleConfirmDeleteSelectedArchivedSchemes = async () => {
    if (selectedArchivedSchemeIds.length === 0) return;
    setIsDeletingArchivedSchemes(true); // Use dedicated loading state
    let successCount = 0;
    let errorCount = 0;

    for (const schemeId of selectedArchivedSchemeIds) {
      const deleted = deleteFullMockScheme(schemeId);
      if (deleted) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    toast({
      title: "Deletion Operation Complete",
      description: `${successCount} archived scheme(s) permanently deleted. ${errorCount > 0 ? `${errorCount} error(s).` : ''}`,
      variant: successCount > 0 && errorCount > 0 ? 'default' : (errorCount > 0 ? 'destructive' : 'default')
    });
    loadAllData();
    setSelectedArchivedSchemeIds([]);
    setArchivedSchemesPendingDeletionInfo([]);
    setShowDeleteArchivedConfirmDialog(false);
    setIsDeletingArchivedSchemes(false);
  };

  // --- Archived Group Management Logic ---
  const handleSelectArchivedGroup = (groupName: string, checked: boolean) => {
    setSelectedArchivedGroupNames(prev =>
      checked ? [...prev, groupName] : prev.filter(name => name !== groupName)
    );
  };

  const handleSelectAllArchivedGroups = (checked: boolean) => {
    if (checked) {
      setSelectedArchivedGroupNames(archivedGroupsList.map(g => g.groupName));
    } else {
      setSelectedArchivedGroupNames([]);
    }
  };

  const handleRestoreSelectedArchivedGroups = async () => {
    if (selectedArchivedGroupNames.length === 0) return;
    setIsRestoringGroups(true);
    let successCount = 0;
    let errorCount = 0;
    let errorMessages: string[] = [];

    for (const groupName of selectedArchivedGroupNames) {
      const restoredGroup = unarchiveMockGroup(groupName);
      if (restoredGroup) {
        successCount++;
      } else {
        errorCount++;
        errorMessages.push(`Failed to restore group "${groupName}". It might not be archived or an error occurred.`);
      }
    }
    toast({
      title: "Group Restore Operation Complete",
      description: `${successCount} group(s) restored. ${errorCount > 0 ? `${errorCount} error(s). ${errorMessages.join(' ')}` : ''}`,
      variant: errorCount > 0 ? (successCount > 0 ? "default" : "destructive") : "default"
    });
    loadAllData(); // Refresh data including groups
    setIsRestoringGroups(false);
  };

  const handleInitiateDeleteArchivedGroups = () => {
    if (selectedArchivedGroupNames.length === 0) return;
    const info = selectedArchivedGroupNames.map(groupName => ({ groupName }));
    setArchivedGroupsPendingDeletionInfo(info);
    setShowDeleteArchivedGroupsConfirmDialog(true);
  };

  const handleConfirmDeleteSelectedArchivedGroups = async () => {
    if (selectedArchivedGroupNames.length === 0) return;
    setIsDeletingArchivedGroupsFull(true);
    let successCount = 0;
    let errorCount = 0;
    let errorMessages: string[] = [];

    for (const groupName of selectedArchivedGroupNames) {
      const deleted = deleteFullMockGroup(groupName);
      if (deleted) {
        successCount++;
      } else {
        errorCount++;
        errorMessages.push(`Failed to delete group "${groupName}".`);
      }
    }
    toast({
      title: "Group Deletion Operation Complete",
      description: `${successCount} group(s) permanently deleted. Schemes within these groups have been unassigned. ${errorCount > 0 ? `${errorCount} error(s). ${errorMessages.join(' ')}` : ''}`,
      variant: successCount > 0 && errorCount > 0 ? 'default' : (errorCount > 0 ? 'destructive' : 'default')
    });
    loadAllData(); // Refresh data
    setArchivedGroupsPendingDeletionInfo([]);
    setShowDeleteArchivedGroupsConfirmDialog(false);
    setIsDeletingArchivedGroupsFull(false);
  };

  const isAllArchivedGroupsSelected = archivedGroupsList.length > 0 && selectedArchivedGroupNames.length === archivedGroupsList.length;

  // --- Archived Transaction Management Logic ---
  const handleSelectArchivedTransaction = (paymentId: string, checked: boolean) => {
    setSelectedArchivedPaymentIds(prev =>
      checked ? [...prev, paymentId] : prev.filter(id => id !== paymentId)
    );
  };

  const handleSelectAllArchivedTransactions = (checked: boolean) => {
    if (checked) {
      setSelectedArchivedPaymentIds(archivedTransactionsList.map(t => t.id));
    } else {
      setSelectedArchivedPaymentIds([]);
    }
  };

  const handleRestoreSelectedArchivedTransactions = async () => {
    if (selectedArchivedPaymentIds.length === 0) return;
    setIsRestoringTransactions(true);
    let successCount = 0;
    let errorCount = 0;
    let errorMessages: string[] = [];

    for (const paymentId of selectedArchivedPaymentIds) {
      const transaction = archivedTransactionsList.find(t => t.id === paymentId);
      if (transaction) {
        const restoredScheme = unarchiveMockPayment(transaction.schemeId, transaction.id);
        if (restoredScheme) {
          successCount++;
        } else {
          errorCount++;
          errorMessages.push(`Failed to restore transaction ${paymentId} for scheme ${transaction.schemeId}.`);
        }
      } else {
        errorCount++;
        errorMessages.push(`Transaction details not found for ID ${paymentId}.`);
      }
    }
    toast({
      title: "Transaction Restore Operation Complete",
      description: `${successCount} transaction(s) restored. ${errorCount > 0 ? `${errorCount} error(s). ${errorMessages.join(' ')}` : ''}`,
      variant: errorCount > 0 ? (successCount > 0 ? "default" : "destructive") : "default"
    });
    loadAllData(); // Refresh all data
    setIsRestoringTransactions(false);
  };

  const handleInitiateDeleteArchivedTransactions = () => {
    if (selectedArchivedPaymentIds.length === 0) return;
    const info = selectedArchivedPaymentIds.map(id => {
      const t = archivedTransactionsList.find(txn => txn.id === id);
      return t || { id, schemeId: 'Unknown', customerName: 'Unknown', monthNumber: 0, archivedDate: undefined, amountExpected: 0 }; // Fallback for safety, ensure 'id' exists
    }).map(t => ({ paymentId: t.id, schemeId: t.schemeId, customerName: t.customerName, monthNumber: t.monthNumber }));
    setArchivedTransactionsPendingDeletionInfo(info as any); // Cast needed if fallback is used and type is strict
    setShowDeleteArchivedTransactionsConfirmDialog(true);
  };

  const handleConfirmDeleteSelectedArchivedTransactions = async () => {
    if (selectedArchivedPaymentIds.length === 0) return;
    setIsDeletingArchivedTransactionsFull(true);
    let successCount = 0;
    let errorCount = 0;
    let errorMessages: string[] = [];

    for (const paymentId of selectedArchivedPaymentIds) {
      const transaction = archivedTransactionsList.find(t => t.id === paymentId);
      if (transaction) {
        const updatedScheme = deleteFullMockPayment(transaction.schemeId, transaction.id);
        if (updatedScheme) {
          successCount++;
        } else {
          errorCount++;
          errorMessages.push(`Failed to delete transaction ${paymentId} for scheme ${transaction.schemeId}.`);
        }
      } else {
        errorCount++;
        errorMessages.push(`Transaction details not found for ID ${paymentId} for deletion.`);
      }
    }
    toast({
      title: "Transaction Deletion Operation Complete",
      description: `${successCount} transaction(s) permanently deleted. ${errorCount > 0 ? `${errorCount} error(s). ${errorMessages.join(' ')}` : ''}`,
      variant: successCount > 0 && errorCount > 0 ? 'default' : (errorCount > 0 ? 'destructive' : 'default')
    });
    loadAllData(); // Refresh all data
    setArchivedTransactionsPendingDeletionInfo([]);
    setShowDeleteArchivedTransactionsConfirmDialog(false);
    setIsDeletingArchivedTransactionsFull(false);
  };

  const isAllArchivedTransactionsSelected = archivedTransactionsList.length > 0 && selectedArchivedPaymentIds.length === archivedTransactionsList.length;


  return (
    <div className="flex flex-col gap-8 mt-6">
      {/* Export Card */}
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

      {/* Bulk Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Bulk Import Schemes
          </CardTitle>
          <CardDescription>
            Upload an Excel file or manually add scheme details in the table below for bulk import. 
            Customer names must be unique (new customers only). Checks for duplicates within the batch and against existing system data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isImportSectionVisible ? (
            <Button
              onClick={() => {
                setIsImportSectionVisible(true);
                if(importRows.length === 0) handleAddImportRow(); 
                setExistingGroupNamesForImport(getUniqueGroupNames());
                setImportResults(null); 
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

      {/* Import Results Card */}
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
                  <p key={index} className={`mb-1 ${msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('skipping') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists') ? 'text-destructive' : msg.toLowerCase().includes('successfully') || msg.toLowerCase().includes('created') ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {(msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('skipping') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists')) && <AlertCircle className="inline h-3.5 w-3.5 mr-1.5 relative -top-px" />}
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

      {/* Closed Scheme Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <ArchiveRestore className="h-5 w-5 text-primary" />
            Closed Scheme Management
          </CardTitle>
          <CardDescription>
            Manage schemes that are 'Closed' (manually by an admin). You can reopen or archive them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Button
              onClick={handleReopenSelectedSchemes}
              disabled={selectedClosedSchemeIds.length === 0 || isReopeningClosedSchemes || isDeletingClosedSchemes || isArchivingSelectedSchemes}
            >
              {isReopeningClosedSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Reopen Selected ({selectedClosedSchemeIds.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => handleArchiveSelectedSchemes()}
              disabled={selectedClosedSchemeIds.length === 0 || isReopeningClosedSchemes || isDeletingClosedSchemes || isArchivingSelectedSchemes}
            >
              {isArchivingSelectedSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Archive Selected ({selectedClosedSchemeIds.length})
            </Button>
          </div>
          {completedSchemes.length > 0 ? (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllCompletedSelected}
                        onCheckedChange={handleSelectAllClosedSchemes}
                        aria-label="Select all completed schemes"
                        disabled={isReopeningClosedSchemes || isDeletingClosedSchemes || isArchivingSelectedSchemes}
                      />
                    </TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Scheme ID</TableHead>
                    <TableHead>Closure Date</TableHead>
                    <TableHead className="text-right">Total Collected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedSchemes.map((scheme) => (
                    <TableRow key={scheme.id} data-state={selectedClosedSchemeIds.includes(scheme.id) ? 'selected' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClosedSchemeIds.includes(scheme.id)}
                          onCheckedChange={(checked) => handleSelectClosedScheme(scheme.id, !!checked)}
                          aria-label={`Select scheme ${scheme.id.toUpperCase()}`}
                          disabled={isReopeningClosedSchemes || isDeletingClosedSchemes || isArchivingSelectedSchemes}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{scheme.customerName}</TableCell>
                      <TableCell>{scheme.id.toUpperCase()}</TableCell>
                      <TableCell>{formatDate(scheme.closureDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(scheme.totalCollected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-4">No completed or closed schemes found.</p>
          )}
        </CardContent>
      </Card>

      {/* Archived Scheme Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <ArchiveRestore className="h-5 w-5 text-primary opacity-80" /> {/* Changed icon */}
            Archived Scheme Management
          </CardTitle>
          <CardDescription>
            Manage schemes that have been archived. You can restore them (returning them to their previous state, typically 'Closed') or permanently delete them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Button
              onClick={handleRestoreSelectedArchivedSchemes}
              disabled={selectedArchivedSchemeIds.length === 0 || isRestoringSchemes || isDeletingArchivedSchemes}
            >
              {isRestoringSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Restore Selected ({selectedArchivedSchemeIds.length})
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiateDeleteArchivedSchemes}
              disabled={selectedArchivedSchemeIds.length === 0 || isRestoringSchemes || isDeletingArchivedSchemes}
            >
              {isDeletingArchivedSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Permanently Delete Selected ({selectedArchivedSchemeIds.length})
            </Button>
          </div>
          {isLoadingArchived ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading archived schemes...
            </div>
          ) : archivedSchemesList.length > 0 ? (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllArchivedSelected}
                        onCheckedChange={handleSelectAllArchivedSchemes}
                        aria-label="Select all archived schemes"
                        disabled={isRestoringSchemes || isDeletingArchivedSchemes}
                      />
                    </TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Scheme ID</TableHead>
                    <TableHead>Archived Date</TableHead>
                    <TableHead>Original Closure Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedSchemesList.map((scheme) => (
                    <TableRow key={scheme.id} data-state={selectedArchivedSchemeIds.includes(scheme.id) ? 'selected' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedArchivedSchemeIds.includes(scheme.id)}
                          onCheckedChange={(checked) => handleSelectArchivedScheme(scheme.id, !!checked)}
                          aria-label={`Select archived scheme ${scheme.id.toUpperCase()}`}
                          disabled={isRestoringSchemes || isDeletingArchivedSchemes}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{scheme.customerName}</TableCell>
                      <TableCell>{scheme.id.toUpperCase()}</TableCell>
                      <TableCell>{formatDate(scheme.archivedDate)}</TableCell>
                      <TableCell>{formatDate(scheme.closureDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-4">No archived schemes found.</p>
          )}
        </CardContent>
      </Card>


      {/* Confirmation Dialog for Deleting Archived Schemes */}
      {showDeleteArchivedConfirmDialog && (
        <AlertDialog open={showDeleteArchivedConfirmDialog} onOpenChange={(open) => !open && setShowDeleteArchivedConfirmDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="h-6 w-6 text-destructive" />
                Confirm Permanent Deletion of Archived Schemes
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to permanently delete {archivedSchemesPendingDeletionInfo.length} archived scheme(s):
                <ul className="list-disc pl-5 mt-2 text-sm max-h-40 overflow-y-auto">
                  {archivedSchemesPendingDeletionInfo.map(s => <li key={s.id}>{s.customerName} (ID: {s.schemeId})</li>)}
                </ul>
                This action cannot be undone. All associated data will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteArchivedConfirmDialog(false)} disabled={isDeletingArchivedSchemes}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteSelectedArchivedSchemes}
                disabled={isDeletingArchivedSchemes}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingArchivedSchemes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Archived Group Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Users2Icon className="h-5 w-5 text-primary opacity-80" /> {/* Using Users2Icon as an example */}
            Archived Group Management
          </CardTitle>
          <CardDescription>
            Manage groups that have been moved to trash (archived). You can restore them or permanently delete them.
            Permanently deleting a group will also remove its association from all schemes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Button
              onClick={handleRestoreSelectedArchivedGroups}
              disabled={selectedArchivedGroupNames.length === 0 || isRestoringGroups || isDeletingArchivedGroupsFull}
            >
              {isRestoringGroups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Restore Selected ({selectedArchivedGroupNames.length})
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiateDeleteArchivedGroups}
              disabled={selectedArchivedGroupNames.length === 0 || isRestoringGroups || isDeletingArchivedGroupsFull}
            >
              {isDeletingArchivedGroupsFull ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Permanently Delete Selected ({selectedArchivedGroupNames.length})
            </Button>
          </div>
          {isLoadingArchivedGroups ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading archived groups...
            </div>
          ) : archivedGroupsList.length > 0 ? (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllArchivedGroupsSelected}
                        onCheckedChange={handleSelectAllArchivedGroups}
                        aria-label="Select all archived groups"
                        disabled={isRestoringGroups || isDeletingArchivedGroupsFull}
                      />
                    </TableHead>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Archived Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedGroupsList.map((group) => (
                    <TableRow key={group.groupName} data-state={selectedArchivedGroupNames.includes(group.groupName) ? 'selected' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedArchivedGroupNames.includes(group.groupName)}
                          onCheckedChange={(checked) => handleSelectArchivedGroup(group.groupName, !!checked)}
                          aria-label={`Select archived group ${group.groupName}`}
                          disabled={isRestoringGroups || isDeletingArchivedGroupsFull}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{group.groupName}</TableCell>
                      <TableCell>{formatDate(group.archivedDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-4">No archived groups found.</p>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Deleting Archived Groups */}
      {showDeleteArchivedGroupsConfirmDialog && (
        <AlertDialog open={showDeleteArchivedGroupsConfirmDialog} onOpenChange={(open) => !open && setShowDeleteArchivedGroupsConfirmDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="h-6 w-6 text-destructive" />
                Confirm Permanent Deletion of Archived Groups
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to permanently delete {archivedGroupsPendingDeletionInfo.length} archived group(s):
                <ul className="list-disc pl-5 mt-2 text-sm max-h-40 overflow-y-auto">
                  {archivedGroupsPendingDeletionInfo.map(g => <li key={g.groupName}>{g.groupName}</li>)}
                </ul>
                This action cannot be undone. All schemes currently in this/these group(s) will be unassigned from it/them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteArchivedGroupsConfirmDialog(false)} disabled={isDeletingArchivedGroupsFull}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteSelectedArchivedGroups}
                disabled={isDeletingArchivedGroupsFull}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingArchivedGroupsFull ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Archived Transaction Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <ListChecksIcon className="h-5 w-5 text-primary opacity-80" />
            Archived Transaction Management
          </CardTitle>
          <CardDescription>
            Manage individual payment transactions that have been moved to trash. You can restore them to their scheme or permanently delete them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Button
              onClick={handleRestoreSelectedArchivedTransactions}
              disabled={selectedArchivedPaymentIds.length === 0 || isRestoringTransactions || isDeletingArchivedTransactionsFull}
            >
              {isRestoringTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Restore Selected ({selectedArchivedPaymentIds.length})
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiateDeleteArchivedTransactions}
              disabled={selectedArchivedPaymentIds.length === 0 || isRestoringTransactions || isDeletingArchivedTransactionsFull}
            >
              {isDeletingArchivedTransactionsFull ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Permanently Delete Selected ({selectedArchivedPaymentIds.length})
            </Button>
          </div>
          {isLoadingArchivedTransactions ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading archived transactions...
            </div>
          ) : archivedTransactionsList.length > 0 ? (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllArchivedTransactionsSelected}
                        onCheckedChange={handleSelectAllArchivedTransactions}
                        aria-label="Select all archived transactions"
                        disabled={isRestoringTransactions || isDeletingArchivedTransactionsFull}
                      />
                    </TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Scheme ID</TableHead>
                    <TableHead className="text-center">Month #</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Expected Amt.</TableHead>
                    <TableHead>Archived Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedTransactionsList.map((txn) => (
                    <TableRow key={txn.id} data-state={selectedArchivedPaymentIds.includes(txn.id) ? 'selected' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedArchivedPaymentIds.includes(txn.id)}
                          onCheckedChange={(checked) => handleSelectArchivedTransaction(txn.id, !!checked)}
                          aria-label={`Select transaction ${txn.id}`}
                          disabled={isRestoringTransactions || isDeletingArchivedTransactionsFull}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{txn.customerName}</TableCell>
                      <TableCell>{txn.schemeId.toUpperCase()}</TableCell>
                      <TableCell className="text-center">{txn.monthNumber}</TableCell>
                      <TableCell>{formatDate(txn.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(txn.amountExpected)}</TableCell>
                      <TableCell>{formatDate(txn.archivedDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-4">No archived transactions found.</p>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Deleting Archived Transactions */}
      {showDeleteArchivedTransactionsConfirmDialog && (
        <AlertDialog open={showDeleteArchivedTransactionsConfirmDialog} onOpenChange={(open) => !open && setShowDeleteArchivedTransactionsConfirmDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="h-6 w-6 text-destructive" />
                Confirm Permanent Deletion of Archived Transactions
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to permanently delete {archivedTransactionsPendingDeletionInfo.length} archived transaction(s). This action cannot be undone.
                <ScrollArea className="max-h-40 mt-2 border rounded-md p-2">
                  <ul className="list-disc pl-5 text-sm ">
                    {archivedTransactionsPendingDeletionInfo.map(t => (
                      <li key={t.id}>
                        {t.customerName} (Scheme: {t.schemeId.toUpperCase()}, Month: {t.monthNumber})
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteArchivedTransactionsConfirmDialog(false)} disabled={isDeletingArchivedTransactionsFull}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteSelectedArchivedTransactions}
                disabled={isDeletingArchivedTransactionsFull}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingArchivedTransactionsFull ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}

type DefaultPaymentModeType = "Cash" | "Card" | "UPI";

function RecommendedSettingsTabContent() {
  const { toast } = useToast(); // Added for toast messages
  const [autoArchive, setAutoArchive] = useState(false);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false); // Added for loading state
  const [archiveDays, setArchiveDays] = useState(60);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<DefaultPaymentModeType>("Cash");
  const paymentModeOptions: DefaultPaymentModeType[] = ["Cash", "Card", "UPI"];

  const handleRunArchiving = async () => {
    setIsProcessingArchive(true);
    let archivedCount = 0;
    try {
      const allSchemes = getMockSchemes({ includeArchived: true }); // Fetch all, including already archived
      const schemesToArchive = allSchemes.filter(scheme => {
        if (scheme.status === 'Closed' && scheme.closureDate) {
          const closureDate = parseISO(scheme.closureDate);
          const daysAgo = subDays(new Date(), archiveDays);
          return isBefore(closureDate, daysAgo);
        }
        return false;
      });

      for (const scheme of schemesToArchive) {
        const result = archiveMockScheme(scheme.id);
        if (result) {
          archivedCount++;
        }
      }

      if (archivedCount > 0) {
        toast({ title: "Archiving Complete", description: `${archivedCount} scheme(s) were archived.` });
      } else {
        toast({ title: "Archiving Complete", description: "No schemes were eligible for archiving at this time." });
      }
    } catch (error) {
      console.error("Error during archiving:", error);
      toast({ title: "Archiving Error", description: "An error occurred while trying to archive schemes.", variant: "destructive" });
    }
    setIsProcessingArchive(false);
    // Potentially call loadAllData() here if it's in the same component and needs to refresh a list
    // that might now exclude these archived schemes, but DataManagementTabContent handles its own loadAllData.
  };

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4">
            <div className="flex-grow">
              <Label htmlFor="auto-archive" className="font-medium">Enable Auto-Archiving (Future Feature)</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, the system would periodically archive 'Closed' schemes older than 60 days.
                For now, please use the manual button.
              </p>
            </div>
            <Switch
              id="auto-archive"
              checked={autoArchive}
              onCheckedChange={setAutoArchive}
              disabled={isProcessingArchive}
            />
          </div>
          <div className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <Label htmlFor="archive-days" className="font-medium block mb-2">Archive Grace Period (Days)</Label>
            <Input
              id="archive-days"
              type="number"
              value={archiveDays}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setArchiveDays(isNaN(val) || val < 0 ? 0 : val);
              }}
              className="max-w-xs"
              disabled={isProcessingArchive}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Number of days after a scheme is 'Closed' before it can be manually archived using the 'Run Archiving Process Now' button.
            </p>
          </div>
          <div className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <Label className="font-medium block mb-2">Manual Archiving</Label>
            <Button onClick={handleRunArchiving} disabled={isProcessingArchive} className="w-full sm:w-auto">
              {isProcessingArchive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
              Run Archiving Process Now
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Manually archives 'Closed' schemes where the closure date is older than the configured grace period.
            </p>
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

    

function exportToExcel(arg0: { name: string; data: any[][]; }[], arg1: string) {
  throw new Error('Function not implemented.');
}
