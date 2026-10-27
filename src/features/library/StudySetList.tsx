"use client";

import React, { useEffect, useState } from "react";
import { StudySet } from "@/lib/domain/study-set";
import { listStudySets, deleteStudySet } from "@/lib/storage/study-store";
import {
  BookOpenIcon,
  TrashIcon,
  PlusIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from "@/components/icons";

interface StudySetListProps {
  onSelectStudySet: (studySet: StudySet) => void;
  onNewMaterial: () => void;
}

export function StudySetList({
  onSelectStudySet,
  onNewMaterial,
}: StudySetListProps) {
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listStudySets()
      .then((sets) => {
        if (mounted) {
          setStudySets(sets);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load study sets:", err);
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this study set?")) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteStudySet(id);
      setStudySets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to delete study set:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="border-brand-peach/80 flex min-h-[300px] items-center justify-center rounded-2xl border bg-white p-8">
        <div className="text-brand-secondary flex items-center gap-3 text-sm">
          <ArrowPathIcon className="text-brand-tomato h-5 w-5 animate-spin" />
          <span>Loading your study library...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-brand-ink text-xl font-bold">
            Your Study Library
          </h2>
          <p className="text-brand-secondary mt-0.5 text-xs">
            {studySets.length === 1
              ? "1 study set saved locally in your browser"
              : `${studySets.length} study sets saved locally in your browser`}
          </p>
        </div>

        <button
          type="button"
          onClick={onNewMaterial}
          className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white shadow-xs transition"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add New Material</span>
        </button>
      </div>

      {/* Empty State */}
      {studySets.length === 0 ? (
        <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-12 text-center">
          <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
            <BookOpenIcon className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-brand-ink mt-4 text-base font-bold">
            No study sets yet
          </h3>
          <p className="text-brand-secondary mt-1 max-w-sm text-xs">
            Add lecture notes, textbook chapters, or exam study sheets to begin
            practicing active spoken recall.
          </p>
          <button
            type="button"
            onClick={onNewMaterial}
            className="bg-brand-tomato hover:bg-brand-tomato-hover mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-xs font-semibold text-white shadow-xs transition"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Study Material</span>
          </button>
        </div>
      ) : (
        /* List of Study Sets */
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {studySets.map((set) => {
            const totalCriteria = Object.values(set.rubrics).reduce(
              (acc, r) => acc + (r.criteria?.length || 0),
              0
            );
            const dateStr = new Date(set.updatedAt).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              }
            );

            return (
              <div
                key={set.id}
                onClick={() => onSelectStudySet(set)}
                className="group border-brand-peach/80 hover:border-brand-tomato/60 flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-brand-ink group-hover:text-brand-tomato line-clamp-2 text-base font-bold">
                      {set.material.title}
                    </h3>
                    <button
                      type="button"
                      aria-label="Delete study set"
                      disabled={deletingId === set.id}
                      onClick={(e) => handleDelete(set.id, e)}
                      className="text-brand-secondary rounded-lg p-1.5 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-brand-secondary mt-2 line-clamp-2 text-xs leading-relaxed">
                    {set.material.sourceText}
                  </p>
                </div>

                <div className="border-brand-peach/40 text-brand-secondary mt-4 flex items-center justify-between border-t pt-4 text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="text-brand-ink font-semibold">
                      {set.questions.length}{" "}
                      {set.questions.length === 1 ? "question" : "questions"}
                    </span>
                    <span>•</span>
                    <span>{totalCriteria} criteria</span>
                    <span>•</span>
                    <span>{dateStr}</span>
                  </div>

                  <span className="text-brand-tomato inline-flex items-center gap-1 font-semibold transition-transform group-hover:translate-x-0.5">
                    <span>Review &amp; Edit</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
