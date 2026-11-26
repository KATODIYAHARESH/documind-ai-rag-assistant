import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/context/toast";

export const metadata: Metadata = {
  title: {
    default: "DocuMind AI — Your Documents. Your Intelligence.",
    template: "%s · DocuMind AI",
  },
  description:
    "Transform your documents into an intelligent knowledge base. Ask questions, discover insights, and get accurate, source-cited answers with a genuine RAG pipeline.",
  applicationName: "DocuMind AI",
  keywords: ["RAG", "document intelligence", "AI assistant", "PDF", "knowledge base"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink-950 font-sans text-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
