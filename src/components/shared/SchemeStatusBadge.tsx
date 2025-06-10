
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
    case 'Active':
      variant = 'default';
      className = 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      break;
    case 'Completed': // All payments made, but not yet manually 'Closed'
      variant = 'secondary';
      className = 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
      break;
    case 'Closed': // Manually closed by user
      variant = 'default'; // Using default styling like primary, but distinct from Active
      className = 'bg-primary/20 text-primary border-primary/30 dark:bg-primary/10 dark:text-primary dark:border-primary/20';
      break;
    case 'Overdue':
      variant = 'destructive';
      className = 'bg-red-500/20 text-red-700 border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      break;
    case 'Upcoming':
      variant = 'outline';
      className = 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
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

