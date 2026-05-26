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
            {/* Header for Logo and BackButton */}
            <div className="w-full flex items-center justify-between p-4 md:p-6 bg-white/50 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm">
              <div className="flex flex-col gap-2 items-start">
                <Logo />
                <BackButton />
              </div>
            </div>
            
            {/* Main content area */}
            <main className="flex-1 w-full flex flex-col relative z-0">
              {children}
            </main>
          </BackButtonProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
