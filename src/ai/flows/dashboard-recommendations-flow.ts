
'use server';
/**
 * @fileOverview Provides AI-driven recommendations for the scheme dashboard.
 *
 * - getDashboardRecommendations - A function to fetch recommendations based on dashboard summary data.
 * - DashboardInsightsInput - The input type for the recommendation flow.
 * - DashboardRecommendationsOutput - The return type for the recommendation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DashboardInsightsInputSchema = z.object({
  totalActiveSchemes: z.number().describe("Total number of currently active schemes (including overdue)."),
  totalOverdueSchemes: z.number().describe("Total number of schemes with at least one overdue payment."),
  totalOverdueAmount: z.number().describe("Total monetary amount currently overdue across all schemes."),
  numberOfUpcomingPaymentsNext30Days: z.number().describe("Number of payments due in the next 30 days."),
  numberOfNewOverduePaymentsLast7Days: z.number().describe("Number of payments that became overdue in the last 7 days."),
  averagePaymentCollectedPercentage: z.number().optional().describe("Overall percentage of expected payments that have been collected for active schemes (e.g., 85 for 85%)."),
  commonPaymentDelays: z.string().optional().describe("Brief description of common payment delay patterns, e.g., 'Payments often 1-3 days late', 'Significant delays in Group X'.")
});
export type DashboardInsightsInput = z.infer<typeof DashboardInsightsInputSchema>;

const DashboardRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      title: z.string().describe("A concise title for the recommendation (e.g., 'Proactive Reminders')."),
      description: z.string().describe("Detailed explanation of the recommendation and actionable steps to implement it."),
      priority: z.enum(['High', 'Medium', 'Low']).default('Medium').describe("The urgency or importance of this recommendation."),
    })
  ).describe("A list of actionable recommendations for improving collections, tailored to the dashboard summary."),
  positiveObservations: z.array(z.string()).optional().describe("Positive aspects or well-performing areas noted from the data."),
  areasForAttention: z.array(z.string()).optional().describe("Specific areas that need immediate attention based on the data."),
});
export type DashboardRecommendationsOutput = z.infer<typeof DashboardRecommendationsOutputSchema>;

export async function getDashboardRecommendations(input: DashboardInsightsInput): Promise<DashboardRecommendationsOutput> {
  return dashboardRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dashboardRecommendationsPrompt',
  input: {schema: DashboardInsightsInputSchema},
  output: {schema: DashboardRecommendationsOutputSchema},
  prompt: `You are an expert financial analyst specializing in optimizing collection processes for recurring payment schemes.
Analyze the following dashboard summary data for a scheme tracking application and provide actionable recommendations.

Dashboard Data:
- Total Active Schemes: {{{totalActiveSchemes}}}
- Total Overdue Schemes: {{{totalOverdueSchemes}}}
- Total Overdue Amount: {{{totalOverdueAmount}}} (currency assumed to be local, e.g., INR)
- Upcoming Payments (Next 30 Days): {{{numberOfUpcomingPaymentsNext30Days}}}
- Newly Overdue Payments (Last 7 Days): {{{numberOfNewOverduePaymentsLast7Days}}}
{{#if averagePaymentCollectedPercentage~}}
- Average Payment Collected Percentage (Active Schemes): {{{averagePaymentCollectedPercentage}}}%
{{/if~}}
{{#if commonPaymentDelays~}}
- Observed Common Payment Delays: {{{commonPaymentDelays}}}
{{/if~}}

Based on this data:
1.  Generate a list of 3-5 concrete, actionable "recommendations" to improve payment collections. Each recommendation should have a clear "title", a "description" of the action, and a "priority" (High, Medium, Low). Focus on proactive measures, customer communication strategies, and identifying at-risk schemes.
2.  If applicable, list any "positiveObservations" from the data.
3.  Highlight any critical "areasForAttention" that require immediate focus.

Structure your output strictly according to the defined output schema.
Be encouraging and professional in your tone.
Example recommendations could involve targeted follow-ups for schemes with multiple overdue payments, early reminders for upcoming payments, or offering flexible payment options for customers with temporary difficulties.
Prioritize recommendations that can have the most impact given the summary.
If overdue schemes and amounts are high, focus on recovery. If upcoming payments are many, focus on prevention.
`,
});

const dashboardRecommendationsFlow = ai.defineFlow(
  {
    name: 'dashboardRecommendationsFlow',
    inputSchema: DashboardInsightsInputSchema,
    outputSchema: DashboardRecommendationsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      // Fallback or default recommendations if the model fails to generate
      return {
        recommendations: [{
          title: "Review Overdue Accounts",
          description: "Manually review all schemes with overdue payments and initiate contact with customers to understand the reasons for non-payment and discuss solutions.",
          priority: "High"
        }],
        areasForAttention: ["High number of overdue payments requires immediate review."],
      };
    }
    return output;
  }
);

