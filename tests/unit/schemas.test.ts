import { describe, expect, it } from "vitest";
import {
  ProviderVerifyRequestSchema,
  SmokeTestOutputSchema,
} from "../../src/lib/providers/schemas";

describe("SmokeTestOutputSchema", () => {
  it("validates a conforming smoke test output object", () => {
    const valid = {
      status: "ok",
      message: "Smoke test passed",
      concepts: ["active_recall", "spoken_retrieval"],
    };
    const result = SmokeTestOutputSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ok");
      expect(result.data.concepts).toHaveLength(2);
    }
  });

  it("rejects output missing required status field", () => {
    const invalid = {
      message: "Missing status",
      concepts: ["concept_a"],
    };
    const result = SmokeTestOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects output with empty concepts array", () => {
    const invalid = {
      status: "ok",
      message: "Empty concepts",
      concepts: [],
    };
    const result = SmokeTestOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects output with non-string elements in concepts", () => {
    const invalid = {
      status: "ok",
      message: "Invalid concepts",
      concepts: [123, true],
    };
    const result = SmokeTestOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ProviderVerifyRequestSchema", () => {
  it("defaults to 'all' if no provider specified", () => {
    const result = ProviderVerifyRequestSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("all");
    }
  });

  it("accepts valid provider options", () => {
    expect(
      ProviderVerifyRequestSchema.safeParse({ provider: "meta" }).success
    ).toBe(true);
    expect(
      ProviderVerifyRequestSchema.safeParse({ provider: "baseten" }).success
    ).toBe(true);
    expect(
      ProviderVerifyRequestSchema.safeParse({ provider: "all" }).success
    ).toBe(true);
  });

  it("rejects unknown provider options", () => {
    expect(
      ProviderVerifyRequestSchema.safeParse({ provider: "openai" }).success
    ).toBe(false);
  });
});
