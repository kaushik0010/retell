"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnswerReviewView } from "./AnswerReviewView";
import { StudySet } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import {
  getStudySet,
  getPracticeAttempt,
  getSemanticAuditByAttempt,
  getSemanticAuditResult,
} from "@/lib/storage/study-store";
import { ArrowPathIcon, BookOpenIcon } from "@/components/icons";

interface AnswerReviewClientProps {
  studySetId: string;
  attemptId: string;
}

export function AnswerReviewClient({
  studySetId,
  attemptId,
}: AnswerReviewClientProps) {
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const [audit, setAudit] = useState<SemanticAuditResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [loadedSet, loadedAttempt] = await Promise.all([
          getStudySet(studySetId),
          getPracticeAttempt(attemptId),
        ]);

        if (!mounted) return;

        setStudySet(loadedSet);
        setAttempt(loadedAttempt);

        if (loadedAttempt) {
          let loadedAudit: SemanticAuditResult | null = null;
          if (loadedAttempt.auditId) {
            loadedAudit = await getSemanticAuditResult(loadedAttempt.auditId);
          }
          if (!loadedAudit) {
            loadedAudit = await getSemanticAuditByAttempt(attemptId);
          }
          if (mounted) {
            setAudit(loadedAudit);
          }
        }
      } catch (err) {
        console.error("Failed to load attempt or audit data:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [studySetId, attemptId]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-brand-secondary flex items-center gap-3 text-xs">
          <ArrowPathIcon className="text-brand-tomato h-4 w-4 animate-spin" />
          <span>Loading answer evaluation...</span>
        </div>
      </div>
    );
  }

  if (!studySet || !attempt) {
    return (
      <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-12 text-center">
        <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
          <BookOpenIcon className="h-6 w-6" />
        </div>
        <h3 className="font-heading text-brand-ink mt-3 text-sm font-bold">
          Practice attempt not found
        </h3>
        <p className="text-brand-secondary mt-1 text-xs">
          This practice attempt may have been deleted or expired from browser
          storage.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/study/${studySetId}/practice`}
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            Go to Practice Room
          </Link>
          <Link
            href="/library"
            className="border-brand-peach text-brand-secondary hover:text-brand-ink inline-flex items-center rounded-xl border bg-white px-4 py-2 text-xs font-semibold transition"
          >
            Return to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AnswerReviewView
      studySet={studySet}
      attempt={attempt}
      initialAudit={audit}
    />
  );
}
