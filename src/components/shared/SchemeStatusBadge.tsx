
import type { SchemeStatus } from '@/types/scheme';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SchemeStatusBadgeProps {
  status: SchemeStatus;
}

export function SchemeStatusBadge({ status }: SchemeStatusBadgeProps) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let className = '';

  switch (status) {
    case 'Upcoming':
      variant = 'outline'; // Use outline variant, color comes from classes
      className = 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
      break;
    case 'Active':
      variant = 'default'; // Use default (primary-like) variant, color comes from classes
      className = 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      break;
    case 'Overdue':
      variant = 'secondary'; // Use secondary variant, color comes from classes
      className = 'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:bg-orange-400/10 dark:text-orange-400 dark:border-orange-400/20';
      break;
    case 'Completed':
      variant = 'default'; // Use default (primary-like) variant, color comes from classes
      className = 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      break;
    case 'Closed':
      variant = 'destructive'; // Use destructive variant, color comes from classes
      className = 'bg-red-500/20 text-red-700 border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      break;
    default:
      variant = 'outline';
  }

  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {status}
    </Badge>
  );
}
