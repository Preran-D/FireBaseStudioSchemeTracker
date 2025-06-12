
'use client';

import type { SchemeStatus } from '@/types/scheme';
import { cn } from '@/lib/utils';

interface SchemeCompletionArcProps {
  paymentsMadeCount: number;
  durationMonths: number;
  status?: SchemeStatus;
  size?: number; 
  strokeWidth?: number; 
  className?: string;
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArcPath = (x: number, y: number, radius: number, startAngle: number, endAngle: number): string => {
  if (endAngle >= startAngle + 359.99) {
    endAngle = startAngle + 359.99;
  }

  const start = polarToCartesian(x, y, radius, endAngle); 
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  const d = [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');

  return d;
};

export function SchemeCompletionArc({
  paymentsMadeCount,
  durationMonths,
  status,
  size = 160,
  strokeWidth = 16,
  className,
}: SchemeCompletionArcProps) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;

  const progressPercentage = durationMonths > 0 ? (paymentsMadeCount / durationMonths) : 0;
  const endAngle = progressPercentage * 360; 

  const backgroundArcPath = describeArcPath(center, center, radius, 0, 359.99); 
  const progressArcPath = describeArcPath(center, center, radius, 0, endAngle);

  const isCompleted = paymentsMadeCount >= durationMonths;

  let progressStrokeColor = "hsl(var(--positive-value))"; // Default to green (for Active, Overdue, Upcoming, Fully Paid)
  let textBadgeBgColor = "bg-[hsl(var(--positive-value))] text-primary-foreground"; // Default green for completed badge
  let textBadgeLabel = "Fully Paid";

  if (status === 'Closed') {
    progressStrokeColor = 'hsl(var(--destructive))'; // Red for Closed arc
    textBadgeBgColor = "bg-[hsl(var(--destructive))] text-destructive-foreground"; // Red for Closed badge
    textBadgeLabel = "Closed";
  } else if (isCompleted) {
    progressStrokeColor = 'hsl(var(--positive-value))'; // Green for Fully Paid arc
    textBadgeBgColor = "bg-[hsl(var(--positive-value))] text-primary-foreground"; // Green for Fully Paid badge
    textBadgeLabel = "Fully Paid";
  }


  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Scheme progress: ${paymentsMadeCount} of ${durationMonths} payments made. Status: ${status || (isCompleted ? 'Fully Paid' : 'In Progress')}`}>
        {/* Removed unused SVG defs for gradients as we are using solid HSL colors now */}
        <path
          d={backgroundArcPath}
          fill="none"
          stroke="hsl(var(--muted))" 
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {paymentsMadeCount > 0 && (
          <path
            d={progressArcPath}
            fill="none"
            stroke={progressStrokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease-out, stroke 0.5s ease-out' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold text-foreground">
          {paymentsMadeCount}
        </span>
        <span className="text-sm text-muted-foreground">
          of {durationMonths} Paid
        </span>
        {(isCompleted || status === 'Closed') && durationMonths > 0 && (
           <span className={cn("text-xs font-semibold mt-1 px-2 py-0.5 rounded-full", textBadgeBgColor)}>
             {textBadgeLabel}
           </span>
        )}
      </div>
    </div>
  );
}
