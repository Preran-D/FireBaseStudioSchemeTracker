
'use client';

import type { Payment, PaymentStatus } from '@/types/scheme';
import { cn } from '@/lib/utils';
import { format, addMonths, parseISO } from 'date-fns';

interface MonthlyCircularProgressProps {
  payments: Payment[];
  startDate: string;
  durationMonths: number;
  className?: string;
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  Paid: 'hsl(var(--chart-2))',
  Pending: 'hsl(var(--chart-4))',
  Overdue: 'hsl(var(--destructive))',
  Upcoming: 'hsl(var(--muted))',
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number): string => {
  const start = polarToCartesian(x, y, radius, endAngle); // Order is reversed for clockwise path
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  const d = [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y, // sweepFlag 0 for clockwise
    'Z',
  ].join(' ');

  return d;
};

export function MonthlyCircularProgress({ payments, startDate, durationMonths, className }: MonthlyCircularProgressProps) {
  const radius = 70;
  const labelTextRadius = radius + 15;
  const viewBoxSize = 200;
  const cx = viewBoxSize / 2;
  const cy = viewBoxSize / 2;
  const segmentAngle = 360 / durationMonths;
  const segmentGap = durationMonths > 1 ? 1.5 : 0; // Degrees of gap between segments

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg 
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} 
        width={viewBoxSize} 
        height={viewBoxSize} 
        aria-labelledby="progress-chart-title" 
        role="img"
      >
        <title id="progress-chart-title">Monthly Payment Progress for Scheme starting {format(parseISO(startDate), 'MMM yyyy')}</title>
        {payments.map((payment) => {
          const monthDate = addMonths(parseISO(startDate), payment.monthNumber - 1);
          const monthLabel = format(monthDate, 'MMM');
          
          const angleStart = (payment.monthNumber - 1) * segmentAngle;
          const angleEnd = payment.monthNumber * segmentAngle - segmentGap;
          
          const pathData = describeArc(cx, cy, radius, angleStart, angleEnd);
          const color = STATUS_COLORS[payment.status] || STATUS_COLORS.Upcoming;

          const labelAngle = angleStart + (segmentAngle - segmentGap) / 2;
          const labelPos = polarToCartesian(cx, cy, labelTextRadius, labelAngle);
          
          return (
            <g key={payment.id}>
              <path d={pathData} fill={color} aria-label={`${monthLabel}: ${payment.status}`} />
              <text
                x={labelPos.x}
                y={labelPos.y}
                dy=".3em"
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--foreground))"
              >
                {monthLabel}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={radius * 0.6} fill="hsl(var(--background))" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fontWeight="semibold" fill="hsl(var(--foreground))">
          Starts
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">
          {format(parseISO(startDate), 'MMM yyyy')}
        </text>
      </svg>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-sm mr-1.5" style={{ backgroundColor: color }}></span>
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

