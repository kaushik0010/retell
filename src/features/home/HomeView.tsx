"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { StudySet } from "@/lib/domain/study-set";
import { listStudySets } from "@/lib/storage/study-store";
import { SAMPLE_STUDY_MATERIALS } from "@/features/library/sample-materials";
import {
  BookOpenIcon,
  PlusCircleIcon,
  ChevronRightIcon,
  SparklesIcon,
  ArrowPathIcon,
} from "@/components/icons";

export function HomeView() {
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalQuestions = studySets.reduce(
    (acc, set) => acc + (set.questions?.length || 0),
    0
  );

  const totalKeyPoints = studySets.reduce((acc, set) => {
    const setPoints = Object.values(set.rubrics || {}).reduce(
      (rAcc, rub) => rAcc + (rub.criteria?.length || 0),
      0
    );
    return acc + setPoints;
  }, 0);

  return (
    <div className="space-y-8">
      {/* Hero Banner matching visual reference */}
      <section className="border-brand-peach/80 via-brand-cream relative overflow-hidden rounded-3xl border bg-gradient-to-br from-[#FFF4DF] to-[#FFE7DC] p-6 shadow-xs sm:p-8 md:p-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:gap-8">
          {/* Left Text & CTA */}
          <div className="w-full max-w-xl space-y-3.5 text-center sm:text-left">
            <h1 className="font-heading text-brand-ink text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Turn what you study <br className="hidden sm:inline" />
              <span className="text-brand-tomato">into confidence.</span>
            </h1>
            <p className="text-brand-secondary text-sm leading-relaxed sm:text-base">
              Add your questions and answers, practise explaining them out loud,
              and discover what you missed before your exam.
            </p>
            <div className="pt-2">
              <Link
                href="/materials/new"
                className="bg-brand-tomato hover:bg-brand-tomato-hover focus-visible:outline-brand-tomato inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <PlusCircleIcon className="h-5 w-5" />
                <span>Add study material</span>
              </Link>
            </div>
          </div>

          {/* Hero Illustration */}
          <div className="flex w-full shrink-0 items-center justify-center md:w-auto">
            <div className="relative flex items-center justify-center">
              <Image
                src="/assets/homepage_illustration.png"
                alt="Student practising an exam answer aloud"
                width={480}
                height={320}
                priority
                className="h-auto w-full max-w-[280px] object-contain sm:max-w-[340px] md:max-w-[400px] lg:max-w-[440px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Continue Practising Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-brand-ink text-lg font-bold sm:text-xl">
              Continue practising
            </h2>
            <p className="text-brand-secondary text-xs">
              Review your saved questions and rehearse explaining them.
            </p>
          </div>
          {studySets.length > 0 && (
            <Link
              href="/library"
              className="text-brand-tomato inline-flex cursor-pointer items-center gap-1 text-xs font-bold hover:underline"
            >
              <span>View all</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="border-brand-peach/60 text-brand-secondary flex h-32 items-center justify-center rounded-2xl border bg-white/70 p-6 text-xs">
            <ArrowPathIcon className="text-brand-tomato mr-2 h-4 w-4 animate-spin" />
            <span>Loading your study sets...</span>
          </div>
        ) : studySets.length === 0 ? (
          /* Friendly Empty State */
          <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-8 text-center sm:p-10">
            <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
              <BookOpenIcon className="h-6 w-6" />
            </div>
            <h3 className="font-heading text-brand-ink mt-3 text-base font-bold">
              No study material added yet
            </h3>
            <p className="text-brand-secondary mt-1 max-w-sm text-xs leading-relaxed">
              Paste your homework questions, textbook chapters, or exam notes to
              start building your active recall checklist.
            </p>
            <Link
              href="/materials/new"
              className="bg-brand-tomato hover:bg-brand-tomato-hover mt-4 inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white shadow-xs transition"
            >
              <PlusCircleIcon className="h-4 w-4" />
              <span>Add your first study set</span>
            </Link>
          </div>
        ) : (
          /* Cards Grid matching reference image */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {studySets.slice(0, 3).map((set) => {
              const dateStr = new Date(set.updatedAt).toLocaleDateString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                }
              );

              return (
                <div
                  key={set.id}
                  className="border-brand-peach/80 hover:border-brand-tomato/50 flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="bg-brand-cream text-brand-tomato rounded-lg px-2 py-0.5 text-[10px] font-bold">
                        {set.questions.length}{" "}
                        {set.questions.length === 1 ? "question" : "questions"}
                      </span>
                      <span className="text-brand-secondary text-[10px]">
                        {dateStr}
                      </span>
                    </div>

                    <h3 className="font-heading text-brand-ink line-clamp-2 text-base font-bold">
                      {set.material.title}
                    </h3>
                  </div>

                  <div className="border-brand-peach/40 mt-5 flex items-center justify-between border-t pt-3">
                    <Link
                      href={`/review/${set.id}`}
                      className="text-brand-tomato hover:text-brand-tomato-hover inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold"
                    >
                      <span>Review points</span>
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </Link>

                    {/* Honest Affordance: Practice Room arrives in Day 3 */}
                    <button
                      type="button"
                      disabled
                      title="The Spoken Practice Room unlocks in Day 3. Review your points first!"
                      className="border-brand-peach/70 bg-brand-cream/60 text-brand-secondary inline-flex h-8 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold opacity-75 shadow-2xs"
                    >
                      <span>Practise</span>
                      <span className="bg-brand-peach/60 text-brand-secondary rounded px-1 py-0.5 text-[9px] font-bold">
                        Day 3
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Your Study Progress Section (Truthful metrics, larger typography) */}
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-brand-ink text-lg font-bold sm:text-xl">
            Your study progress
          </h2>
          <p className="text-brand-secondary text-xs">
            Track questions and essential points saved in your local workspace.
          </p>
        </div>

        {studySets.length === 0 ? (
          <div className="border-brand-peach/80 rounded-2xl border bg-white/80 p-6 text-center shadow-xs">
            <p className="text-brand-secondary text-xs">
              Your practice statistics will appear here once you save your first
              study set.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 text-center shadow-xs">
              <div className="font-heading text-brand-tomato text-3xl font-extrabold sm:text-4xl">
                {studySets.length}
              </div>
              <div className="text-brand-ink mt-1.5 text-sm font-bold sm:text-base">
                Study Sets
              </div>
              <div className="text-brand-secondary mt-0.5 text-xs">
                Saved in your library
              </div>
            </div>

            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 text-center shadow-xs">
              <div className="font-heading text-brand-tomato text-3xl font-extrabold sm:text-4xl">
                {totalQuestions}
              </div>
              <div className="text-brand-ink mt-1.5 text-sm font-bold sm:text-base">
                Questions
              </div>
              <div className="text-brand-secondary mt-0.5 text-xs">
                Ready for active recall
              </div>
            </div>

            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 text-center shadow-xs">
              <div className="font-heading text-brand-tomato text-3xl font-extrabold sm:text-4xl">
                {totalKeyPoints}
              </div>
              <div className="text-brand-ink mt-1.5 text-sm font-bold sm:text-base">
                Points to Remember
              </div>
              <div className="text-brand-secondary mt-0.5 text-xs">
                Concepts, terms, &amp; steps
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Curated quick-start examples */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="text-brand-tomato h-4 w-4" />
          <h2 className="font-heading text-brand-secondary text-sm font-bold tracking-wider uppercase">
            Curated Study Sets
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SAMPLE_STUDY_MATERIALS.map((sample) => (
            <Link
              key={sample.id}
              href={`/materials/new?preset=${sample.id}`}
              className="group border-brand-peach/80 hover:border-brand-tomato/60 flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition hover:shadow-sm"
            >
              <div>
                <span className="text-brand-tomato text-[10px] font-bold tracking-wider uppercase">
                  {sample.category}
                </span>
                <h3 className="font-heading text-brand-ink group-hover:text-brand-tomato mt-1 line-clamp-2 text-xs font-bold">
                  {sample.title}
                </h3>
              </div>
              <div className="border-brand-peach/40 text-brand-tomato mt-3 flex items-center justify-between border-t pt-2 text-[11px] font-semibold">
                <span>Start practice</span>
                <ChevronRightIcon className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Encouragement Card */}
      <section className="border-brand-peach/60 bg-brand-cream/80 flex items-center gap-4 rounded-2xl border p-5 shadow-2xs">
        <div className="bg-brand-butter flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl">
          💡
        </div>
        <div>
          <h3 className="font-heading text-brand-ink text-sm font-bold">
            A little practice goes a long way.
          </h3>
          <p className="text-brand-secondary mt-0.5 text-xs">
            Practising explanations out loud strengthens mental pathways and
            uncovers blind spots before exam day.
          </p>
        </div>
      </section>
    </div>
  );
}
