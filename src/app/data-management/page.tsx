
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Settings } from 'lucide-react';
import Link from 'next/link';

export default function DeprecatedDataManagementPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Card className="w-full max-w-lg p-6 shadow-xl rounded-xl glassmorphism">
        <CardHeader className="items-center">
          <Settings className="h-12 w-12 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl">Page Has Moved</CardTitle>
          <CardDescription className="text-base mt-1">
            Data Management tools are now part of the main Application Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-2">
          <p className="mb-8 text-muted-foreground text-sm">
            You can find all data import/export functionalities under the "Data Management" tab within the Settings area.
          </p>
          <Button asChild size="lg" className="rounded-lg shadow-lg hover:shadow-xl transition-shadow text-base px-8 py-6">
            <Link href="/settings">
              Go to Settings <ArrowRight className="ml-2.5 h-5 w-5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
