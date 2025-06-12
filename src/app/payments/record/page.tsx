
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CalendarIcon, Loader2, Search, Plus, Minus, ExternalLink, AlertCircle, CreditCard, Landmark, Smartphone, Users, Info, CalendarDays, DollarSign } from 'lucide-react';
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { getMockSchemes, getGroupDetails, updateMockSchemePayment } from '@/lib/mock-data';
import { formatISO, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];
const paymentModeIcons: Record<PaymentMode, React.ElementType> = {
  'Card': CreditCard,
  'Cash': Landmark,
  'UPI': Smartphone,
  'System Closure': AlertCircle,
};

const recordPaymentPageFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
});

type RecordPaymentPageFormValues = z.infer<typeof recordPaymentPageFormSchema>;

export interface IndividualPaymentDetails {
  schemeId: string;
  paymentDate: string; // ISO
  modeOfPayment: PaymentMode[];
  numberOfMonths: number;
}

const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
    },
  }),
};

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [allRecordableSchemes, setAllRecordableSchemes] = useState<Scheme[]>([]);
  const [allGroups, setAllGroups] = useState<GroupDetail[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<number[]>([]); // Store numbers
  const [monthsToPayPerScheme, setMonthsToPayPerScheme] = useState<{ [schemeId: number]: number }>({}); // Key is number
  const [paymentModePerScheme, setPaymentModePerScheme] = useState<{ [schemeId: number]: PaymentMode[] }>({}); // Key is number

  const [isSchemePeekPanelOpen, setIsSchemePeekPanelOpen] = useState(false);
  const [schemeForPeekPanel, setSchemeForPeekPanel] = useState<Scheme | null>(null);

  const [suggestedGroup, setSuggestedGroup] = useState<GroupDetail | null>(null);
  const [activeGroupSelection, setActiveGroupSelection] = useState<string | null>(null);
  const [groupNameSuggestions, setGroupNameSuggestions] = useState<GroupDetail[]>([]);
  
  const [processingPayment, setProcessingPayment] = useState(false);

  const form = useForm<RecordPaymentPageFormValues>({
    resolver: zodResolver(recordPaymentPageFormSchema),
    defaultValues: {
      paymentDate: new Date(),
    },
    mode: 'onTouched',
  });

  // Removed getMockSchemeById as it's part of mock-data and not needed here directly

  useEffect(() => {
    const initialGroupSearchParam = searchParams.get('group');
    const loadedSchemes = getMockSchemes().filter(s => {
      if (s.status === 'Active' || s.status === 'Overdue') {
        for (let i = 0; i < s.payments.length; i++) {
          if (getPaymentStatus(s.payments[i], s.startDate) !== 'Paid') {
            let allPreviousPaid = true;
            for (let j = 0; j < i; j++) {
              if (getPaymentStatus(s.payments[j], s.startDate) !== 'Paid') {
                allPreviousPaid = false;
                break;
              }
            }
            if (allPreviousPaid) return true;
          }
        }
      }
      return false;
    })
    .sort((a,b) => {
      const nextDueA = a.payments.find(p => getPaymentStatus(p, a.startDate) !== 'Paid');
      const nextDueB = b.payments.find(p => getPaymentStatus(p, b.startDate) !== 'Paid');
      if (nextDueA && nextDueB) {
        const dateDiff = parseISO(nextDueA.dueDate).getTime() - parseISO(nextDueB.dueDate).getTime();
        if (dateDiff !== 0) return dateDiff;
      }
      return a.customerName.localeCompare(b.customerName);
    });

    setAllRecordableSchemes(loadedSchemes);
    const loadedGroups = getGroupDetails();
    setAllGroups(loadedGroups);
    setPageLoading(false);

    if (initialGroupSearchParam) {
      const decodedInitialSearch = decodeURIComponent(initialGroupSearchParam);
      setSearchTerm(decodedInitialSearch);
      const lowerInitialSearchTerm = decodedInitialSearch.toLowerCase();
      const exactMatchGroup = loadedGroups.find(g => g.groupName.toLowerCase() === lowerInitialSearchTerm);
      setSuggestedGroup(exactMatchGroup || null);
      if (exactMatchGroup) {
        setGroupNameSuggestions([]);
      } else {
        const partialMatches = loadedGroups.filter(g => g.groupName.toLowerCase().includes(lowerInitialSearchTerm));
        setGroupNameSuggestions(partialMatches.slice(0, 5));
      }
    }
  }, [searchParams]);


  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);

    if (activeGroupSelection && newSearchTerm.toLowerCase() !== activeGroupSelection.toLowerCase()) {
      setActiveGroupSelection(null);
    }

    if (newSearchTerm.trim() === '') {
      setSuggestedGroup(null);
      setGroupNameSuggestions([]);
      return;
    }

    const lowerSearchTerm = newSearchTerm.toLowerCase();
    const exactMatchGroup = allGroups.find(g => g.groupName.toLowerCase() === lowerSearchTerm);
    setSuggestedGroup(exactMatchGroup || null);

    if (exactMatchGroup) {
      setGroupNameSuggestions([]);
    } else {
      const partialMatches = allGroups.filter(g => g.groupName.toLowerCase().includes(lowerSearchTerm));
      setGroupNameSuggestions(partialMatches.slice(0, 5));
    }
  };

  const handleSuggestionClick = (group: GroupDetail) => {
    setSearchTerm(group.groupName);
    setSuggestedGroup(group);
    setGroupNameSuggestions([]);
  };

  const handleToggleGroupSuggestion = (groupToToggle: GroupDetail) => {
    const groupSchemeIds = groupToToggle.schemes // scheme.id is number
      .filter(s => allRecordableSchemes.some(rs => rs.id === s.id && (rs.durationMonths - (rs.paymentsMadeCount || 0)) > 0))
      .map(s => s.id); // This correctly maps to number[]

    let newSelectedIds = [...selectedSchemeIds]; // selectedSchemeIds is number[]
    let newMonths = { ...monthsToPayPerScheme };
    let newModes = { ...paymentModePerScheme };

    if (activeGroupSelection === groupToToggle.groupName) {
      // groupSchemeIds is number[], selectedSchemeIds is number[]
      newSelectedIds = selectedSchemeIds.filter(id => !groupSchemeIds.includes(id));
      groupSchemeIds.forEach(id => { // id is number
        delete newMonths[id];
        delete newModes[id];
      });
      setActiveGroupSelection(null);
    } else {
      const currentSelectedSet = new Set(selectedSchemeIds); // selectedSchemeIds is number[]
      groupSchemeIds.forEach(id => currentSelectedSet.add(id)); // id is number
      newSelectedIds = Array.from(currentSelectedSet);

      groupSchemeIds.forEach(id => { // id is number
        const scheme = allRecordableSchemes.find(s => s.id === id); // s.id is number
        const maxMonths = scheme ? (scheme.durationMonths - (scheme.paymentsMadeCount || 0)) : 1;
        if (!newMonths[id] || newMonths[id] === 0) {
          newMonths[id] = maxMonths > 0 ? 1 : 0;
        }
        if (!newModes[id] || newModes[id].length === 0) {
          newModes[id] = ['Cash'];
        }
      });
      setActiveGroupSelection(groupToToggle.groupName);
    }

    setSelectedSchemeIds(newSelectedIds);
    setMonthsToPayPerScheme(newMonths);
    setPaymentModePerScheme(newModes);
    setSearchTerm('');
    setSuggestedGroup(null);
    setGroupNameSuggestions([]);
  };

  const filteredSchemes = useMemo(() => {
    const selectedItems = allRecordableSchemes
      .filter(s => selectedSchemeIds.includes(s.id))
      .sort((a, b) => {
        const indexA = selectedSchemeIds.indexOf(a.id);
        const indexB = selectedSchemeIds.indexOf(b.id);
        return indexA - indexB;
      });

    let unselectedItems = allRecordableSchemes.filter(s => !selectedSchemeIds.includes(s.id));

    if (searchTerm && (!suggestedGroup || groupNameSuggestions.length > 0) && !activeGroupSelection) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      unselectedItems = unselectedItems.filter(
        (s) =>
          s.customerName.toLowerCase().includes(lowerSearchTerm) ||
          s.id.toString().toLowerCase().includes(lowerSearchTerm) || // s.id is number
          (s.customerGroupName && s.customerGroupName.toLowerCase().includes(lowerSearchTerm))
      );
    }

    unselectedItems.sort((a, b) => {
      const nameCompare = a.customerName.localeCompare(b.customerName);
      if (nameCompare !== 0) return nameCompare;
      return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
    });

    return [...selectedItems, ...unselectedItems];
  }, [allRecordableSchemes, searchTerm, selectedSchemeIds, suggestedGroup, groupNameSuggestions, activeGroupSelection]);

  const handleSchemeSelectionToggle = (schemeId: number, checked: boolean) => { // schemeId is number
    setSelectedSchemeIds((prevIds) => // prevIds is number[]
      checked ? [...prevIds, schemeId] : prevIds.filter((id) => id !== schemeId)
    );

    if (checked) {
      setMonthsToPayPerScheme((prevMonths) => { // prevMonths keys are numbers
        const newMonths = { ...prevMonths };
        if (!newMonths[schemeId] || newMonths[schemeId] === 0) { // schemeId is number
          const scheme = allRecordableSchemes.find(s => s.id === schemeId); // s.id is number
          const maxMonths = scheme ? (scheme.durationMonths - (scheme.paymentsMadeCount || 0)) : 1;
          newMonths[schemeId] = maxMonths > 0 ? 1 : 0;
        }
        return newMonths;
      });
      setPaymentModePerScheme((prevModes) => {
        const newModes = { ...prevModes };
        if (!newModes[schemeId] || newModes[schemeId].length === 0) {
          newModes[schemeId] = ['Cash'];
        }
        return newModes;
      });
    } else {
      setMonthsToPayPerScheme(prev => {
          const newMonths = {...prev};
          delete newMonths[schemeId]; // schemeId is number
          return newMonths;
      });
      setPaymentModePerScheme(prev => { // prev keys are numbers
          const newModes = {...prev};
          delete newModes[schemeId]; // schemeId is number
          return newModes;
      });
    }
  };

  const handleMonthsToPayChange = (schemeId: number, delta: number) => { // schemeId is number
    const scheme = allRecordableSchemes.find((s) => s.id === schemeId); // s.id is number
    if (!scheme) return;

    setMonthsToPayPerScheme((prevMonths) => { // prevMonths keys are numbers
      const currentMonths = prevMonths[schemeId] || 0; // schemeId is number
      let newMonthsCount = currentMonths + delta;
      const maxMonths = scheme.durationMonths - (scheme.paymentsMadeCount || 0);

      if (newMonthsCount < 1 && maxMonths > 0) newMonthsCount = 1;
      if (newMonthsCount < 0 && maxMonths <= 0) newMonthsCount = 0;
      if (newMonthsCount > maxMonths) newMonthsCount = maxMonths;

      return { ...prevMonths, [schemeId]: newMonthsCount }; // schemeId is number
    });
  };

  const handlePaymentModeChange = (schemeId: number, mode: PaymentMode, checked: boolean) => { // schemeId is number
    setPaymentModePerScheme(prev => { // prev keys are numbers
      const currentModesForScheme = prev[schemeId] || []; // schemeId is number
      const newModesForScheme = checked
        ? [...currentModesForScheme, mode]
        : currentModesForScheme.filter(m => m !== mode);
      return { ...prev, [schemeId]: newModesForScheme }; // schemeId is number
    });
  };

  const totalAmountForSelectedSchemes = useMemo(() => {
    return selectedSchemeIds.reduce((total, schemeId) => {
      const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
      const months = monthsToPayPerScheme[schemeId] || 0;
      if (scheme && months > 0) {
        return total + scheme.monthlyPaymentAmount * months;
      }
      return total;
    }, 0);
  }, [selectedSchemeIds, monthsToPayPerScheme, allRecordableSchemes]); // selectedSchemeIds is number[], monthsToPayPerScheme keys are numbers

  const isSubmissionDisabled = useMemo(() => {
    if (processingPayment) return true;
    if (selectedSchemeIds.length === 0) return true;

    let atLeastOneSchemeHasMonths = false;
    for (const schemeId of selectedSchemeIds) { // schemeId is number
      const months = monthsToPayPerScheme[schemeId] || 0; // schemeId is number
      if (months > 0) {
        atLeastOneSchemeHasMonths = true;
        const modes = paymentModePerScheme[schemeId] || []; // schemeId is number
        if (modes.length === 0) {
          return true;
        }
      }
    }
    if (!atLeastOneSchemeHasMonths && selectedSchemeIds.length > 0) return true;

    return !form.formState.isValid;
  }, [processingPayment, selectedSchemeIds, monthsToPayPerScheme, paymentModePerScheme, form.formState.isValid]); // Dependencies are correct

  const handleShowSchemePeek = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, schemeId: number) => { // schemeId is number
    event.preventDefault();
    const schemeToShow = allRecordableSchemes.find(s => s.id === schemeId); // s.id is number
    if (schemeToShow) {
      setSchemeForPeekPanel(schemeToShow);
      setIsSchemePeekPanelOpen(true);
    }
  };

  const handleSubmit = async (values: RecordPaymentPageFormValues) => {
    setProcessingPayment(true);
    let paymentsToSubmit = 0;
    let totalRecordedAmount = 0;
    let successfulSubmissions = 0;
    let failedSubmissions = 0;

    for (const schemeId of selectedSchemeIds) {
      const initialSchemeState = allRecordableSchemes.find((s) => s.id === schemeId);
      const numberOfMonths = monthsToPayPerScheme[schemeId];
      const modes = paymentModePerScheme[schemeId] || [];

      if (initialSchemeState && numberOfMonths > 0 && modes.length > 0) {
        paymentsToSubmit++;
        let currentSchemeStateForLoop: Scheme | undefined = JSON.parse(JSON.stringify(initialSchemeState)); // Use a deep copy for the loop

        for (let i = 0; i < numberOfMonths; i++) {
          if (!currentSchemeStateForLoop) break; // Should not happen if initial state was good

          const paymentToUpdate = currentSchemeStateForLoop.payments.find(p => getPaymentStatus(p, currentSchemeStateForLoop!.startDate) !== 'Paid');
          
          if (paymentToUpdate) {
            const singlePaymentResult = updateMockSchemePayment(currentSchemeStateForLoop.id, paymentToUpdate.id, {
                paymentDate: formatISO(values.paymentDate),
                modeOfPayment: modes,
                amountPaid: currentSchemeStateForLoop.monthlyPaymentAmount, // Amount paid is fixed to monthly amount here
            });

            if (singlePaymentResult) {
              totalRecordedAmount += currentSchemeStateForLoop.monthlyPaymentAmount;
              successfulSubmissions++;
              currentSchemeStateForLoop = singlePaymentResult; // Update currentSchemeStateForLoop with the fresh state
            } else {
              failedSubmissions++;
              break; // Stop processing this scheme if one payment fails
            }
          } else {
            // No more unpaid installments found for this scheme, even though we expected to pay more.
            failedSubmissions++; 
            break;
          }
        }
      }
    }

    if (successfulSubmissions > 0) {
      toast({
        title: "Payments Recorded",
        description: `${successfulSubmissions} payment installments totaling ${formatCurrency(totalRecordedAmount)} recorded. ${failedSubmissions > 0 ? `${failedSubmissions} errors.` : ''}`,
      });
      // Refresh data for the page by re-fetching and re-filtering
      const reloadedSchemes = getMockSchemes().filter(s => {
          if (s.status === 'Active' || s.status === 'Overdue') {
              for (let i = 0; i < s.payments.length; i++) {
                  if (getPaymentStatus(s.payments[i], s.startDate) !== 'Paid') {
                      let allPreviousPaid = true;
                      for (let j = 0; j < i; j++) {
                          if (getPaymentStatus(s.payments[j], s.startDate) !== 'Paid') { allPreviousPaid = false; break; }
                      }
                      if (allPreviousPaid) return true;
                  }
              }
          }
          return false;
      }).sort((a,b) => { // Ensure consistent sort order after reload
        const nextDueA = a.payments.find(p => getPaymentStatus(p, a.startDate) !== 'Paid');
        const nextDueB = b.payments.find(p => getPaymentStatus(p, b.startDate) !== 'Paid');
        if (nextDueA && nextDueB) {
            const dateDiff = parseISO(nextDueA.dueDate).getTime() - parseISO(nextDueB.dueDate).getTime();
            if (dateDiff !== 0) return dateDiff;
        }
        return a.customerName.localeCompare(b.customerName);
      });
      setAllRecordableSchemes(reloadedSchemes);
      
      setSelectedSchemeIds([]);
      setMonthsToPayPerScheme({});
      setPaymentModePerScheme({});
      setActiveGroupSelection(null);
      setSearchTerm('');
      setSuggestedGroup(null);
      setGroupNameSuggestions([]);
      form.reset({paymentDate: new Date()});

    } else if (failedSubmissions > 0 && paymentsToSubmit > 0) {
      toast({ title: "Error Recording Payments", description: `Could not record ${failedSubmissions} payment installments.`, variant: "destructive" });
    } else if (paymentsToSubmit === 0 && selectedSchemeIds.length > 0) {
      toast({ title: "No Payments to Record", description: "Ensure months to pay and payment modes are set for selected schemes.", variant: "default" });
    }
    setProcessingPayment(false);
  };
  
  if (pageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-headline font-semibold">Record Payments</h1>
        <div></div> {/* Spacer */}
      </div>

      <Card className="mb-8">
        <CardHeader>
            <CardTitle className="text-xl">Search & Select Schemes</CardTitle>
            <CardDescription>
              Search by customer, scheme ID, or type a group name. Click cards to select schemes.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="my-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer, scheme ID, or type group name..."
                  value={searchTerm}
                  onChange={handleSearchTermChange}
                  className="pl-9 text-base"
                  disabled={processingPayment}
                />
              </div>
              {groupNameSuggestions.length > 0 && (
                <div className="mt-1 border rounded-md shadow-sm bg-popover max-h-40 overflow-y-auto z-10 relative">
                  <ul className="py-1">
                    {groupNameSuggestions.map(group => (
                      <li
                        key={group.groupName}
                        className="px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => handleSuggestionClick(group)}
                      >
                        {group.groupName} ({group.customerNames.length} customers)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {suggestedGroup && (
                <div className="flex items-center gap-2 p-2 border border-dashed rounded-md bg-muted/50">
                  <Info className="h-4 w-4 text-primary shrink-0"/>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-left text-primary hover:underline"
                    onClick={() => handleToggleGroupSuggestion(suggestedGroup)}
                  >
                    {activeGroupSelection === suggestedGroup.groupName
                      ? `Clear selection for group: ${suggestedGroup.groupName}`
                      : `Select all from group: ${suggestedGroup.groupName}`}
                    {` (Customers: ${suggestedGroup.customerNames.length})`}
                  </Button>
                </div>
              )}
            </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredSchemes.map((scheme, index) => {
            const isSelected = selectedSchemeIds.includes(scheme.id);
            const currentMonthsToPay = monthsToPayPerScheme[scheme.id] || 0;
            const maxMonthsForThisScheme = scheme.durationMonths - (scheme.paymentsMadeCount || 0);
            const currentPaymentModes = paymentModePerScheme[scheme.id] || [];

            return (
              <motion.div 
                key={scheme.id}
                variants={listItemVariants}
                initial="hidden"
                animate="visible"
                custom={index}
                onClick={() => { if (maxMonthsForThisScheme > 0 && !processingPayment) handleSchemeSelectionToggle(scheme.id, !isSelected)}}
                className={cn(
                  "p-4 border rounded-lg transition-all flex flex-col gap-3 shadow-sm hover:shadow-md",
                  isSelected ? "bg-primary/10 border-primary ring-2 ring-primary shadow-lg" : "bg-card",
                  processingPayment && "opacity-70",
                  maxMonthsForThisScheme <= 0 ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                )}
              >
                <div className="flex-grow space-y-1.5">
                  <div className="flex justify-between items-start">
                    <a href={`/schemes/${scheme.id}`} onClick={(e) => handleShowSchemePeek(e, scheme.id)} // scheme.id is number
                      className="font-semibold text-primary hover:underline text-lg flex items-center">
                      {scheme.customerName} <ExternalLink className="h-4 w-4 ml-1.5"/>
                    </a>
                    <span className="font-mono text-sm font-bold text-muted-foreground">{scheme.id}</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {scheme.customerGroupName && <div className="flex items-center gap-1.5"><Users className="h-4 w-4"/>{scheme.customerGroupName}</div>}
                    <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4"/>{formatDate(scheme.startDate, 'dd MMM yyyy')}</div>
                    <div className="flex items-center gap-1.5"><DollarSign className="h-4 w-4"/>{formatCurrency(scheme.monthlyPaymentAmount)} / month</div>
                  </div>
                </div>

                <div className="my-2 flex items-center gap-3">
                  <div className="flex-grow">
                    <SegmentedProgressBar scheme={scheme} paidMonthsCount={scheme.paymentsMadeCount || 0} monthsToRecord={isSelected ? currentMonthsToPay : 0} className="h-2.5" />
                  </div>
                  <p className="text-sm text-muted-foreground flex-shrink-0">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths} paid</p>
                </div>
                
                <AnimatePresence>
                  {isSelected && maxMonthsForThisScheme > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 flex items-center justify-between gap-2 p-2.5 border-t border-primary/20">
                        <span className="text-sm font-medium">Months to Pay:</span>
                        <div className="flex items-center gap-1.5">
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full flex-shrink-0" onClick={(e) => { e.stopPropagation(); handleMonthsToPayChange(scheme.id, -1);}} disabled={currentMonthsToPay <= 1 || processingPayment}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center font-semibold text-sm tabular-nums">{currentMonthsToPay}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full flex-shrink-0" onClick={(e) => { e.stopPropagation(); handleMonthsToPayChange(scheme.id, 1);}} disabled={currentMonthsToPay >= maxMonthsForThisScheme || processingPayment}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <span className="text-sm font-medium">Total: {formatCurrency(scheme.monthlyPaymentAmount * currentMonthsToPay)}</span>
                      </div>

                      {currentMonthsToPay > 0 && (
                        <div className="mt-1 p-2.5 border-t border-primary/20">
                          <span className="text-sm font-medium block mb-2">Mode of Payment:</span>
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {availablePaymentModes.map((mode) => {
                              const Icon = paymentModeIcons[mode];
                              return (
                                <div key={mode} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`mop-${scheme.id}-${mode}`}
                                    checked={currentPaymentModes.includes(mode)}
                                    onCheckedChange={(checked) => handlePaymentModeChange(scheme.id, mode, !!checked)}
                                    onClick={(e) => e.stopPropagation()} 
                                    disabled={processingPayment}
                                    className="h-5 w-5"
                                  />
                                  <label htmlFor={`mop-${scheme.id}-${mode}`} className="text-sm font-normal flex items-center gap-1.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                                    {mode}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                          {currentPaymentModes.length === 0 && currentMonthsToPay > 0 && (
                            <p className="text-sm text-destructive mt-1.5">Select a payment mode.</p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {maxMonthsForThisScheme <= 0 && (
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium text-center p-2 border-t border-green-500/20 bg-green-500/10 rounded-b-md">All payments made!</p>
                )}
              </motion.div>
            );
          })}
          {filteredSchemes.length === 0 && !pageLoading && (
            <p className="text-center text-muted-foreground py-6 col-span-1 md:col-span-2 lg:col-span-3 text-base">
              {searchTerm ? "No matching schemes found." : "No recordable schemes available."}
            </p>
          )}
      </div>

      <Card className="sticky bottom-0 z-10 shadow-lg border-t-4 border-primary/30 bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4 md:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base">Payment Date (for all selected)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant={'outline'}
                            className={cn('w-full pl-3 text-left font-normal text-base', !field.value && 'text-muted-foreground')}
                            disabled={processingPayment}
                          >
                            {field.value ? format(field.value, 'dd MMM yyyy') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01") || processingPayment}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedSchemeIds.length > 0 && !isSubmissionDisabled && (
                <div className="text-right font-semibold text-lg mt-2 pr-1">
                  Grand Total: {formatCurrency(totalAmountForSelectedSchemes)}
                </div>
              )}
              {selectedSchemeIds.length === 0 && (
                <div className="text-center text-muted-foreground py-2 flex items-center justify-center gap-2 text-base">
                  <AlertCircle className="h-5 w-5"/> Please select one or more schemes to record payments.
                </div>
              )}
              {selectedSchemeIds.length > 0 && isSubmissionDisabled && !processingPayment && (
                <div className="text-center text-destructive py-2 flex items-center justify-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4"/> Ensure all selected schemes with months to pay also have a payment mode selected, and payment date is valid.
                </div>
              )}
              
              <Button type="submit" disabled={isSubmissionDisabled} size="lg" className="w-full">
                {processingPayment ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Confirm & Record Payment(s)
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <SchemeHistoryPanel
        isOpen={isSchemePeekPanelOpen}
        onClose={() => setIsSchemePeekPanelOpen(false)}
        scheme={schemeForPeekPanel}
      />
    </div>
  );
}

