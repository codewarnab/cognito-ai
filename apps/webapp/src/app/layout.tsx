import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import "./globals.css";
import { Footer } from "@/components/shared/Footer";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import WebMcpProvider from "@/components/providers/WebMcpProvider";
import { WebMcpTools } from "@/components/webmcp";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cognito AI",
  description: "Your AI-powered browser assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          <WebMcpProvider>
            <NuqsAdapter>
              <WebMcpTools />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </NuqsAdapter>
          </WebMcpProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
