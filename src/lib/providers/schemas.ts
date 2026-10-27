import { z } from "zod";

/**
 * Expected structured output schema for provider smoke tests.
 * Models must return a predictable JSON payload adhering to this structure.
 */
export const SmokeTestOutputSchema = z.object({
  status: z.string().min(1, "Status must not be empty"),
  message: z.string().min(1, "Message must not be empty"),
  concepts: z.array(z.string()).min(1, "Must contain at least one concept"),
});

export type SmokeTestOutput = z.infer<typeof SmokeTestOutputSchema>;

/**
 * Request payload schema for the dev verification route.
 */
export const ProviderVerifyRequestSchema = z.object({
  provider: z.enum(["meta", "baseten", "all"]).default("all"),
});

export type ProviderVerifyRequest = z.infer<typeof ProviderVerifyRequestSchema>;
