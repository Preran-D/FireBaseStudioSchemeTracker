
'use client';

import { useState, type ReactNode, useEffect, useCallback } from 'react'; // Removed useRef as it was for fileInputRef
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
// Removed: FileSpreadsheet, UploadCloud, FileText, PlusCircle, FileUp, Users2Icon, ListChecksIcon, AlertCircle, Trash2, CalendarIcon (from lucide), Textarea, ScrollArea, Table components, Checkbox, AlertDialog components, Popover components
// Kept: Download, Loader2, SettingsIcon, SlidersHorizontal, Info, DatabaseZap, ArchiveRestore (used in RecommendedSettingsTabContent for manual archiving button)
import { Download, Loader2, Settings as SettingsIcon, SlidersHorizontal, Info, DatabaseZap, ArchiveRestore } from 'lucide-react';
// Removed many mock-data functions. Kept getMockSchemes, archiveMockScheme.
import { getMockSchemes, archiveMockScheme } from '@/lib/mock-data';
import type { Scheme, PaymentMode, SchemeStatus } from '@/types/scheme'; // Removed GroupDetail, Payment, MockGroup, ArchivedPaymentAugmented
import { formatDate, getSchemeStatus } from '@/lib/utils'; // Removed getPaymentStatus, formatCurrency, generateId. getSchemeStatus is used by archiveMockScheme indirectly through getMockSchemes.
// XLSX already removed.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// Popover and Calendar UI components removed.
// cn removed as it was likely for Popover or other removed UI.
import { parseISO, isBefore, subDays, } from 'date-fns'; // formatISO, format as formatDateFns, isValidDate removed
import Link from 'next/link';

// Interface ImportUIRow is removed as DataManagementTabContent is removed.

// DataManagementTabContent function is removed.

type DefaultPaymentModeType = "Cash" | "Card" | "UPI"; // Used by RecommendedSettingsTabContent

function RecommendedSettingsTabContent() {
  const { toast } = useToast();
  const [autoArchive, setAutoArchive] = useState(false);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);
  const [archiveDays, setArchiveDays] = useState(60);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<DefaultPaymentModeType>("Cash");
  const paymentModeOptions: DefaultPaymentModeType[] = ["Cash", "Card", "UPI"];

  const handleRunArchiving = async () => {
    setIsProcessingArchive(true);
    let archivedCount = 0;
    try {
      const allSchemes = getMockSchemes({ includeArchived: true });
      const schemesToArchive = allSchemes.filter(scheme => {
        if (scheme.status === 'Closed' && scheme.closureDate) {
          const closureDate = parseISO(scheme.closureDate);
          const daysAgo = subDays(new Date(), archiveDays);
          return isBefore(closureDate, daysAgo);
        }
        return false;
      });

      for (const scheme of schemesToArchive) {
        const result = archiveMockScheme(scheme.id); // This function is still available from mock-data
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
  };

  return (
    <div className="space-y-8 mt-6">
      {/* Card for Navigating to Data Management Page */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <DatabaseZap className="h-5 w-5 text-primary" /> {/* Kept DatabaseZap for this */}
            Advanced Data Operations
          </CardTitle>
          <CardDescription>
            Access tools for bulk import, export, comprehensive archiving, and other data management features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/data-management">
            <Button variant="outline" className="w-full sm:w-auto">
              <DatabaseZap className="mr-2 h-4 w-4" /> Go to Data Management Page
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Notification Preferences (Placeholder)</CardTitle>
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
      <Tabs defaultValue="recommended-settings" className="w-full"> {/* Default to recommended-settings */}
        <TabsList className="grid w-full grid-cols-1"> {/* Changed to grid-cols-1 */}
          {/* Data Management TabTrigger removed */}
          <TabsTrigger value="recommended-settings" className="text-base py-2.5">
            <SlidersHorizontal className="mr-2 h-5 w-5" /> App Preferences
          </TabsTrigger>
        </TabsList>
        {/* Data Management TabsContent removed */}
        <TabsContent value="recommended-settings">
          <RecommendedSettingsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Removed exportToExcel as it's not used in this file anymore.
