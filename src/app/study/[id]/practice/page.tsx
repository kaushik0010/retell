import type { Metadata } from "next";
import { PracticeRoomClient } from "@/features/practice/PracticeRoomClient";

interface PracticePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ questionId?: string }>;
}

export async function generateMetadata({
  params,
}: PracticePageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Spoken Practice Room",
    description: `Rehearse explaining your exam answers aloud with real-time speech transcription. Study Set: ${id}`,
  };
}

export default async function StudyPracticePage({
  params,
  searchParams,
}: PracticePageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <PracticeRoomClient
      id={id}
      initialQuestionId={resolvedSearchParams?.questionId}
    />
  );
}
