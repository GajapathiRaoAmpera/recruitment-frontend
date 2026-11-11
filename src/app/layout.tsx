import type { Metadata } from "next";
import { Fragment_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { MockStoreProvider } from "@/mock/store";
import "./globals.scss";

const fragmentMono = Fragment_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fragment-mono",
});

export const metadata: Metadata = {
  title: { default: "Ampera Campus Hire", template: "%s · Ampera Campus Hire" },
  description: "Campus recruitment drives from resume shortlist to final decision.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fragmentMono.variable}>
      <head>
        {/* Switzer via the Fontshare API (ITF Free Font License); falls back to system-ui. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400,500&display=swap" />
      </head>
      <body>
        {/* One store for all portals so HR actions show up in the student portal and vice versa. */}
        <MockStoreProvider>
          <ToastProvider>{children}</ToastProvider>
        </MockStoreProvider>
      </body>
    </html>
  );
}
