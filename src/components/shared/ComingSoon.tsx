import { HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ComingSoonProps {
  featureName: string;
  className?: string;
}

export function ComingSoon({ featureName, className }: ComingSoonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <HardHat className="h-6 w-6 text-accent" />
          {featureName} - Coming Soon!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          This feature is currently under development. Stay tuned for updates!
        </p>
      </CardContent>
    </Card>
  );
}
