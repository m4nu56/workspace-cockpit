import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { SettingsProvider } from "@/components/settings";
import { listFolders, settings } from "@/lib/cockpit";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workspace cockpit",
  description: "Your project folders and Claude Code sessions: what is waiting on you, where each one stands",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const [folders, config] = await Promise.all([listFolders(), settings()]);
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <SettingsProvider value={config}>
            <AppShell folders={folders}>{children}</AppShell>
          </SettingsProvider>
        </Providers>
      </body>
    </html>
  );
}
