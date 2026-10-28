import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Retell — Know it. Say it. Improve it.",
    template: "%s | Retell",
  },
  description:
    "Master your exam answers by speaking them aloud. Retell identifies essential concepts, technical terminology, and key steps so you can rehearse with confidence.",
  keywords: [
    "active recall",
    "exam practice",
    "spoken answers",
    "study tool",
    "oral exam prep",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-brand-cream text-brand-ink flex min-h-full flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
