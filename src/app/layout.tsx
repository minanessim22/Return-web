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
    <html lang="en" className="h-full">
      <body suppressHydrationWarning className="h-full font-sans antialiased">
        <AuthProvider>
          <BackButtonProvider>
            <div className="fixed left-4 top-4 z-50 pointer-events-auto md:left-6 md:top-5">
              <Logo />
            </div>
            <div className="fixed left-4 top-[42px] z-50 pointer-events-auto md:left-6 md:top-[58px]">
              <BackButton />
            </div>
            {children}
          </BackButtonProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
