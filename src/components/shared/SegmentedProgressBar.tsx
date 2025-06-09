
'use client';

import type { Scheme } from '@/types/scheme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatDate } from '@/lib/utils';
import { addMonths, parseISO, format } from 'date-fns';

interface SegmentedProgressBarProps {
  scheme: Scheme;
  paidMonthsCount: number;
  monthsToRecord: number;
  className?: string;
}

export function SegmentedProgressBar({
  scheme,
  paidMonthsCount,
  monthsToRecord,
  className,
}: SegmentedProgressBarProps) {
  const { durationMonths, startDate } = scheme;
  const segments = [];

  const schemeStartDate = parseISO(startDate);
  const schemeEndDate = addMonths(schemeStartDate, durationMonths);


  for (let i = 0; i < durationMonths; i++) {
    let bgColor = 'bg-slate-300 dark:bg-slate-600'; // Default for upcoming/pending
    let segmentTooltipText = `Month ${i + 1}`;

    if (i < paidMonthsCount) {
      bgColor = 'bg-green-500'; // Paid
      const payment = scheme.payments.find(p => p.monthNumber === i + 1 && p.status === 'Paid');
      segmentTooltipText = `Month ${i + 1}: Paid (${formatDate(payment?.paymentDate)})`;
    } else if (i < paidMonthsCount + monthsToRecord) {
      bgColor = 'bg-yellow-500'; // To be recorded by current selection (changed from blue to yellow)
      segmentTooltipText = `Month ${i + 1}: Will be recorded`;
    } else {
       // Check if this future month is overdue (assuming previous are paid or will be paid by selection)
      const paymentForThisMonth = scheme.payments.find(p => p.monthNumber === i + 1);
      if (paymentForThisMonth && parseISO(paymentForThisMonth.dueDate) < new Date() && i >= paidMonthsCount + monthsToRecord) {
        // This logic is a bit tricky for "future overdue" if not all prior selected.
        // Keeping it simple: if not paid and not in "to record", it's upcoming/pending.
        // True overdue status is complex without simulating payments.
      }
    }
    segments.push({ key: `segment-${scheme.id}-${i}`, bgColor, tooltipText: segmentTooltipText });
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex h-3 w-full rounded overflow-hidden border border-muted", className)}>
            {segments.map((segment, index) => (
                <div
                  key={segment.key}
                  className={cn("h-full", segment.bgColor)}
                  style={{ width: `${100 / durationMonths}%` }}
                  title={segment.tooltipText} // Basic browser tooltip for individual segments
                />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Scheme Period: {format(schemeStartDate, 'MMM yyyy')} - {format(schemeEndDate, 'MMM yyyy')}</p>
          <p>{paidMonthsCount} of {durationMonths} months paid.</p>
          {monthsToRecord > 0 && <p>Recording {monthsToRecord} additional month(s).</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
