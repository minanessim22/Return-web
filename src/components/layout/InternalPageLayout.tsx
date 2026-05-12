"use client";

import Link from "next/link";
import { Logo } from '@/components/Logo';
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface InternalPageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function InternalPageLayout({ children, title }: InternalPageLayoutProps) {
  const brandBlue = "#014CB3";
  const brandGreen = "#60C10F";

  // Language state with persistence
  const [currentLanguage, setCurrentLanguage] = useState('EN');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('preferred-language');
      if (savedLanguage && (savedLanguage === 'EN' || savedLanguage === 'AR')) {
        setCurrentLanguage(savedLanguage);
      }
    }
  }, []);

  const changeLanguage = (language: string) => {
    setCurrentLanguage(language);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', language);
    }
  };

  const translations = {
    EN: {
      home: "Home",
      login: "Login",
      signUp: "Sign Up",
      language: "Language",
      english: "English",
      arabic: "العربية",
      company: "Company",
      aboutUs: "About us",
      blog: "Blog",
      contactUs: "Contact us",
      pricing: "Pricing",
      testimonials: "Testimonials",
      support: "Support",
      helpCenter: "Help center",
      termsOfService: "Terms of service",
      legal: "Legal",
      privacyPolicy: "Privacy policy",
      status: "Status",
      copyright: "Copyright © 2026\nAll rights reserved"
    },
    AR: {
      home: "الرئيسية",
      login: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      language: "اللغة",
      english: "English",
      arabic: "العربية",
      company: "الشركة",
      aboutUs: "من نحن",
      blog: "المدونة",
      contactUs: "اتصل بنا",
      pricing: "الأسعار",
      testimonials: "الشهادات",
      support: "الدعم",
      helpCenter: "مركز المساعدة",
      termsOfService: "شروط الخدمة",
      legal: "قانوني",
      privacyPolicy: "سياسة الخصوصية",
      status: "الحالة",
      copyright: "حقوق الطبع والنشر © ٢٠٢٦\nجميع الحقوق محفوظة"
    }
  };

  const t = translations[currentLanguage as keyof typeof translations];

  return (
    <div className="w-full min-h-screen bg-white overflow-x-hidden font-sans" dir={currentLanguage === 'AR' ? 'rtl' : 'ltr'}>

      {/* Header (Navbar) */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 w-full shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Logo width={140} height={45} />
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/" className="text-gray-500 hover:text-[#014CB3] font-bold transition-colors">
              {t.home}
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <Button variant="outline" className="border-[#014CB3] text-[#014CB3] hover:bg-[#014CB3] hover:text-white px-8 h-12 rounded-xl text-lg font-bold">
              {t.login}
            </Button>
            <Button className="bg-[#60C10F] hover:bg-[#60C10F]/90 text-white px-8 h-12 rounded-xl text-lg font-bold shadow-lg">
              {t.signUp}
            </Button>
          </div>
        </div>
      </header>

      {/* Page Title */}
      <section className="w-full py-16 bg-gradient-to-r from-[#014CB3] to-[#60C10F]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h1 className="text-5xl lg:text-6xl font-black text-white text-center">{title}</h1>
        </div>
      </section>

      {/* Page Content */}
      <section className="w-full py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          {children}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full pt-16" style={{ background: `linear-gradient(to right, ${brandBlue}, ${brandGreen})` }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Logo and Copyright */}
            <div className="lg:col-span-1 space-y-6">
              <Logo width={140} height={45} invert />
              <p className="text-white font-bold opacity-90" style={{ whiteSpace: 'pre-line' }}>{t.copyright}</p>
              <div className="flex gap-4">
                {/* Instagram */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shadow-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                {/* Twitter */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shadow-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </div>
                {/* Facebook */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shadow-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                {/* LinkedIn */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shadow-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="space-y-4">
              <h4 className="text-xl font-black mb-6 text-white">{t.language}</h4>
              <div className="space-y-2">
                <button
                  onClick={() => changeLanguage('EN')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full text-left ${
                    currentLanguage === 'EN'
                      ? 'bg-white text-[#014CB3]'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  {t.english}
                </button>
                <button
                  onClick={() => changeLanguage('AR')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full text-left ${
                    currentLanguage === 'AR'
                      ? 'bg-white text-[#014CB3]'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  {t.arabic}
                </button>
              </div>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="text-xl font-black mb-6 text-white">{t.company}</h4>
              <div className="space-y-3">
                <Link href="/about" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.aboutUs}</Link>
                <Link href="/blog" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.blog}</Link>
                <Link href="/contact" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.contactUs}</Link>
                <Link href="/pricing" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.pricing}</Link>
                <Link href="/testimonials" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.testimonials}</Link>
              </div>
            </div>

            {/* Support */}
            <div className="space-y-4">
              <h4 className="text-xl font-black mb-6 text-white">{t.support}</h4>
              <div className="space-y-3">
                <Link href="/help" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.helpCenter}</Link>
                <Link href="/terms" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.termsOfService}</Link>
                <Link href="/legal" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.legal}</Link>
                <Link href="/privacy" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.privacyPolicy}</Link>
                <Link href="/status" className="block text-white font-semibold opacity-80 hover:opacity-100 transition-opacity">{t.status}</Link>
              </div>
            </div>

            {/* Stay up to date - Removed from internal pages */}
          </div>
        </div>
      </footer>
    </div>
  );
}
