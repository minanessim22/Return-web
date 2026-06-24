import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Logo } from '@/components/Logo';
import { BackButton } from '@/components/BackButton';
import { BackButtonProvider } from '@/components/BackButtonProvider';

import "./globals.css";

export const metadata: Metadata = {
  title: "RETURN",
  description: "Smart Lost & Found platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body suppressHydrationWarning className="h-full font-sans antialiased">
        <AuthProvider>
          <BackButtonProvider>
            <div className="fixed left-3 top-3 z-50 pointer-events-auto sm:left-4 sm:top-4 md:left-6 md:top-5">
              <Logo width={100} height={32} />
            </div>
            <div className="fixed left-3 top-[38px] z-50 pointer-events-auto sm:left-4 sm:top-[42px] md:left-6 md:top-[58px]">
              <BackButton />
            </div>
            {children}
          </BackButtonProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
