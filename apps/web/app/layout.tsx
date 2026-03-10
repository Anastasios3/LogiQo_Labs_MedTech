import type { Metadata } from "next";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogiQo MedTech | Unified Medical Hardware Platform",
  description:
    "The manufacturer-agnostic medical hardware index and peer telemetry platform for hospitals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
      lang="en" — required for screen readers to select correct voice/language.
      (Inclusive Components: Document language)
    */
    <html lang="en" className="h-full">
      <head>
        {/* Inter via Google Fonts — subset to reduce payload */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
