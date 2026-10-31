"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StudySet } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import { getStudySet, getAttemptWithAudit } from "@/lib/storage/study-store";
import { ArrowPathIcon, BookOpenIcon } from "@/components/icons";
import { AttemptComparisonView } from "./AttemptComparisonView";

interface AttemptComparisonClientProps {
  studySetId: string;
  attemptAId: string;
  attemptBId: string;
}

export function AttemptComparisonClient({
  studySetId,
  attemptAId,
  attemptBId,
}: AttemptComparisonClientProps) {
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [attemptA, setAttemptA] = useState<PracticeAttempt | null>(null);
  const [attemptB, setAttemptB] = useState<PracticeAttempt | null>(null);
  const [auditA, setAuditA] = useState<SemanticAuditResult | null>(null);
  const [auditB, setAuditB] = useState<SemanticAuditResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [set, resA, resB] = await Promise.all([
          getStudySet(studySetId),
          getAttemptWithAudit(attemptAId),
          getAttemptWithAudit(attemptBId),
        ]);

        if (!mounted) return;

        setStudySet(set);
        if (resA) {
          setAttemptA(resA.attempt);
          setAuditA(resA.audit);
        }
        if (resB) {
          setAttemptB(resB.attempt);
          setAuditB(resB.audit);
        }
      } catch (err) {
        console.error("Failed to load attempts for comparison:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [studySetId, attemptAId, attemptBId]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-brand-secondary flex items-center gap-3 text-xs">
          <ArrowPathIcon className="text-brand-tomato h-4 w-4 animate-spin" />
          <span>Loading attempt comparison...</span>
        </div>
      </div>
    );
  }

  if (!studySet || !attemptA || !attemptB) {
    return (
      <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-12 text-center">
        <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
          <BookOpenIcon className="h-6 w-6" />
        </div>
        <h3 className="font-heading text-brand-ink mt-3 text-sm font-bold">
          Could not load both attempts
        </h3>
        <p className="text-brand-secondary mt-1 text-xs">
          One or both selected attempts could not be found in your local browser
          storage.
        </p>
        <div className="mt-4">
          <Link
            href={`/study/${studySetId}/history`}
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            <span>Back to attempt history</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AttemptComparisonView
      studySet={studySet}
      attemptA={attemptA}
      attemptB={attemptB}
      auditA={auditA}
      auditB={auditB}
    />
  );
}
