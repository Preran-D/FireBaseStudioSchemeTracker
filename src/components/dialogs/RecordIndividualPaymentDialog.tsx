
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Loader2, Search, Plus, Minus, ExternalLink, AlertCircle, CreditCard, Landmark, Smartphone, Users, Info, CalendarDays, DollarSign } from 'lucide-react';
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { formatISO, parseISO, format } from 'date-fns';
import { motion } from 'framer-motion'; // Ensure framer-motion is imported
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar';
import { SchemeHistoryPanel } from '@/components/shared/SchemeHistoryPanel';

const availablePaymentModes: PaymentMode[] = ['Card', 'Cash', 'UPI'];
const paymentModeIcons: Record<PaymentMode, React.ElementType> = {
  'Card': CreditCard,
  'Cash': Landmark,
  'UPI': Smartphone,
  'System Closure': AlertCircle,
};

const recordIndividualPaymentFormSchema = z.object({
  paymentDate: z.date({ required_error: 'Payment date is required.' }),
});

type RecordIndividualPaymentFormValues = z.infer<typeof recordIndividualPaymentFormSchema>;

export interface IndividualPaymentDetails {
  schemeId: string;
  paymentDate: string; // ISO
  modeOfPayment: PaymentMode[];
  numberOfMonths: number;
}

interface RecordIndividualPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allRecordableSchemes: Scheme[];
  allGroups: GroupDetail[];
  onSubmit: (details: IndividualPaymentDetails) => void;
  isLoading?: boolean;
  initialSearchTerm?: string;
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


export function RecordIndividualPaymentDialog({
  isOpen,
  onClose,
  allRecordableSchemes,
  allGroups,
  onSubmit,
  isLoading,
  initialSearchTerm,
}: RecordIndividualPaymentDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [monthsToPayPerScheme, setMonthsToPayPerScheme] = useState<{ [schemeId: string]: number }>({});
  const [paymentModePerScheme, setPaymentModePerScheme] = useState<{ [schemeId: string]: PaymentMode[] }>({});

  const [isSchemePeekPanelOpen, setIsSchemePeekPanelOpen] = useState(false);
  const [schemeForPeekPanel, setSchemeForPeekPanel] = useState<Scheme | null>(null);

  const [suggestedGroup, setSuggestedGroup] = useState<GroupDetail | null>(null);
  const [activeGroupSelection, setActiveGroupSelection] = useState<string | null>(null);
  const [groupNameSuggestions, setGroupNameSuggestions] = useState<GroupDetail[]>([]);


  const form = useForm<RecordIndividualPaymentFormValues>({
    resolver: zodResolver(recordIndividualPaymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ paymentDate: new Date() });
      setSelectedSchemeIds([]);
      setMonthsToPayPerScheme({});
      setPaymentModePerScheme({});
      setIsSchemePeekPanelOpen(false);
      setSchemeForPeekPanel(null);
      setActiveGroupSelection(null);
      

      if (initialSearchTerm) {
        setSearchTerm(initialSearchTerm); 
        const lowerInitialSearchTerm = initialSearchTerm.toLowerCase();
        const exactMatchGroup = allGroups.find(g => g.groupName.toLowerCase() === lowerInitialSearchTerm);
        setSuggestedGroup(exactMatchGroup || null); 
        if (exactMatchGroup) {
          setGroupNameSuggestions([]);
        } else {
           const partialMatches = allGroups.filter(g =>
            g.groupName.toLowerCase().includes(lowerInitialSearchTerm)
          );
          setGroupNameSuggestions(partialMatches.slice(0, 5));
        }
      } else {
        setSearchTerm('');
        setSuggestedGroup(null);
        setGroupNameSuggestions([]);
      }
    }
  }, [isOpen, form, initialSearchTerm, allGroups]);

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
      const partialMatches = allGroups.filter(g =>
        g.groupName.toLowerCase().includes(lowerSearchTerm)
      );
      setGroupNameSuggestions(partialMatches.slice(0, 5)); 
    }
  };
  
  const handleSuggestionClick = (group: GroupDetail) => {
    setSearchTerm(group.groupName); 
    setSuggestedGroup(group); 
    setGroupNameSuggestions([]); 
  };


  const handleToggleGroupSuggestion = (groupToToggle: GroupDetail) => {
    const groupSchemeIds = groupToToggle.schemes
      .filter(s => allRecordableSchemes.some(rs => rs.id === s.id && (rs.durationMonths - (rs.paymentsMadeCount || 0)) > 0))
      .map(s => s.id);

    let newSelectedIds = [...selectedSchemeIds];
    let newMonths = { ...monthsToPayPerScheme };
    let newModes = { ...paymentModePerScheme };

    if (activeGroupSelection === groupToToggle.groupName) { 
      newSelectedIds = selectedSchemeIds.filter(id => !groupSchemeIds.includes(id));
      setActiveGroupSelection(null);
    } else { 
      const currentSelectedSet = new Set(selectedSchemeIds);
      groupSchemeIds.forEach(id => currentSelectedSet.add(id));
      newSelectedIds = Array.from(currentSelectedSet);

      groupSchemeIds.forEach(id => {
        const scheme = allRecordableSchemes.find(s => s.id === id);
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

    if (searchTerm && (!suggestedGroup || groupNameSuggestions.length > 0)) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      unselectedItems = unselectedItems.filter(
        (s) =>
          s.customerName.toLowerCase().includes(lowerSearchTerm) ||
          s.id.toLowerCase().includes(lowerSearchTerm) ||
          (s.customerGroupName && s.customerGroupName.toLowerCase().includes(lowerSearchTerm))
      );
    }

    unselectedItems.sort((a, b) => {
      const nameCompare = a.customerName.localeCompare(b.customerName);
      if (nameCompare !== 0) return nameCompare;
      return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
    });

    return [...selectedItems, ...unselectedItems];
  }, [allRecordableSchemes, searchTerm, selectedSchemeIds, suggestedGroup, groupNameSuggestions]);


  const handleSchemeSelectionToggle = (schemeId: string, checked: boolean) => {
    setSelectedSchemeIds((prevIds) =>
      checked ? [...prevIds, schemeId] : prevIds.filter((id) => id !== schemeId)
    );

    if (checked) {
      setMonthsToPayPerScheme((prevMonths) => {
        const newMonths = { ...prevMonths };
        if (!newMonths[schemeId] || newMonths[schemeId] === 0) { 
          const scheme = allRecordableSchemes.find(s => s.id === schemeId);
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
    }
  };

  const handleMonthsToPayChange = (schemeId: string, delta: number) => {
    const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
    if (!scheme) return;

    setMonthsToPayPerScheme((prevMonths) => {
      const currentMonths = prevMonths[schemeId] || 0;
      let newMonthsCount = currentMonths + delta;
      const maxMonths = scheme.durationMonths - (scheme.paymentsMadeCount || 0);

      if (newMonthsCount < 1 && maxMonths > 0) newMonthsCount = 1;
      if (newMonthsCount < 0 && maxMonths <= 0) newMonthsCount = 0; 
      if (newMonthsCount > maxMonths) newMonthsCount = maxMonths;

      return { ...prevMonths, [schemeId]: newMonthsCount };
    });
  };

  const handlePaymentModeChange = (schemeId: string, mode: PaymentMode, checked: boolean) => {
    setPaymentModePerScheme(prev => {
      const currentModesForScheme = prev[schemeId] || [];
      const newModesForScheme = checked
        ? [...currentModesForScheme, mode]
        : currentModesForScheme.filter(m => m !== mode);
      return { ...prev, [schemeId]: newModesForScheme };
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
  }, [selectedSchemeIds, monthsToPayPerScheme, allRecordableSchemes]);

  const isSubmissionDisabled = useMemo(() => {
    if (isLoading) return true;
    if (selectedSchemeIds.length === 0) return true;

    let atLeastOneSchemeHasMonths = false;
    for (const schemeId of selectedSchemeIds) {
      const months = monthsToPayPerScheme[schemeId] || 0;
      if (months > 0) {
        atLeastOneSchemeHasMonths = true;
        const modes = paymentModePerScheme[schemeId] || [];
        if (modes.length === 0) {
          return true; 
        }
      }
    }
    if (!atLeastOneSchemeHasMonths && selectedSchemeIds.length > 0) return true; 

    return !form.formState.isValid; 
  }, [isLoading, selectedSchemeIds, monthsToPayPerScheme, paymentModePerScheme, form.formState.isValid]);

  const handleShowSchemePeek = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, schemeId: string) => {
    event.preventDefault();
    const schemeToShow = allRecordableSchemes.find(s => s.id === schemeId);
    if (schemeToShow) {
      setSchemeForPeekPanel(schemeToShow);
      setIsSchemePeekPanelOpen(true);
    }
  };

  const handleSubmit = (values: RecordIndividualPaymentFormValues) => {
    let paymentsToSubmit = 0;
    selectedSchemeIds.forEach((schemeId) => {
      const scheme = allRecordableSchemes.find((s) => s.id === schemeId);
      const numberOfMonths = monthsToPayPerScheme[schemeId];
      const modes = paymentModePerScheme[schemeId] || [];

      if (scheme && numberOfMonths > 0 && modes.length > 0) {
        paymentsToSubmit++;
        onSubmit({
          schemeId: scheme.id,
          paymentDate: formatISO(values.paymentDate),
          modeOfPayment: modes,
          numberOfMonths: numberOfMonths,
        });
      }
    });
    if (paymentsToSubmit === 0 && selectedSchemeIds.length > 0) {
      console.warn("Submit called with selected schemes but no valid payment configurations (0 months or no payment mode).");
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-headline text-xl">Record Payment(s)</DialogTitle>
            <DialogDescription className="text-base">
              Search customer, scheme ID, or type group name for suggestions. Select schemes and specify payment details.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 flex-shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, scheme ID, or type group name..."
                value={searchTerm}
                onChange={handleSearchTermChange}
                className="pl-9 text-base"
                disabled={isLoading}
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
                <Info className="h-4 w-4 text-primary"/>
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

          
          <div className="flex-1 min-h-0 h-0 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3">
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
                    className={cn(
                      "p-4 border rounded-lg transition-all flex flex-col gap-3", 
                      isSelected ? "bg-primary/10 border-primary shadow-lg" : "bg-card",
                      isLoading && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        type="button"
                        id={`scheme-select-${scheme.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSchemeSelectionToggle(scheme.id, !!checked)}
                        disabled={isLoading || maxMonthsForThisScheme <= 0}
                        className="mt-1 flex-shrink-0 h-5 w-5" 
                      />
                      <label htmlFor={`scheme-select-${scheme.id}`} className="flex-grow cursor-pointer space-y-1">
                        <div className="flex justify-between items-start">
                          <a href={`/schemes/${scheme.id}`} onClick={(e) => handleShowSchemePeek(e, scheme.id)}
                            className="font-semibold text-primary hover:underline text-base flex items-center"> 
                            {scheme.customerName} <ExternalLink className="h-3.5 w-3.5 ml-1.5"/> 
                          </a>
                          <span className="font-mono text-sm font-bold text-muted-foreground">{scheme.id.toUpperCase()}</span> 
                        </div>
                        <div className="text-sm text-muted-foreground space-y-0.5"> 
                            {scheme.customerGroupName && <div className="flex items-center gap-1.5"><Users className="h-4 w-4"/>{scheme.customerGroupName}</div>}
                            <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4"/>{formatDate(scheme.startDate, 'dd MMM yyyy')}</div>
                            <div className="flex items-center gap-1.5"><DollarSign className="h-4 w-4"/>{formatCurrency(scheme.monthlyPaymentAmount)} / month</div>
                        </div>
                      </label>
                    </div>

                    <div className="my-2 flex items-center gap-3"> 
                      <div className="flex-grow">
                        <SegmentedProgressBar scheme={scheme} paidMonthsCount={scheme.paymentsMadeCount || 0} monthsToRecord={isSelected ? currentMonthsToPay : 0} className="h-2.5" /> 
                      </div>
                      <p className="text-sm text-muted-foreground flex-shrink-0">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths} paid</p> 
                    </div>

                    {isSelected && maxMonthsForThisScheme > 0 && (
                      <>
                        <div className="mt-1 flex items-center justify-between gap-2 p-2.5 border-t border-primary/20"> 
                          <span className="text-sm font-medium">Months to Pay:</span> 
                          <div className="flex items-center gap-1.5">
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full flex-shrink-0" onClick={() => handleMonthsToPayChange(scheme.id, -1)} disabled={currentMonthsToPay <= 1 || isLoading}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center font-semibold text-sm tabular-nums">{currentMonthsToPay}</span> 
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full flex-shrink-0" onClick={() => handleMonthsToPayChange(scheme.id, 1)} disabled={currentMonthsToPay >= maxMonthsForThisScheme || isLoading}>
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
                                      type="button"
                                      id={`mop-${scheme.id}-${mode}`}
                                      checked={currentPaymentModes.includes(mode)}
                                      onCheckedChange={(checked) => handlePaymentModeChange(scheme.id, mode, !!checked)}
                                      disabled={isLoading}
                                      className="h-5 w-5"
                                    />
                                    <label htmlFor={`mop-${scheme.id}-${mode}`} className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"> 
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
                      </>
                    )}
                    {isSelected && maxMonthsForThisScheme <= 0 && (
                       <p className="text-sm text-green-700 dark:text-green-400 font-medium text-center p-2 border-t border-green-500/20 bg-green-500/10 rounded-b-md">All payments made!</p> 
                    )}
                  </motion.div>
                );
              })}
              {filteredSchemes.length === 0 && (
                <p className="text-center text-muted-foreground py-6 col-span-1 md:col-span-2 text-base"> 
                  {searchTerm ? "No matching schemes found." : "No recordable schemes available."}
                </p>
              )}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4 border-t mt-auto flex-shrink-0"> 
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
                            disabled={isLoading}
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
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01") || isLoading}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedSchemeIds.length > 0 && !isSubmissionDisabled && (
                <div className="text-right font-semibold text-base mt-2 pr-1"> 
                  Grand Total: {formatCurrency(totalAmountForSelectedSchemes)}
                </div>
              )}
              {selectedSchemeIds.length === 0 && (
                <div className="text-center text-muted-foreground py-2 flex items-center justify-center gap-2 text-base"> 
                  <AlertCircle className="h-5 w-5"/> Please select one or more schemes.
                </div>
              )}
               {selectedSchemeIds.length > 0 && isSubmissionDisabled && !isLoading && (
                 <div className="text-center text-destructive py-2 flex items-center justify-center gap-2 text-sm"> 
                    <AlertCircle className="h-4 w-4"/> Ensure all selected schemes with months to pay also have a payment mode selected.
                 </div>
              )}


              <DialogFooter className="pt-3 flex-shrink-0">
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} size="lg"> 
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmissionDisabled} size="lg"> 
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Confirm & Record Payment(s)
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <SchemeHistoryPanel
        isOpen={isSchemePeekPanelOpen}
        onClose={() => setIsSchemePeekPanelOpen(false)}
        scheme={schemeForPeekPanel}
      />
    </>
  );
}
