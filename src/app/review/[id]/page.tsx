"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SourceReviewView } from "@/features/source-review/SourceReviewView";
import { StudySet } from "@/lib/domain/study-set";
import { getStudySet } from "@/lib/storage/study-store";
import { ArrowPathIcon, BookOpenIcon } from "@/components/icons";

export default function ReviewByIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

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
      <div className="bg-brand-cream text-brand-ink flex min-h-screen items-center justify-center">
        <div className="text-brand-secondary flex items-center gap-3 text-sm">
          <ArrowPathIcon className="text-brand-tomato h-5 w-5 animate-spin" />
          <span>Loading study set...</span>
        </div>
      </div>
    );
  }

  if (!studySet) {
    return (
      <div className="bg-brand-cream text-brand-ink flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs">
          <BookOpenIcon className="h-6 w-6" />
        </div>
        <h1 className="font-heading mt-4 text-lg font-bold">
          Study Set Not Found
        </h1>
        <p className="text-brand-secondary mt-1 text-xs">
          The requested study set could not be located in your local browser
          storage.
        </p>
        <Link
          href="/"
          className="bg-brand-tomato hover:bg-brand-tomato-hover mt-5 inline-flex rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
        >
          Return to Study Sets
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-brand-cream min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <SourceReviewView
          initialStudySet={studySet}
          onBack={() => router.push("/")}
        />
      </div>
    </div>
  );
}
