import React from "react";
import Link from "next/link";
import { LostDocumentIllustration } from "@/components/illustrations/LostDocumentIllustration";
import { HomeIcon, LayersIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="bg-brand-cream text-brand-ink fixed inset-0 z-50 flex min-h-screen flex-col overflow-x-hidden overflow-y-auto selection:bg-[#FFE2D7]">
      {/* 1. Subtle Organic Background Shapes */}
      {/* Top-Right Peach Contour Blob */}
      <svg
        className="pointer-events-none absolute top-0 right-0 z-0 h-56 w-56 sm:h-80 sm:w-80 md:h-[420px] md:w-[420px]"
        viewBox="0 0 320 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M320 0H140C70 0 20 50 10 110C-2 180 30 240 90 280C150 320 230 310 280 270C310 245 320 210 320 170V0Z"
          fill="#FFE2D7"
          fillOpacity="0.55"
        />
        <path
          d="M320 0H200C150 0 110 35 100 85C90 140 120 190 170 220C220 250 280 230 320 190V0Z"
          fill="#FDEBD8"
          fillOpacity="0.4"
        />
      </svg>

      {/* Bottom-Left Peach Contour Blob */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 z-0 h-56 w-56 sm:h-80 sm:w-80 md:h-[420px] md:w-[420px]"
        viewBox="0 0 320 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0 320V140C0 70 50 20 110 10C180 -2 240 30 280 90C320 150 310 230 270 280C245 310 210 320 170 320H0Z"
          fill="#FFE2D7"
          fillOpacity="0.5"
        />
        <path
          d="M0 320V200C0 150 35 110 85 100C140 90 190 120 220 170C250 220 230 280 190 320H0Z"
          fill="#FDEBD8"
          fillOpacity="0.35"
        />
      </svg>

      {/* 2. Brand Header (Top-Left matching reference) */}
      <header className="relative z-10 w-full px-6 pt-6 sm:px-8 sm:pt-8 md:px-12 md:pt-10">
        <Link
          href="/"
          className="focus-visible:outline-brand-tomato inline-flex cursor-pointer items-center gap-2.5 rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Retell home"
        >
          {/* Brand Squircle with R */}
          <div className="bg-brand-tomato flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-2xs sm:h-10 sm:w-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              className="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              aria-hidden="true"
            >
              <path
                fill="#FFF8EB"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 7h10.5c3.2 0 5.5 2.2 5.5 5.2 0 2.4-1.4 4.3-3.6 4.9l4.1 7.9h-4.3l-3.6-7h-4.8v7H8V7zm3.8 3.5v4.2h6.5c1.4 0 2.4-0.9 2.4-2.1s-1-2.1-2.4-2.1h-6.5z"
              />
            </svg>
          </div>
          <span className="font-heading text-brand-ink text-xl font-extrabold tracking-tight sm:text-2xl">
            Retell
          </span>
        </Link>
      </header>

      {/* 3. Centered Content Composition */}
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:py-12 md:py-16">
        {/* Animated Custom SVG Paper Character */}
        <div className="flex w-full justify-center">
          <LostDocumentIllustration className="drop-shadow-2xs h-auto w-full max-w-[300px] sm:max-w-[380px] md:max-w-[440px]" />
        </div>

        {/* Headline */}
        <h1 className="font-heading text-brand-ink mt-6 text-3xl font-extrabold tracking-tight sm:mt-8 sm:text-4xl md:text-[42px] md:leading-tight">
          Oops! This answer isn&apos;t here.
        </h1>

        {/* Supporting Explanation */}
        <p className="text-brand-secondary mt-3 max-w-md text-base leading-relaxed sm:mt-4 sm:text-lg">
          Looks like this page took a different route.
          <span className="block sm:inline">
            {" "}
            Let&apos;s get you back on track.
          </span>
        </p>

        {/* Navigation Action Buttons */}
        <div className="mt-8 flex w-full max-w-xs flex-col items-stretch justify-center gap-3.5 sm:max-w-md sm:flex-row sm:items-center sm:gap-4">
          {/* Primary Action: Back to Home */}
          <Link
            href="/"
            className="bg-brand-tomato hover:bg-brand-tomato-hover group focus-visible:outline-brand-tomato inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-7 py-3.5 text-base font-semibold text-white shadow-xs transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
          >
            <HomeIcon className="h-5 w-5 text-white/95 transition-transform duration-150 group-hover:scale-110" />
            <span>Back to Home</span>
          </Link>

          {/* Secondary Action: Visit your Library */}
          <Link
            href="/library"
            className="border-brand-tomato text-brand-tomato hover:bg-brand-peach/30 group focus-visible:outline-brand-tomato inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 bg-white px-7 py-3.5 text-base font-semibold shadow-2xs transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
          >
            <LayersIcon className="text-brand-tomato h-5 w-5 transition-transform duration-150 group-hover:scale-110" />
            <span>Visit your Library</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
