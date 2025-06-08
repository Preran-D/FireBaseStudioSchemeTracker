import { ComingSoon } from '@/components/shared/ComingSoon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, BarChart3, TrendingUpIcon } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-headline font-semibold">Reports</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5 text-primary" />
              Payment Trends
            </CardTitle>
            <CardDescription>Analyze payment patterns over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View detailed reports on monthly collections, payment delays, and popular payment methods.
            </p>
            <Button disabled>
              <Download className="mr-2 h-4 w-4" /> Generate Trend Report
            </Button>
            <p className="text-xs text-muted-foreground mt-2">(Feature under development)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Scheme Success Rate
            </CardTitle>
            <CardDescription>Track the performance and completion rates of schemes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Understand how many schemes are completed successfully, identify common drop-off points, and overall ROI.
            </p>
            <Button disabled>
              <Download className="mr-2 h-4 w-4" /> Generate Success Report
            </Button>
            <p className="text-xs text-muted-foreground mt-2">(Feature under development)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Customer Payment History
            </CardTitle>
            <CardDescription>Generate detailed payment history for a specific customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Provide customers with a clear statement of their payments.
            </p>
            <Button disabled>
              <Download className="mr-2 h-4 w-4" /> Generate Customer Statement
            </Button>
            <p className="text-xs text-muted-foreground mt-2">(Feature under development)</p>
          </CardContent>
        </Card>
      </div>
      
      <ComingSoon featureName="Advanced Reporting & Analytics" />
    </div>
  );
}
