import type { Metadata } from "next";
import { HomeView } from "@/features/home/HomeView";

export const metadata: Metadata = {
  title: "Turn Study into Confidence",
  description:
    "Add your exam questions and answers, practise explaining them out loud, and discover missing concepts and technical terms with Retell.",
};

export default function HomePage() {
  return <HomeView />;
}
