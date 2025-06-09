
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
import { CalendarIcon, Loader2, Search, Plus, Minus, ExternalLink, AlertCircle, CreditCard, Landmark, Smartphone, Users, Info } from 'lucide-react';
import { cn, formatDate, formatCurrency, getPaymentStatus } from '@/lib/utils';
import type { Scheme, Payment, PaymentMode, GroupDetail } from '@/types/scheme';
import { formatISO, parseISO, format } from 'date-fns';
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
      // suggestedGroup will be set by handleSearchTermChange via initialSearchTerm
      setActiveGroupSelection(null);
      setGroupNameSuggestions([]);


      if (initialSearchTerm) {
        setSearchTerm(initialSearchTerm);
        // Trigger search logic based on initial term to populate suggestedGroup if it's an exact match
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
      setGroupNameSuggestions(partialMatches.slice(0, 5)); // Limit to 5 suggestions
    }
  };
  
  const handleSuggestionClick = (group: GroupDetail) => {
    setSearchTerm(group.groupName); 
    // handleSearchTermChange will be triggered by setSearchTerm, which will set suggestedGroup
    setGroupNameSuggestions([]); 
  };


  const handleToggleGroupSuggestion = (groupToToggle: GroupDetail) => {
    const groupSchemeIds = groupToToggle.schemes
      .filter(s => allRecordableSchemes.some(rs => rs.id === s.id))
      .map(s => s.id);

    let newSelectedIds = [...selectedSchemeIds];
    let newMonths = { ...monthsToPayPerScheme };
    let newModes = { ...paymentModePerScheme };

    if (activeGroupSelection === groupToToggle.groupName) { // Deselecting
      newSelectedIds = selectedSchemeIds.filter(id => !groupSchemeIds.includes(id));
      // Optionally clear months/modes for deselected schemes
      groupSchemeIds.forEach(id => {
        // delete newMonths[id]; // Or reset to 0 if preferred
        // delete newModes[id]; // Or reset to []
      });
      setActiveGroupSelection(null);
    } else { // Selecting
      const currentSelectedSet = new Set(selectedSchemeIds);
      groupSchemeIds.forEach(id => currentSelectedSet.add(id));
      newSelectedIds = Array.from(currentSelectedSet);

      groupSchemeIds.forEach(id => {
        if (!newMonths[id] || newMonths[id] === 0) {
          const scheme = allRecordableSchemes.find(s => s.id === id);
          const maxMonths = scheme ? (scheme.durationMonths - (scheme.paymentsMadeCount || 0)) : 1;
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
    
    // Clear search term and explicit suggestion display after action
    // setSearchTerm(''); // Keep search term if user might want to fine-tune
    setSuggestedGroup(groupToToggle); // Keep the button visible but its text will update
    setGroupNameSuggestions([]); // Hide partial suggestions
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

    // Only filter unselected items if search term is active AND there's no exact group match button shown
    // OR if there are group name suggestions being shown (meaning it's a partial search)
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
    // If unchecking, consider clearing activeGroupSelection if this scheme was the last one keeping it active.
    // This can be complex, so for now, activeGroupSelection is primarily managed by the group suggestion button.
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
        <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-headline">Record Payment(s)</DialogTitle>
            <DialogDescription>
              Search by customer, scheme ID, or group name. Select schemes, specify months to pay and payment mode for each.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 flex-shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, scheme ID, or type group name..."
                value={searchTerm}
                onChange={handleSearchTermChange}
                className="pl-9"
                disabled={isLoading}
              />
            </div>
            {groupNameSuggestions.length > 0 && (
              <div className="mt-1 border rounded-md shadow-sm bg-popover max-h-40 overflow-y-auto z-10 relative">
                <ul className="py-1">
                  {groupNameSuggestions.map(group => (
                    <li
                      key={group.groupName}
                      className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                      onClick={() => handleSuggestionClick(group)}
                    >
                      {group.groupName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {suggestedGroup && (
              <div className="flex items-center gap-2 p-2 border border-dashed rounded-md bg-muted/50">
                <Info className="h-4 w-4 text-primary"/>
                <span className="text-sm text-muted-foreground">Matched Group:</span>
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm text-left" // Added text-left
                  onClick={() => handleToggleGroupSuggestion(suggestedGroup)}
                >
                  {activeGroupSelection === suggestedGroup.groupName
                    ? `Clear selection for group: ${suggestedGroup.groupName}`
                    : `Select all from group: ${suggestedGroup.groupName}`}
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 h-0 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
              {filteredSchemes.map((scheme) => {
                const isSelected = selectedSchemeIds.includes(scheme.id);
                const currentMonthsToPay = monthsToPayPerScheme[scheme.id] || 0;
                const maxMonthsForThisScheme = scheme.durationMonths - (scheme.paymentsMadeCount || 0);
                const currentPaymentModes = paymentModePerScheme[scheme.id] || [];

                return (
                  <div
                    key={scheme.id}
                    className={cn(
                      "p-3 border rounded-lg transition-all flex flex-col gap-2",
                      isSelected ? "bg-primary/10 border-primary shadow-md" : "bg-card",
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
                        className="mt-1 flex-shrink-0"
                      />
                      <label htmlFor={`scheme-select-${scheme.id}`} className="flex-grow cursor-pointer">
                        <div className="flex justify-between items-start mb-0.5">
                          <a href={`/schemes/${scheme.id}`} onClick={(e) => handleShowSchemePeek(e, scheme.id)}
                            className="font-medium text-primary hover:underline text-sm flex items-center">
                            {scheme.customerName} <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                          <span className="font-mono text-xs text-muted-foreground">{scheme.id.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {scheme.customerGroupName && <><Users className="h-3 w-3 inline mr-1 text-muted-foreground" />{scheme.customerGroupName} <br /></>}
                          Start Date: {formatDate(scheme.startDate, 'dd MMM yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Monthly Amt: {formatCurrency(scheme.monthlyPaymentAmount)}
                        </p>
                      </label>
                    </div>

                    <div className="my-1">
                      <SegmentedProgressBar scheme={scheme} paidMonthsCount={scheme.paymentsMadeCount || 0} monthsToRecord={isSelected ? currentMonthsToPay : 0} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-0.5 text-center">{scheme.paymentsMadeCount || 0} / {scheme.durationMonths} paid</p>
                    </div>

                    {isSelected && maxMonthsForThisScheme > 0 && (
                      <>
                        <div className="mt-1 flex items-center justify-between gap-2 p-2 border-t border-primary/20">
                          <span className="text-xs font-medium">Months to Pay:</span>
                          <div className="flex items-center gap-1.5">
                            <Button type="button" variant="outline" size="icon" className="h-6 w-6 rounded-full flex-shrink-0" onClick={() => handleMonthsToPayChange(scheme.id, -1)} disabled={currentMonthsToPay <= 1 || isLoading}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center font-semibold text-xs tabular-nums">{currentMonthsToPay}</span>
                            <Button type="button" variant="outline" size="icon" className="h-6 w-6 rounded-full flex-shrink-0" onClick={() => handleMonthsToPayChange(scheme.id, 1)} disabled={currentMonthsToPay >= maxMonthsForThisScheme || isLoading}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-xs font-medium">Total: {formatCurrency(scheme.monthlyPaymentAmount * currentMonthsToPay)}</span>
                        </div>

                        {currentMonthsToPay > 0 && (
                          <div className="mt-1 p-2 border-t border-primary/20">
                            <span className="text-xs font-medium block mb-1.5">Mode of Payment:</span>
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                              {availablePaymentModes.map((mode) => {
                                const Icon = paymentModeIcons[mode];
                                return (
                                  <div key={mode} className="flex items-center space-x-1.5">
                                    <Checkbox
                                      type="button"
                                      id={`mop-${scheme.id}-${mode}`}
                                      checked={currentPaymentModes.includes(mode)}
                                      onCheckedChange={(checked) => handlePaymentModeChange(scheme.id, mode, !!checked)}
                                      disabled={isLoading}
                                    />
                                    <label htmlFor={`mop-${scheme.id}-${mode}`} className="text-xs font-normal flex items-center gap-1 cursor-pointer">
                                      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                                      {mode}
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                            {currentPaymentModes.length === 0 && currentMonthsToPay > 0 && (
                              <p className="text-xs text-destructive mt-1">Select a payment mode for this scheme.</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {isSelected && maxMonthsForThisScheme <= 0 && (
                      <p className="text-xs text-green-600 font-medium text-center p-1.5 border-t border-green-500/20 bg-green-500/5 rounded-b-md">All payments made!</p>
                    )}
                  </div>
                );
              })}
              {filteredSchemes.length === 0 && (
                <p className="text-center text-muted-foreground py-6 col-span-1 md:col-span-2">
                  {searchTerm ? "No matching schemes found." : "No recordable schemes available."}
                </p>
              )}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 pt-3 border-t mt-auto flex-shrink-0">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Payment Date (for all selected)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant={'outline'}
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
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
                <div className="text-right font-semibold mt-2 pr-1">
                  Grand Total: {formatCurrency(totalAmountForSelectedSchemes)}
                </div>
              )}
              {selectedSchemeIds.length === 0 && (
                <div className="text-center text-muted-foreground py-2 flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Please select one or more schemes.
                </div>
              )}
              {selectedSchemeIds.length > 0 && isSubmissionDisabled && !isLoading && (
                <div className="text-center text-destructive py-2 flex items-center justify-center gap-2 text-xs">
                  <AlertCircle className="h-4 w-4" /> Ensure all selected schemes with months to pay also have a payment mode selected.
                </div>
              )}


              <DialogFooter className="pt-3 flex-shrink-0">
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmissionDisabled}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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

