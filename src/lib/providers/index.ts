import "server-only";

import { BasetenReasoningProvider } from "./baseten";
import { MetaReasoningProvider, MetaTranscriptionProvider } from "./meta";
import type { ProviderId, ReasoningProvider } from "./types";

export * from "./errors";
export * from "./schemas";
export * from "./types";
export { BasetenReasoningProvider } from "./baseten";
export { MetaReasoningProvider, MetaTranscriptionProvider } from "./meta";

/**
 * Returns a configured reasoning provider instance based on provider ID or environment variable.
 */
export function getReasoningProvider(id?: ProviderId): ReasoningProvider {
  const selected = (
    id ||
    process.env.REASONING_PROVIDER ||
    "meta"
  ).toLowerCase();

  if (selected === "baseten") {
    return new BasetenReasoningProvider();
  }

  return new MetaReasoningProvider();
}

/**
 * Returns the dedicated Meta Voice Transcribe provider instance.
 */
export function getMetaTranscriptionProvider(): MetaTranscriptionProvider {
  return new MetaTranscriptionProvider();
}
