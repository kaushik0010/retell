"use client";

import React, { useState } from "react";
import { StudySet } from "@/lib/domain/study-set";
import { MaterialIngestionForm } from "@/features/library/MaterialIngestionForm";
import { StudySetList } from "@/features/library/StudySetList";
import { SourceReviewView } from "@/features/source-review/SourceReviewView";
import { BookOpenIcon, PlusIcon, SparklesIcon } from "@/components/icons";

type AppView = "ingest" | "review" | "library";

export default function HomePage() {
  const [currentView, setCurrentView] = useState<AppView>("ingest");
  const [activeStudySet, setActiveStudySet] = useState<StudySet | null>(null);

  const handleStudySetReady = (studySet: StudySet) => {
    setActiveStudySet(studySet);
    setCurrentView("review");
  };

  const handleSelectFromLibrary = (studySet: StudySet) => {
    setActiveStudySet(studySet);
    setCurrentView("review");
  };

  const handleNewMaterial = () => {
    setActiveStudySet(null);
    setCurrentView("ingest");
  };

  const handleBackToLibrary = () => {
    setCurrentView("library");
  };

  return (
    <div className="bg-brand-cream text-brand-ink flex min-h-screen flex-col">
      {/* Navigation Header */}
      <header className="border-brand-peach/60 sticky top-0 z-20 border-b bg-white/80 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div
            onClick={handleNewMaterial}
            className="flex cursor-pointer items-center gap-3"
          >
            <div className="bg-brand-tomato font-heading flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white shadow-xs">
              R
            </div>
            <div>
              <span className="font-heading text-brand-ink text-xl font-bold tracking-tight">
                Retell
              </span>
              <span className="text-brand-secondary ml-2 hidden text-xs font-medium sm:inline">
                Meta Global AI Developer Hackathon
              </span>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewMaterial}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                currentView === "ingest"
                  ? "bg-brand-tomato text-white shadow-xs"
                  : "bg-brand-cream text-brand-ink hover:bg-brand-peach/40"
              }`}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Add Material</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView("library")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                currentView === "library"
                  ? "bg-brand-tomato text-white shadow-xs"
                  : "bg-brand-cream text-brand-ink hover:bg-brand-peach/40"
              }`}
            >
              <BookOpenIcon className="h-3.5 w-3.5" />
              <span>Library</span>
            </button>

            {activeStudySet && (
              <button
                type="button"
                onClick={() => setCurrentView("review")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  currentView === "review"
                    ? "bg-brand-tomato text-white shadow-xs"
                    : "bg-brand-cream text-brand-ink hover:bg-brand-peach/40"
                }`}
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate sm:max-w-none">
                  Review: {activeStudySet.material.title}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {currentView === "ingest" && (
            <div className="space-y-6">
              {/* Product Mission Hero */}
              <div className="space-y-2 text-center sm:text-left">
                <div className="bg-brand-butter text-brand-ink inline-block rounded-xl px-3 py-1 text-xs font-semibold tracking-wider uppercase">
                  Know it. Say it. Improve it.
                </div>
                <h1 className="font-heading text-brand-ink text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Study Material Ingestion &amp; Rubric Generation
                </h1>
                <p className="text-brand-secondary max-w-2xl text-sm leading-relaxed sm:text-base">
                  Paste lecture notes or exam study materials. Retell extracts
                  the core questions and builds a structured, source-grounded
                  rubric that accepts semantically valid paraphrasing.
                </p>
              </div>

              <MaterialIngestionForm onStudySetReady={handleStudySetReady} />
            </div>
          )}

          {currentView === "review" && activeStudySet && (
            <SourceReviewView
              initialStudySet={activeStudySet}
              onBack={handleBackToLibrary}
              onSaved={(updated) => setActiveStudySet(updated)}
            />
          )}

          {currentView === "library" && (
            <StudySetList
              onSelectStudySet={handleSelectFromLibrary}
              onNewMaterial={handleNewMaterial}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-brand-peach/60 text-brand-secondary border-t bg-white/60 py-6 text-center text-xs">
        <p>
          Retell — Meta Global AI Developer Hackathon • Privacy-First Spoken
          Active Recall
        </p>
      </footer>
    </div>
  );
}
