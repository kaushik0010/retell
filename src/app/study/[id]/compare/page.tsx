import type { Metadata } from "next";
import { AttemptComparisonClient } from "@/features/history/AttemptComparisonClient";

interface AttemptComparisonPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}

export async function generateMetadata({
  params,
}: AttemptComparisonPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Attempt Comparison | Retell",
    description: `Compare two spoken practice attempts side-by-side to understand your learning progress. Study Set: ${id}`,
  };
}

export default async function AttemptComparisonPage({
  params,
  searchParams,
}: AttemptComparisonPageProps) {
  const { id } = await params;
  const { a, b } = await searchParams;

  if (!a || !b) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h2 className="font-heading text-brand-ink text-base font-bold">
          Missing attempts for comparison
        </h2>
        <p className="text-brand-secondary mt-1 text-xs">
          Please select two attempts from the question history to view a
          side-by-side comparison.
        </p>
      </div>
    );
  }

  return (
    <AttemptComparisonClient studySetId={id} attemptAId={a} attemptBId={b} />
  );
}
