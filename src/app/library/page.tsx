"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudySet } from "@/lib/domain/study-set";
import { listStudySets, deleteStudySet } from "@/lib/storage/study-store";
import {
  BookOpenIcon,
  TrashIcon,
  PlusCircleIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  SearchIcon,
  PlayIcon,
} from "@/components/icons";

export default function LibraryPage() {
  const router = useRouter();
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "ready" | "recent">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mountedTime] = useState(() => Date.now());

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

  // Filter study sets by search query and tab
  const filteredSets = studySets.filter((set) => {
    const matchesSearch =
      set.material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      set.questions.some((q) =>
        q.question.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (!matchesSearch) return false;

    if (filterTab === "recent") {
      const oneWeekAgo = mountedTime - 7 * 24 * 60 * 60 * 1000;
      return new Date(set.updatedAt).getTime() >= oneWeekAgo;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header matching reference image 3 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-brand-ink text-2xl font-bold sm:text-3xl">
            Study Library
          </h1>
          <p className="text-brand-secondary mt-1 text-xs sm:text-sm">
            All your saved questions and answers in one place.
          </p>
        </div>

        <Link
          href="/materials/new"
          className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-xl px-4 text-xs font-bold text-white shadow-xs transition sm:self-auto"
        >
          <PlusCircleIcon className="h-4 w-4" />
          <span>Add study material</span>
        </Link>
      </div>

      {/* Search & Filter Bar matching reference */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative max-w-md flex-1">
          <SearchIcon className="text-brand-secondary/60 absolute top-3 left-3.5 h-4 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions, subjects or keywords..."
            className="border-brand-peach/70 text-brand-ink placeholder:text-brand-secondary/60 focus:border-brand-tomato w-full rounded-xl border bg-white py-2 pr-4 pl-10 text-xs focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              filterTab === "all"
                ? "bg-brand-tomato text-white shadow-2xs"
                : "border-brand-peach/60 text-brand-secondary hover:text-brand-ink border bg-white"
            }`}
          >
            All ({studySets.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("ready")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              filterTab === "ready"
                ? "bg-brand-tomato text-white shadow-2xs"
                : "border-brand-peach/60 text-brand-secondary hover:text-brand-ink border bg-white"
            }`}
          >
            Ready to practise
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("recent")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              filterTab === "recent"
                ? "bg-brand-tomato text-white shadow-2xs"
                : "border-brand-peach/60 text-brand-secondary hover:text-brand-ink border bg-white"
            }`}
          >
            Recently added
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="border-brand-peach/60 flex h-48 items-center justify-center rounded-2xl border bg-white/70">
          <div className="text-brand-secondary flex items-center gap-3 text-xs">
            <ArrowPathIcon className="text-brand-tomato h-4 w-4 animate-spin" />
            <span>Loading study library...</span>
          </div>
        </div>
      ) : filteredSets.length === 0 ? (
        /* Empty State */
        <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-12 text-center">
          <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
            <BookOpenIcon className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-brand-ink mt-4 text-base font-bold">
            {searchQuery
              ? "No matching study sets found"
              : "No study material saved yet"}
          </h3>
          <p className="text-brand-secondary mt-1 max-w-sm text-xs">
            {searchQuery
              ? "Try adjusting your search terms or clear the filter."
              : "Add your first lecture notes, assignment questions, or textbook chapters to start practicing."}
          </p>
          <Link
            href="/materials/new"
            className="bg-brand-tomato hover:bg-brand-tomato-hover mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white shadow-xs transition"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>Add study material</span>
          </Link>
        </div>
      ) : (
        /* Grid of Study Set Cards matching reference image 3 */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSets.map((set) => {
            const totalPoints = Object.values(set.rubrics).reduce(
              (acc, r) => acc + (r.criteria?.length || 0),
              0
            );
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
                onClick={() => router.push(`/review/${set.id}`)}
                className="group border-brand-peach/80 hover:border-brand-tomato/60 flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-brand-cream text-brand-tomato border-brand-peach/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base font-bold">
                        📖
                      </div>
                      <h2 className="font-heading text-brand-ink group-hover:text-brand-tomato line-clamp-2 text-sm font-bold">
                        {set.material.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      aria-label="Delete study set"
                      disabled={deletingId === set.id}
                      onClick={(e) => handleDelete(set.id, e)}
                      className="text-brand-secondary/60 rounded-lg p-1.5 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-brand-secondary mt-3 line-clamp-2 text-xs leading-relaxed">
                    {set.material.sourceText}
                  </p>
                </div>

                <div className="border-brand-peach/40 mt-4 space-y-3 border-t pt-3.5">
                  <div className="text-brand-secondary flex items-center justify-between text-[11px]">
                    <span className="text-brand-ink font-semibold">
                      {set.questions.length}{" "}
                      {set.questions.length === 1 ? "question" : "questions"} •{" "}
                      {totalPoints} key points
                    </span>
                    <span>{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/review/${set.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition"
                    >
                      <span>Review points</span>
                      <ChevronRightIcon className="h-3 w-3" />
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/review/${set.id}`);
                      }}
                      className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-8 items-center justify-center gap-1 rounded-lg px-3 text-xs font-bold text-white shadow-2xs transition"
                    >
                      <PlayIcon className="h-3 w-3" />
                      <span>Practise</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
