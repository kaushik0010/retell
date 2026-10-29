"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PracticeRoomView } from "./PracticeRoomView";
import { StudySet } from "@/lib/domain/study-set";
import { getStudySet } from "@/lib/storage/study-store";
import { ArrowPathIcon, BookOpenIcon } from "@/components/icons";

interface PracticeRoomClientProps {
  id: string;
  initialQuestionId?: string;
}

export function PracticeRoomClient({
  id,
  initialQuestionId,
}: PracticeRoomClientProps) {
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
        console.error("Failed to load study set for practice:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-brand-secondary flex items-center gap-3 text-xs">
          <ArrowPathIcon className="text-brand-tomato h-4 w-4 animate-spin" />
          <span>Opening your practice room...</span>
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
        <h3 className="font-heading text-brand-ink mt-3 text-sm font-bold">
          Study set not found
        </h3>
        <p className="text-brand-secondary mt-1 max-w-sm text-xs">
          This study material could not be loaded from your device. It may have
          been cleared or created in a different browser.
        </p>
        <Link
          href="/library"
          className="bg-brand-tomato hover:bg-brand-tomato-hover mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition"
        >
          <span>Return to Library</span>
          <span>&rarr;</span>
        </Link>
      </div>
    );
  }

  return (
    <PracticeRoomView
      studySet={studySet}
      initialQuestionId={initialQuestionId}
    />
  );
}
