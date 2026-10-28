"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BookOpenIcon,
  PlusCircleIcon,
  SearchIcon,
} from "@/components/icons";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isHomeActive = pathname === "/";
  const isLibraryActive = pathname.startsWith("/library");
  const isAddActive =
    pathname.startsWith("/materials/new") || pathname.startsWith("/review");

  return (
    <div className="bg-brand-cream text-brand-ink flex min-h-screen w-full min-w-0">
      {/* Desktop Persistent Left Sidebar (hidden on mobile) */}
      <aside className="border-brand-peach/60 sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-white/70 backdrop-blur-xs lg:flex">
        {/* Brand Logo */}
        <div className="flex h-20 items-center px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-brand-tomato flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white shadow-xs">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                />
              </svg>
            </div>
            <div>
              <span className="font-heading text-brand-ink text-xl font-extrabold tracking-tight">
                Retell
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-4">
          <Link
            href="/"
            className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isHomeActive
                ? "bg-brand-peach/60 text-brand-tomato font-bold shadow-2xs"
                : "text-brand-ink/80 hover:bg-brand-cream/80 hover:text-brand-ink"
            }`}
          >
            <HomeIcon
              className={`h-5 w-5 ${
                isHomeActive ? "text-brand-tomato" : "text-brand-secondary"
              }`}
            />
            <span>Home</span>
          </Link>

          <Link
            href="/library"
            className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isLibraryActive
                ? "bg-brand-peach/60 text-brand-tomato font-bold shadow-2xs"
                : "text-brand-ink/80 hover:bg-brand-cream/80 hover:text-brand-ink"
            }`}
          >
            <BookOpenIcon
              className={`h-5 w-5 ${
                isLibraryActive ? "text-brand-tomato" : "text-brand-secondary"
              }`}
            />
            <span>Study Library</span>
          </Link>

          <Link
            href="/materials/new"
            className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isAddActive
                ? "bg-brand-peach/60 text-brand-tomato font-bold shadow-2xs"
                : "text-brand-ink/80 hover:bg-brand-cream/80 hover:text-brand-ink"
            }`}
          >
            <PlusCircleIcon
              className={`h-5 w-5 ${
                isAddActive ? "text-brand-tomato" : "text-brand-secondary"
              }`}
            />
            <span>Add Material</span>
          </Link>
        </nav>

        {/* Bottom Tagline */}
        <div className="border-brand-peach/40 border-t p-5">
          <p className="text-brand-secondary text-[11px] font-semibold">
            Know it. Say it. Improve it.
          </p>
          <p className="text-brand-secondary/80 mt-0.5 text-[10px]">
            Meta Global AI Hackathon
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex w-full min-w-0 flex-1 flex-col pb-24 lg:pb-0">
        {/* Desktop Top Header Bar */}
        <header className="border-brand-peach/60 sticky top-0 z-20 hidden h-16 items-center justify-between border-b bg-white/70 px-8 backdrop-blur-xs lg:flex">
          {/* Search Bar matching reference image */}
          <div className="border-brand-peach/70 bg-brand-cream/40 text-brand-secondary flex w-full max-w-md items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs">
            <SearchIcon className="text-brand-secondary/70 h-4 w-4" />
            <input
              type="text"
              readOnly
              placeholder="Search your questions or subjects..."
              className="text-brand-ink placeholder:text-brand-secondary/60 w-full bg-transparent text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/materials/new"
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white shadow-2xs transition"
            >
              <PlusCircleIcon className="h-4 w-4" />
              <span>Add study material</span>
            </Link>
          </div>
        </header>

        {/* Mobile Top Header Bar */}
        <header className="border-brand-peach/60 sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white/80 px-4 backdrop-blur-xs lg:hidden">
          <Link href="/" className="flex cursor-pointer items-center gap-2.5">
            <div className="bg-brand-tomato flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow-2xs">
              R
            </div>
            <span className="font-heading text-brand-ink text-lg font-extrabold tracking-tight">
              Retell
            </span>
          </Link>

          <Link
            href="/materials/new"
            className="bg-brand-tomato inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold text-white shadow-2xs"
          >
            <span>+ Add</span>
          </Link>
        </header>

        {/* Page Content */}
        <main className="w-full min-w-0 flex-1 px-3.5 py-5 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="border-brand-peach/80 fixed right-0 bottom-0 left-0 z-30 flex h-16 items-center justify-around border-t bg-white/95 px-2 backdrop-blur-md lg:hidden">
        <Link
          href="/"
          className={`flex cursor-pointer flex-col items-center gap-1 py-1 text-xs font-semibold transition ${
            isHomeActive
              ? "text-brand-tomato font-bold"
              : "text-brand-secondary hover:text-brand-ink"
          }`}
        >
          <HomeIcon className="h-5 w-5" />
          <span className="text-[10px]">Home</span>
        </Link>

        <Link
          href="/library"
          className={`flex cursor-pointer flex-col items-center gap-1 py-1 text-xs font-semibold transition ${
            isLibraryActive
              ? "text-brand-tomato font-bold"
              : "text-brand-secondary hover:text-brand-ink"
          }`}
        >
          <BookOpenIcon className="h-5 w-5" />
          <span className="text-[10px]">Study Library</span>
        </Link>

        <Link
          href="/materials/new"
          className={`flex cursor-pointer flex-col items-center gap-1 py-1 text-xs font-semibold transition ${
            isAddActive
              ? "text-brand-tomato font-bold"
              : "text-brand-secondary hover:text-brand-ink"
          }`}
        >
          <PlusCircleIcon className="h-5 w-5" />
          <span className="text-[10px]">Add Material</span>
        </Link>
      </nav>
    </div>
  );
}
