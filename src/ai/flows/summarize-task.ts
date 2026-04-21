'use server';
/**
 * @fileOverview A Genkit flow for summarizing or simplifying complex tasks/case studies for dental students.
 *
 * - summarizeTask - A function that handles the task summarization process.
 * - SummarizeTaskInput - The input type for the summarizeTask function.
 * - SummarizeTaskOutput - The return type for the summarizeTask function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeTaskInputSchema = z.object({
  taskText: z
    .string()
    .describe('The complex task or case study text to be summarized or simplified.'),
});
export type SummarizeTaskInput = z.infer<typeof SummarizeTaskInputSchema>;

const SummarizeTaskOutputSchema = z.object({
  summary: z.string().describe('A concise summary or simplified explanation of the task.'),
});
export type SummarizeTaskOutput = z.infer<typeof SummarizeTaskOutputSchema>;

export async function summarizeTask(input: SummarizeTaskInput): Promise<SummarizeTaskOutput> {
  return summarizeTaskFlow(input);
}

const summarizeTaskPrompt = ai.definePrompt({
  name: 'summarizeTaskPrompt',
  input: {schema: SummarizeTaskInputSchema},
  output: {schema: SummarizeTaskOutputSchema},
  prompt: `You are an AI assistant designed to help dental students understand complex information.
Your task is to provide a concise summary or a simplified explanation of the following dental task or case study.
Focus on the core concepts, key challenges, and essential takeaways that a dental student needs to know.
Avoid unnecessary jargon where possible, or explain it clearly.

Task/Case Study:
{{{taskText}}}

Provide the summary/explanation in the 'summary' field of the JSON output.`,
});

const summarizeTaskFlow = ai.defineFlow(
  {
    name: 'summarizeTaskFlow',
    inputSchema: SummarizeTaskInputSchema,
    outputSchema: SummarizeTaskOutputSchema,
  },
  async input => {
    const {output} = await summarizeTaskPrompt(input);
    if (!output) {
      throw new Error('Failed to generate summary.');
    }
    return output;
  }
);
