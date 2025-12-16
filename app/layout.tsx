import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { PageLoadingProvider } from "@/components/page-loading-overlay";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Latin Music Mastery - Learn Latin Music Styles",
  description: "Master Salsa, Bachata, Reggaeton, Cumbia and more with comprehensive online courses organized by country and musical style.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${montserrat.variable} antialiased font-sans`}
      >
        <PageLoadingProvider>
          {children}
        </PageLoadingProvider>
      </body>
    </html>
  );
}
