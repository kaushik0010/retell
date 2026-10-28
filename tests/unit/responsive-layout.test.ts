import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Task 7 — Responsive Layout and Section Scrolling Verification", () => {
  const readComponent = (relPath: string) => {
    return fs.readFileSync(
      path.resolve(__dirname, "../../src", relPath),
      "utf-8"
    );
  };

  it("verifies HomeView mobile hero ordering and zero duplicate elements", () => {
    const source = readComponent("features/home/HomeView.tsx");

    // CSS Grid responsive ordering
    expect(source).toContain("grid-cols-1");
    expect(source).toContain("md:grid-cols-12");
    expect(source).toContain("order-1");
    expect(source).toContain("order-2");
    expect(source).toContain("order-3");

    // Illustration on desktop starts at row 1, col 8, spanning rows 1-2
    expect(source).toContain("md:col-start-8");
    expect(source).toContain("md:col-span-5");
    expect(source).toContain("md:row-start-1");
    expect(source).toContain("md:row-span-2");

    // Heading on desktop is row 1, col 1-7
    expect(source).toContain("md:col-start-1");
    expect(source).toContain("md:col-span-7");
    expect(source).toContain("md:row-start-1");

    // CTA on desktop is row 2, col 1-7 (directly beneath description)
    expect(source).toContain("md:row-start-2");

    // Zero duplication: exactly one hero illustration Image
    const imageMatches = source.match(/<Image[^>]+homepage_illustration/g);
    expect(imageMatches).toHaveLength(1);

    // Zero duplication: exactly one primary CTA link to /materials/new
    const ctaMatches = source.match(
      /href="\/materials\/new"[^>]*>[\s\S]*?<span>Add study material<\/span>/g
    );
    expect(ctaMatches).toHaveLength(1);
  });

  it("verifies NewMaterialView section-level horizontal scrolling and min-w-0 guards", () => {
    const source = readComponent("features/materials/NewMaterialView.tsx");

    // Dedicated scroll region with accessibility attributes
    expect(source).toContain('role="region"');
    expect(source).toContain('aria-label="Curated exam topics"');
    expect(source).toContain("overflow-x-auto");

    // Responsive tabs with horizontal scroll and min-w-0
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("scrollbar-thin");
    expect(source).toContain("w-full min-w-0");

    // Responsive stepper preventing wide fixed width
    expect(source).toContain("w-4");
    expect(source).toContain("sm:w-10");
  });

  it("verifies SourceReviewView responsive guards and section horizontal scrolling", () => {
    const source = readComponent("features/source-review/SourceReviewView.tsx");

    // Category filter pills section scroll with accessibility
    expect(source).toContain('role="region"');
    expect(source).toContain('aria-label="Filter points by category"');
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("w-full min-w-0");

    // AutoResizeTextarea has word wrapping and min-w-0
    expect(source).toContain(
      "w-full min-w-0 resize-none overflow-hidden break-words"
    );

    // Top action bar has truncate and min-w-0
    expect(source).toContain("truncate");

    // Point cards use responsive flex-col sm:flex-row on top row
    expect(source).toContain(
      "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    );
  });

  it("verifies AppShell responsive shell layout and mobile bottom nav clearance", () => {
    const source = readComponent("components/AppShell.tsx");

    // Shell wrappers have min-w-0 to prevent flex blowout
    expect(source).toContain("w-full min-w-0");

    // Clearance for mobile bottom navigation bar
    expect(source).toContain("pb-24 lg:pb-0");

    // No w-screen usage which triggers horizontal scrollbar blowout
    expect(source).not.toContain("w-screen");
  });

  it("verifies globals.css does not use prohibited global overflow-x-hidden hack", () => {
    const globals = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/globals.css"),
      "utf-8"
    );

    // Ensure we did not hide overflows globally on html/body
    expect(globals).not.toContain("overflow-x: hidden");
    expect(globals).not.toContain("overflow-x:hidden");
  });
});
