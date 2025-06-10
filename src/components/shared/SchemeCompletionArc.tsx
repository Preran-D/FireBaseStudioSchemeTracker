
'use client';

import { cn } from '@/lib/utils';

interface SchemeCompletionArcProps {
  paymentsMadeCount: number;
  durationMonths: number;
  size?: number; // Overall size of the SVG
  strokeWidth?: number; // Thickness of the arc
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
  // Ensure endAngle doesn't draw a full circle in a way that makes it disappear
  if (endAngle >= startAngle + 359.99) {
    endAngle = startAngle + 359.99;
  }

  const start = polarToCartesian(x, y, radius, endAngle); // Path is drawn clockwise, so endAngle is the "start" point
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
  size = 160,
  strokeWidth = 16,
  className,
}: SchemeCompletionArcProps) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;

  const progressPercentage = durationMonths > 0 ? (paymentsMadeCount / durationMonths) : 0;
  const endAngle = progressPercentage * 360; // Progress arc goes from 0 to endAngle

  const backgroundArcPath = describeArcPath(center, center, radius, 0, 359.99); // Nearly full circle for background
  const progressArcPath = describeArcPath(center, center, radius, 0, endAngle);

  const isCompleted = paymentsMadeCount >= durationMonths;

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Scheme progress: ${paymentsMadeCount} of ${durationMonths} payments made.`}>
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.8 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
          </linearGradient>
           <linearGradient id="completedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--positive-value))', stopOpacity: 0.7 }} /> {/* Greenish */}
            <stop offset="100%" style={{ stopColor: 'hsl(var(--positive-value))', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path
          d={backgroundArcPath}
          fill="none"
          stroke="hsl(var(--muted))" // Background track color from theme
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {paymentsMadeCount > 0 && (
          <path
            d={progressArcPath}
            fill="none"
            stroke={isCompleted ? "url(#completedGradient)" : "url(#progressGradient)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease-out' }} // For potential animation later
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
        {isCompleted && durationMonths > 0 && (
           <span className="text-xs font-semibold mt-1 px-2 py-0.5 rounded-full bg-[hsl(var(--positive-value))] text-primary-foreground">
             Completed
           </span>
        )}
      </div>
    </div>
  );
}
