import type { Metadata } from "next";
import { LibraryView } from "@/features/library/LibraryView";

export const metadata: Metadata = {
  title: "Study Library",
  description:
    "All your saved questions, answers, and important points in one place. Review and get ready for oral active-recall rehearsal.",
};

export default function LibraryPage() {
  return <LibraryView />;
}
