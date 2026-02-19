import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Dark Pool — Sealed-Bid Auctions on Canton",
  description:
    "Privacy-preserving sealed-bid auctions powered by Canton Network. Bid in USDCx, funds locked until resolution.",
  keywords: ["auction", "dark pool", "sealed bid", "USDCx", "Canton", "Daml", "DeFi"],
  openGraph: {
    title: "Dark Pool",
    description: "Privacy-preserving sealed-bid auctions",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#050505] text-white antialiased`}
      >
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#141414",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.08)",
                fontFamily: "var(--font-inter)",
              },
              success: { iconTheme: { primary: "#00d4ff", secondary: "#050505" } },
              error: { iconTheme: { primary: "#f87171", secondary: "#050505" } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
