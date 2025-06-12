import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// Assuming a Loader2 icon is available for the loading state
import { Loader2 } from 'lucide-react';

type ExportType = 'condensed' | 'detailed';

interface ExportPdfDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onExport: (exportType: ExportType) => void;
  isExporting: boolean;
}

const ExportPdfDialog: React.FC<ExportPdfDialogProps> = ({
  isOpen,
  onOpenChange,
  onExport,
  isExporting,
}) => {
  const [selectedType, setSelectedType] = useState<ExportType>('detailed');

  const handleExport = () => {
    onExport(selectedType);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export PDF</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as ExportType)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="detailed" id="detailed" />
              <Label htmlFor="detailed">Detailed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="condensed" id="condensed" />
              <Label htmlFor="condensed">Condensed</Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportPdfDialog;
