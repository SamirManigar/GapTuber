import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GapTuber — AI YouTube Content Gap Finder for Creators",
  description: "GapTuber finds high-demand, low-competition YouTube video ideas your competitors haven't made yet. Grow your channel faster with weekly data-driven content gap reports.",
  keywords: [
    "YouTube content gap tool",
    "AI video idea generator",
    "find trending YouTube topics",
    "YouTube keyword research",
    "grow YouTube channel",
    "YouTube gap analysis",
    "GapTuber",
    "Aurion Stack",
  ],
  authors: [{ name: "Aurion Stack", url: "https://aurionstack.dev" }],
  metadataBase: new URL("https://gaptuber.app"),
  openGraph: {
    title: "GapTuber — Find YouTube Video Ideas Your Competitors Missed",
    description: "Stop guessing what to film next. GapTuber's AI surfaces high-demand, low-competition video gaps in your niche — delivered weekly.",
    type: "website",
    url: "https://gaptuber.app",
    siteName: "GapTuber by Aurion Stack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "GapTuber — YouTube Content Gap Finder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GapTuber — Find YouTube Video Ideas Your Competitors Missed",
    description: "Stop guessing what to film. GapTuber finds the gaps — high volume, low competition, ready to film.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'light') {
                  document.documentElement.classList.add('light-mode');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#0a0a0f]">
        <noscript>
          <div style={{ padding: "20px", textAlign: "center", color: "#e4e4e7", background: "#0c0c0e", fontFamily: "sans-serif" }}>
            GapTuber requires JavaScript to run. Please enable JavaScript in your browser settings.
          </div>
        </noscript>
        <Providers>{children}</Providers>
        <Toaster theme="dark" position="bottom-right" richColors toastOptions={{ className: 'font-mono text-sm border-[#1e1e22]' }} />
      </body>
    </html>
  );
}
