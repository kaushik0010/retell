import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound from "../../src/app/not-found";
import { LostDocumentIllustration } from "../../src/components/illustrations/LostDocumentIllustration";
import { LayersIcon } from "../../src/components/icons";

describe("404 Not Found Page & Lost Document Illustration", () => {
  it("renders the dedicated 404 page markup with exact copy and navigation actions", () => {
    const html = renderToStaticMarkup(React.createElement(NotFound));

    // 1. Exact headline and supporting text matching the design reference
    expect(html).toContain("Oops! This answer isn&#x27;t here.");
    expect(html).toContain("Looks like this page took a different route.");
    expect(html).toContain("Let&#x27;s get you back on track.");

    // 2. Primary action: Back to Home
    expect(html).toContain('href="/"');
    expect(html).toContain("Back to Home");

    // 3. Secondary action: Visit your Library
    expect(html).toContain('href="/library"');
    expect(html).toContain("Visit your Library");

    // 4. Retell branding at top-left
    expect(html).toContain("Retell");

    // 5. Immersive fullscreen container covering AppShell chrome
    expect(html).toContain("fixed inset-0 z-50");
    expect(html).toContain("bg-brand-cream");

    // 6. Decorative corner shapes (marked aria-hidden)
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the LostDocumentIllustration with correct SVG structure, coordinates, and accessibility", () => {
    const html = renderToStaticMarkup(
      React.createElement(LostDocumentIllustration)
    );

    // 1. Accessibility attributes
    expect(html).toContain('role="img"');
    expect(html).toContain(
      'aria-label="Illustration of a cute worried paper document character looking for a missing page next to a wooden directional signpost"'
    );
    expect(html).toContain('viewBox="0 0 520 360"');

    // 2. Paper character elements
    expect(html).toContain('id="paper-character"');
    expect(html).toContain('id="character-body"');
    expect(html).toContain('id="character-face"');
    expect(html).toContain('id="character-arms"');
    expect(html).toContain('id="character-legs"');

    // 3. Environment elements: bushes, signpost, ground shadow
    expect(html).toContain('id="bush-left"');
    expect(html).toContain('id="bush-right"');
    expect(html).toContain('id="signpost"');
    expect(html).toContain('class="anim-shadow"');

    // 4. Floating marks: tomato red question mark and action ticks
    expect(html).toContain('id="floating-marks"');
    expect(html).toContain("#E6533D"); // Tomato red color

    // 5. Animation keyframes and reduced-motion safeguard
    expect(html).toContain("@keyframes floatDocument");
    expect(html).toContain("@keyframes floatMarks");
    expect(html).toContain("@keyframes blinkEyes");
    expect(html).toContain("@keyframes shadowPulse");
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).toContain("animation: none !important");
  });

  it("renders the new LayersIcon matching the stacked-layers reference design", () => {
    const html = renderToStaticMarkup(
      React.createElement(LayersIcon, { className: "w-5 h-5" })
    );

    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('class="w-5 h-5"');
  });
});
