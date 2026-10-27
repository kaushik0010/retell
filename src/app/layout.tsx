import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retell — Know it. Say it. Improve it.",
  description:
    "Practice explaining exam answers in your own words, identify missing concepts, correct inaccuracies, and improve through source-grounded speech feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-brand-cream text-brand-ink flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
