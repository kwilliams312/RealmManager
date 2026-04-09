import type { Metadata } from "next";
import "./globals.css";
import { DynamicBranding } from "./DynamicBranding";
import { SetupGuard } from "@/components/SetupGuard";
import { DEFAULT_BRANDING } from "@/lib/branding";

export const metadata: Metadata = {
  title: DEFAULT_BRANDING.pageTitle,
  description: "AzerothCore WotLK Server Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DynamicBranding />
        <SetupGuard>
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "24px 24px 48px",
            }}
          >
            {children}
          </div>
        </SetupGuard>
      </body>
    </html>
  );
}
