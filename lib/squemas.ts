// lib/geminiResponseSchema.ts
import { z } from "zod";

export const GeminiResponseSchema = z.object({
  transcription: z.string(),
  sentimentAnalysis: z.object({
    overallSentiment: z.enum(["Positive", "Negative", "Neutral"]),
    specificEmotions: z
      .array(
        z.object({
          emotion: z.string(),
          evidence: z.string(),
        })
      )
      .optional(),
  }),
  puntosDoterSolved: z.boolean(),
  reasonForCall: z.string(),
  keyInteractions: z
    .array(
      z.object({
        question: z.string(),
        response: z.string(),
      })
    )
    .optional(),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;
