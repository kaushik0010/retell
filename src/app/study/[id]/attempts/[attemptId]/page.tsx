import type { Metadata } from "next";
import { AnswerReviewClient } from "@/features/answer-review/AnswerReviewClient";

interface AnswerReviewPageProps {
  params: Promise<{ id: string; attemptId: string }>;
}

export async function generateMetadata({
  params,
}: AnswerReviewPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Answer Review | Retell",
    description: `Evaluate conceptual understanding and feedback for your spoken practice attempt. Study Set: ${id}`,
  };
}

export default async function AnswerReviewPage({
  params,
}: AnswerReviewPageProps) {
  const { id, attemptId } = await params;

  return <AnswerReviewClient studySetId={id} attemptId={attemptId} />;
}
