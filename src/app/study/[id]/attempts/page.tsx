import type { Metadata } from "next";
import { AttemptHistoryClient } from "@/features/history/AttemptHistoryClient";

interface AttemptsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ questionId?: string }>;
}

export async function generateMetadata({
  params,
}: AttemptsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Attempt History | Retell",
    description: `View past practice attempts and progress for Study Set: ${id}`,
  };
}

export default async function AttemptsPage({
  params,
  searchParams,
}: AttemptsPageProps) {
  const { id } = await params;
  const { questionId } = await searchParams;

  return (
    <AttemptHistoryClient studySetId={id} initialQuestionId={questionId} />
  );
}
