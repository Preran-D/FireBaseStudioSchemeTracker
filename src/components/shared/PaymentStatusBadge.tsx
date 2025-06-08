import type { PaymentStatus } from '@/types/scheme';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, CircleDollarSign, AlertTriangle, CalendarClock } from 'lucide-react';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let className = '';
  let IconComponent = CircleDollarSign;

  switch (status) {
    case 'Paid':
      variant = 'default';
      className = 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      IconComponent = CheckCircle2;
      break;
    case 'Pending':
      variant = 'secondary';
      className = 'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20';
      IconComponent = CircleDollarSign;
      break;
    case 'Overdue':
      variant = 'destructive';
      className = 'bg-red-500/20 text-red-700 border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      IconComponent = AlertTriangle;
      break;
    case 'Upcoming':
      variant = 'outline';
      className = 'bg-sky-500/20 text-sky-700 border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20';
      IconComponent = CalendarClock;
      break;
    default:
      variant = 'outline';
  }

  return (
    <Badge variant={variant} className={cn("capitalize flex items-center gap-1.5", className)}>
      <IconComponent className="h-3.5 w-3.5" />
      {status}
    </Badge>
  );
}
