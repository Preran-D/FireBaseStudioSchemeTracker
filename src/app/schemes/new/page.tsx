'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Correct import for App Router
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SchemeForm } from '@/components/forms/SchemeForm';
import type { Scheme } from '@/types/scheme';
import { addMockScheme } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

export default function NewSchemePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (data: Omit<Scheme, 'id' | 'payments' | 'status' | 'durationMonths'>) => {
    setIsLoading(true);
    try {
      const newScheme = addMockScheme(data);
      toast({
        title: 'Scheme Created',
        description: `Scheme for ${newScheme.customerName} has been successfully created.`,
      });
      router.push(`/schemes/${newScheme.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create scheme. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
    // No finally block for setIsLoading to false, as router.push navigates away.
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Add New Scheme</CardTitle>
          <CardDescription>Enter the details for the new customer scheme.</CardDescription>
        </CardHeader>
        <CardContent>
          <SchemeForm onSubmit={handleSubmit} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
