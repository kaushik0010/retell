import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Retell — Know it. Say it. Improve it.",
    template: "%s | Retell",
  },
  description:
    "Practise exam answers aloud, discover missing concepts, and improve through AI-powered feedback.",
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
