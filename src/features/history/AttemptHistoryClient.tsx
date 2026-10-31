"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StudySet } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import {
  getStudySet,
  listPracticeAttempts,
  listSemanticAudits,
} from "@/lib/storage/study-store";
import { ArrowPathIcon, BookOpenIcon } from "@/components/icons";
import { AttemptHistoryView } from "./AttemptHistoryView";

interface AttemptHistoryClientProps {
  studySetId: string;
  initialQuestionId?: string;
}

export function AttemptHistoryClient({
  studySetId,
  initialQuestionId,
}: AttemptHistoryClientProps) {
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [audits, setAudits] = useState<Record<string, SemanticAuditResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [loadedSet, loadedAttempts, loadedAudits] = await Promise.all([
          getStudySet(studySetId),
          listPracticeAttempts(studySetId),
          listSemanticAudits(studySetId),
        ]);

        if (!mounted) return;

        setStudySet(loadedSet);
        setAttempts(loadedAttempts);

        const auditMap: Record<string, SemanticAuditResult> = {};
        for (const a of loadedAudits) {
          auditMap[a.attemptId] = a;
        }
        setAudits(auditMap);
      } catch (err) {
        console.error("Failed to load attempt history:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [studySetId]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-brand-secondary flex items-center gap-3 text-xs">
          <ArrowPathIcon className="text-brand-tomato h-4 w-4 animate-spin" />
          <span>Loading practice history...</span>
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
        <p className="text-brand-secondary mt-1 text-xs">
          This study set may have been removed or deleted from your browser
          storage.
        </p>
        <div className="mt-4">
          <Link
            href="/library"
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            <span>Return to Study Library</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AttemptHistoryView
      studySet={studySet}
      attempts={attempts}
      audits={audits}
      initialQuestionId={initialQuestionId}
    />
  );
}
