import { describe, it, expect } from "vitest";
import { sanitizeMessage, sanitizeError } from "@/lib/providers/errors";
import {
  GET as devVerifyGet,
  POST as devVerifyPost,
} from "@/app/api/dev/verify-provider/route";
import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

describe("Language Exposure & Security Audit", () => {
  describe("API Verification Route Protection in Production", () => {
    it("returns HTTP 404 Not Found on GET when in production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] =
          "production";
        const req = new NextRequest(
          "http://localhost:3000/api/dev/verify-provider"
        );
        const res = await devVerifyGet(req);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe("Not found");
      } finally {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] =
          originalEnv;
      }
    });

    it("returns HTTP 404 Not Found on POST when in production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] =
          "production";
        const req = new NextRequest(
          "http://localhost:3000/api/dev/verify-provider",
          {
            method: "POST",
            body: JSON.stringify({ provider: "meta" }),
          }
        );
        const res = await devVerifyPost(req);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe("Not found");
      } finally {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] =
          originalEnv;
      }
    });
  });

  describe("Error Sanitization & Secret Redaction", () => {
    it("redacts Bearer tokens and API keys from error messages", () => {
      const sensitive =
        "Failed to connect: Bearer abc12345678901234567890 with key=xyz98765432109876543210";
      const cleaned = sanitizeMessage(sensitive);
      expect(cleaned).not.toContain("abc12345678901234567890");
      expect(cleaned).not.toContain("xyz98765432109876543210");
      expect(cleaned).toContain("[REDACTED]");
    });

    it("sanitizes Error objects into safe categories without raw stack traces", () => {
      const rawError = new Error(
        "Connection refused: Bearer secret_live_token_12345678901234567890"
      );
      const sanitized = sanitizeError(rawError);
      expect(sanitized.category).toBe("UNKNOWN_ERROR");
      expect(sanitized.message).not.toContain("secret_live_token");
    });
  });

  describe("Prohibited Infrastructure Terminology in Student UI", () => {
    const PROHIBITED_WORDS = [
      "vercel",
      "serverless",
      "payload",
      "indexeddb",
      "web worker",
      "llama",
      "multimodal ai",
    ];

    function collectStudentFiles(dir: string): string[] {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectStudentFiles(full));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
        ) {
          files.push(full);
        }
      }
      return files;
    }

    it("verifies user-facing copy in features does not contain prohibited infrastructure jargon", () => {
      const featuresDir = path.resolve(process.cwd(), "src/features");
      const files = collectStudentFiles(featuresDir);

      const violations: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          // Skip code comments, imports, and variable declarations
          if (
            trimmed.startsWith("//") ||
            trimmed.startsWith("/*") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith("import ") ||
            trimmed.startsWith("const ") ||
            trimmed.startsWith("let ") ||
            trimmed.startsWith("export const ") ||
            trimmed.startsWith("interface ") ||
            trimmed.startsWith("type ")
          ) {
            return;
          }

          // Check for user-facing JSX text or string literals
          for (const word of PROHIBITED_WORDS) {
            const regex = new RegExp(
              `(?<![a-zA-Z0-9_-])${word}(?![a-zA-Z0-9_-])`,
              "i"
            );
            if (regex.test(trimmed)) {
              // Ignore xmlns attributes or svg paths
              if (
                trimmed.includes("xmlns=") ||
                trimmed.includes("http://www.w3.org")
              ) {
                continue;
              }
              violations.push(
                `${path.basename(file)}:${idx + 1} -> ${trimmed}`
              );
            }
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });
});
