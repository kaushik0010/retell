import type { Metadata } from "next";
import { AttemptHistoryClient } from "@/features/history/AttemptHistoryClient";

interface AttemptHistoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ questionId?: string }>;
}

export async function generateMetadata({
  params,
}: AttemptHistoryPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Attempt History | Retell",
    description: `View past practice attempts, conceptual progression, and spoken fluency for Study Set: ${id}`,
  };
}

export default async function AttemptHistoryPage({
  params,
  searchParams,
}: AttemptHistoryPageProps) {
  const { id } = await params;
  const { questionId } = await searchParams;

  return (
    <AttemptHistoryClient studySetId={id} initialQuestionId={questionId} />
  );
}
