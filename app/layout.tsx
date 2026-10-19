import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted variable fonts (no network needed at build): Inter for body copy, Space Grotesk for
// bold display headings.
const inter = localFont({
  src: "./fonts/inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vaibhav Tiwari",
  description:
    "Public speaker, athlete, 500+ DSA problems, TechInnovation and Skillathon winner, enterprise engineer, and founder of HONEST SWEET. A scroll-through 3D story.",
};

export const viewport: Viewport = {
  themeColor: "#03040a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
