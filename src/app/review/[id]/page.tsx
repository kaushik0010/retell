import type { Metadata } from "next";
import { ReviewClient } from "@/features/review/ReviewClient";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ReviewPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Review Points to Remember",
    description: `Review and refine your exam questions and important points to remember before practising aloud. Set ID: ${id}`,
  };
}

export default async function ReviewByIdPage({ params }: ReviewPageProps) {
  const { id } = await params;
  return <ReviewClient id={id} />;
}
