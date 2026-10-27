"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudySetList } from "@/features/library/StudySetList";
import { SourceReviewView } from "@/features/source-review/SourceReviewView";
import { StudySet } from "@/lib/domain/study-set";
import { PlusIcon } from "@/components/icons";

export default function LibraryPage() {
  const router = useRouter();
  const [selectedSet, setSelectedSet] = useState<StudySet | null>(null);

  return (
    <div className="bg-brand-cream text-brand-ink flex min-h-screen flex-col">
      <header className="border-brand-peach/60 sticky top-0 z-20 border-b bg-white/80 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-brand-tomato font-heading flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white shadow-xs">
              R
            </div>
            <div>
              <span className="font-heading text-brand-ink text-xl font-bold tracking-tight">
                Retell
              </span>
              <span className="text-brand-secondary ml-2 hidden text-xs font-medium sm:inline">
                Study Library
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add Material</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {selectedSet ? (
            <SourceReviewView
              initialStudySet={selectedSet}
              onBack={() => setSelectedSet(null)}
              onSaved={(updated) => setSelectedSet(updated)}
            />
          ) : (
            <StudySetList
              onSelectStudySet={(set) => setSelectedSet(set)}
              onNewMaterial={() => router.push("/")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
