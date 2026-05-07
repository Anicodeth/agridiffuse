import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-family",
  display: "swap",
  weight: ["500"],
  style: ["normal"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://agridiffuse.app"),
  title: {
    default: "AgriDiffuse — knowledge spread + agent economy",
    template: "%s · AgriDiffuse",
  },
  description:
    "Watch agricultural practices spread through a graph of experts and farmers. The narrator tells you what just happened — the agent layer pays the experts whose advice landed.",
  openGraph: {
    title: "AgriDiffuse",
    description: "Knowledge spreads. Rewards flow back. Same graph, opposite directions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <NavBar />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
