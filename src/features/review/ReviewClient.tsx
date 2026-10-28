"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SourceReviewView } from "@/features/source-review/SourceReviewView";
import { StudySet } from "@/lib/domain/study-set";
import { getStudySet } from "@/lib/storage/study-store";
import {
  ArrowPathIcon,
  BookOpenIcon,
  PlusCircleIcon,
} from "@/components/icons";

interface ReviewClientProps {
  id: string;
}

export function ReviewClient({ id }: ReviewClientProps) {
  const router = useRouter();
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let mounted = true;
    getStudySet(id)
      .then((set) => {
        if (mounted) {
          setStudySet(set);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load study set:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-brand-secondary flex items-center gap-3 text-xs">
          <ArrowPathIcon className="text-brand-tomato h-4 w-4 animate-spin" />
          <span>Loading your study set...</span>
        </div>
      </div>
    );
  }

  if (!studySet) {
    return (
      <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-12 text-center">
        <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
          <BookOpenIcon className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-brand-ink mt-4 text-base font-bold">
          Study Set Not Found
        </h1>
        <p className="text-brand-secondary mt-1 max-w-sm text-xs">
          This study set could not be found in your local browser storage. It
          may have been deleted.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Link
            href="/library"
            className="border-brand-peach bg-brand-cream text-brand-ink hover:bg-brand-peach/40 inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 text-xs font-bold transition"
          >
            <span>Go to Study Library</span>
          </Link>
          <Link
            href="/materials/new"
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-2xs transition"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>Add Study Material</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SourceReviewView
      initialStudySet={studySet}
      onBack={() => router.push("/library")}
      onSaved={(updated) => setStudySet(updated)}
    />
  );
}
