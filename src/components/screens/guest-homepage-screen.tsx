'use client';

import Image from "next/image";
import Link from "next/link";
import { Logo } from '@/components/Logo';
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * GuestHomepageScreen Component
 * Complete responsive homepage with 3-slide hero section
 */
export function GuestHomepageScreen() {
  // Router
  const router = useRouter();

  // Brand colors
  const brandBlue = "#014CB3";
  const brandGreen = "#60C10F";
  const darkGray = "#58595D";
  const lightGray = "#F3F4F6";

  // Hero slider state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Language state with persistence
  const [currentLanguage, setCurrentLanguage] = useState('EN');

  // Load language preference after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('preferred-language');
      if (savedLanguage && (savedLanguage === 'EN' || savedLanguage === 'AR')) {
        setCurrentLanguage(savedLanguage);
      }
    }
  }, []);

  // Save language preference when changed
  const changeLanguage = (language: string) => {
    setCurrentLanguage(language);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', language);
    }
  };

  // Translations
  const translations = {
    EN: {
      // Header
      home: "Home",
      categories: "Categories",
      impacts: "Impacts",
      howItWorks: "How it works",
      about: "About",
      login: "Login",
      signUp: "Sign Up",

      // Hero slides
      heroSlide1: {
        title: (
          <>
            <span style={{ color: brandBlue }}>Simple Steps</span><br />
            <span style={{ color: brandGreen }}>Smart </span>
            <span style={{ color: brandBlue }}>Technology</span><br />
            <span style={{ color: brandBlue }}>Safe </span>
            <span style={{ color: brandGreen }}>Reunions</span>
          </>
        ),
        description: "From reporting a case to secure handover, {returnName} guides every step with AI matching, geo-alerts, and verified communication to reunite families faster.",
        buttonText: "REPORT MISSING"
      },
      heroSlide2: {
        title: (
          <>
            <span style={{ color: brandBlue }}>Be the </span>
            <span style={{ color: brandGreen }}>Reason</span><br />
            <span style={{ color: brandBlue }}>Someone Gets</span><br />
            <span style={{ color: brandGreen }}>Home</span>
          </>
        ),
        description: "If you've found someone who may be missing, simply scan their QR bracelet or take a photo. Our AI system verifies identity and notifies their family instantly and securely.",
        buttonText: "I FOUND SOMEONE"
      },
      heroSlide3: {
        title: (
          <>
            <span style={{ color: brandBlue }}>Smarter</span><br />
            <span style={{ color: brandGreen }}>Search,</span>
            <span style={{ color: brandBlue }}>Safer</span><br />
            <span style={{ color: brandGreen }}>Recovery</span>
          </>
        ),
        description: "{returnName} is a smart platform that uses AI, QR codes, and IoT technology to help families quickly and safely reconnect with missing loved ones.",
        buttonText: "HOW IT WORKS"
      },

      // Key Features
      keyFeatures: "Key Features",
      aiSearch: "AI Search",
      qrNfc: "QR & NFC",
      geoAlerts: "Geo-alerts",
      lowCostBracelet: "Low-cost bracelet",

      // Categories
      categoriesWeSupport: "Categories We Support",
      categoriesSubtitle: "What Can {returnName} help recover?",

      // Real Impact
      realImpact: "Real Impact, Real Results",
      fasterIdentification: "Faster identification",
      instantGeoAlerts: "Instant geo-alerts",
      betterVerification: "Better verification",
      saferPrivacyFlow: "Safer privacy flow",
      before: "BEFORE",
      after: "AFTER",
      returnName: "RETURN",
      manualPosts: "• manual posts",
      slowVerification: "• slow verification",
      noNearbyAlerts: "• no nearby alerts",
      privacyRisk: "• privacy risk",
      aiMatchScan: "• AI match + scan",
      instantAlerts: "• instant alerts",
      secureHandover: "• secure handover",
      blindChat: "• blind chat",

      // How It Works
      step1Title: "1) Report / Scan",
      step1Description: "Reporter reports missing QR Finder scans DEVICE or uploads photo to start the recovery process.",
      step2Title: "2) AI Match + Geo Alerts",
      step2Description: "System searches database using AI, ranks matches by accuracy, and sends instant notifications to nearby areas.",
      step3Title: "3) Secure Handover",
      step3Description: "Secure communication through blind chat, identity verification process, confirmed delivery, and case closure.",

      // About
      aboutDescription1: "is a smart ecosystem that helps reconnect missing",
      aboutPeople: "people",
      aboutVehicles: "vehicles",
      aboutPets: "pets",
      aboutBelongings: "belongings",
      aboutDescription2: "with their owners",
      aboutDescription3: "through AI recognition, smart devices, and community collaboration. The platform enables users to report missing cases, search using intelligent tools, and securely connect with those who may have found them.",
      aboutDescription4: "Report a missing case or help someone you found — securely and fast.",
      reportMissing: "REPORT MISSING",
      iFoundSomeone: "I FOUND SOMEONE",

      // Footer
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
      stayUpToDate: "Stay up to date",
      emailPlaceholder: "Your email address",
      copyright: "Copyright © 2026\nAll rights reserved"
    },
    AR: {
      // Header
      home: "الرئيسية",
      categories: "الفئات",
      impacts: "التأثير",
      howItWorks: "كيف يعمل",
      about: "حول",
      login: "تسجيل الدخول",
      signUp: "إنشاء حساب",

      // Hero slides
      heroSlide1: {
        title: (
          <>
            <span style={{ color: brandBlue }}>خطوات بسيطة</span><br />
            <span style={{ color: brandGreen }}>تقنية </span>
            <span style={{ color: brandBlue }}>ذكية</span><br />
            <span style={{ color: brandBlue }}>لقاءات </span>
            <span style={{ color: brandGreen }}>آمنة</span>
          </>
        ),
        description: "من الإبلاغ عن الحالة إلى التسليم الآمن، يرشد {returnName} كل خطوة بمطابقة الذكاء الاصطناعي والتنبيهات الجغرافية والتواصل المُتحقق لإعادة توحيد العائلات بشكل أسرع.",
        buttonText: "الإبلاغ عن مفقود"
      },
      heroSlide2: {
        title: (
          <>
            <span style={{ color: brandBlue }}>كن </span>
            <span style={{ color: brandGreen }}>السبب</span><br />
            <span style={{ color: brandBlue }}>في عودة شخص</span><br />
            <span style={{ color: brandGreen }}>للمنزل</span>
          </>
        ),
        description: "إذا وجدت شخصاً قد يكون مفقوداً، ما عليك سوى مسح سوار الـ QR الخاص به أو التقاط صورة. نظام الذكاء الاصطناعي لدينا يتحقق من الهوية ويخطر عائلتهم فوراً وبأمان.",
        buttonText: "وجدت شخصاً"
      },
      heroSlide3: {
        title: (
          <>
            <span style={{ color: brandBlue }}>بحث أذكى</span><br />
            <span style={{ color: brandGreen }}>استرداد</span>
            <span style={{ color: brandBlue }}>أكثر أماناً</span><br />
            <span style={{ color: brandGreen }}></span>
          </>
        ),
        description: "{returnName} هو منصة ذكية تستخدم الذكاء الاصطناعي ورموز الـ QR وتقنية إنترنت الأشياء لمساعدة العائلات على إعادة الاتصال بسرعة وأمان مع أحبائهم المفقودين.",
        buttonText: "كيف يعمل"
      },

      // Key Features
      keyFeatures: "الميزات الرئيسية",
      aiSearch: "البحث بالذكاء الاصطناعي",
      qrNfc: "QR و NFC",
      geoAlerts: "التنبيهات الجغرافية",
      lowCostBracelet: "سوار منخفض التكلفة",

      // Categories
      categoriesWeSupport: "الفئات التي ندعمها",
      categoriesSubtitle: "ما الذي يمكن ل{returnName} استرداده؟",

      // Real Impact
      realImpact: "تأثير حقيقي، نتائج حقيقية",
      fasterIdentification: "تحديد هوية أسرع",
      instantGeoAlerts: "تنبيهات جغرافية فورية",
      betterVerification: "تحقق أفضل",
      saferPrivacyFlow: "تدفق خصوصية أكثر أماناً",
      before: "قبل",
      after: "بعد",
      returnName: "RETURN",
      manualPosts: "• منشورات يدوية",
      slowVerification: "• تحقق بطيء",
      noNearbyAlerts: "• لا توجد تنبيهات قريبة",
      privacyRisk: "• مخاطر الخصوصية",
      aiMatchScan: "• مطابقة ومسح بالذكاء الاصطناعي",
      instantAlerts: "• تنبيهات فورية",
      secureHandover: "• تسليم آمن",
      blindChat: "• دردشة مخفية",

      // How It Works
      step1Title: "١) الإبلاغ / المسح",
      step1Description: "المُبلِغ يُبلِغ عن المفقود أو واجد الـ QR يمسح الجهاز أو يرفع صورة لبدء عملية الاسترداد.",
      step2Title: "٢) مطابقة الذكاء الاصطناعي + التنبيهات الجغرافية",
      step2Description: "النظام يبحث في قاعدة البيانات باستخدام الذكاء الاصطناعي، يرتب المطابقات حسب الدقة، ويرسل إشعارات فورية للمناطق المجاورة.",
      step3Title: "٣) التسليم الآمن",
      step3Description: "تواصل آمن من خلال الدردشة المخفية، عملية التحقق من الهوية، التسليم المؤكد، وإغلاق القضية.",

      // About
      aboutDescription1: "هو نظام بيئي ذكي يساعد على إعادة ربط المفقودين",
      aboutPeople: "الأشخاص",
      aboutVehicles: "المركبات",
      aboutPets: "الحيوانات الأليفة",
      aboutBelongings: "المقتنيات",
      aboutDescription2: "بأصحابها",
      aboutDescription3: "من خلال التعرف بالذكاء الاصطناعي والأجهزة الذكية والتعاون المجتمعي. تمكن المنصة المستخدمين من الإبلاغ عن الحالات المفقودة والبحث باستخدام أدوات ذكية والاتصال بأمان مع من قد يكونوا قد وجدوهم.",
      aboutDescription4: "أبلغ عن حالة مفقودة أو ساعد شخصاً وجدته — بأمان وبسرعة.",
      reportMissing: "الإبلاغ عن مفقود",
      iFoundSomeone: "وجدت شخصاً",

      // Footer
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
      stayUpToDate: "ابق على اطلاع",
      emailPlaceholder: "عنوان بريدك الإلكتروني",
      copyright: "حقوق الطبع والنشر © ٢٠٢٦\nجميع الحقوق محفوظة"
    }
  };

  const t = translations[currentLanguage as keyof typeof translations];

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Hero slides data
  const heroSlides = [
    {
      id: 0,
      title: t.heroSlide1.title,
      description: t.heroSlide1.description.replace('{returnName}', t.returnName),
      buttonText: t.heroSlide1.buttonText,
      buttonColor: brandGreen,
      image: "/photos/11.png",
      onButtonClick: () => router.push('/sign-in')
    },
    {
      id: 1,
      title: t.heroSlide2.title,
      description: t.heroSlide2.description,
      buttonText: t.heroSlide2.buttonText,
      buttonColor: brandGreen,
      image: "/photos/6.png",
      onButtonClick: () => router.push('/sign-in')
    },
    {
      id: 2,
      title: t.heroSlide3.title,
      description: t.heroSlide3.description.replace('{returnName}', t.returnName),
      buttonText: t.heroSlide3.buttonText,
      buttonColor: brandGreen,
      image: "/photos/9.png",
      onButtonClick: () => scrollToSection('how-it-works')
    }
  ];

  // Auto-rotate slides every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="w-full min-h-screen bg-white overflow-x-hidden font-sans" dir={currentLanguage === 'AR' ? 'rtl' : 'ltr'}>

      {/* 1. Header (Navbar) */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:h-20 sm:gap-4 sm:px-6 lg:px-12">
          {/* Logo */}
          <div className="flex shrink-0 items-center">
            <Logo width={110} height={36} />
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8">
            <button onClick={() => scrollToSection('home')} className="text-[#60C10F] font-bold border-b-4 border-[#60C10F] pb-1">{t.home}</button>
            <button onClick={() => scrollToSection('categories')} className="text-gray-500 hover:text-[#014CB3] font-bold transition-colors">{t.categories}</button>
            <button onClick={() => scrollToSection('impacts')} className="text-gray-500 hover:text-[#014CB3] font-bold transition-colors">{t.impacts}</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-gray-500 hover:text-[#014CB3] font-bold transition-colors">{t.howItWorks}</button>
            <button onClick={() => scrollToSection('about')} className="text-gray-500 hover:text-[#014CB3] font-bold transition-colors">{t.about}</button>
          </nav>

          {/* Auth Buttons */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              className="h-10 rounded-xl border-[#014CB3] px-3 text-sm font-bold text-[#014CB3] hover:bg-[#014CB3] hover:text-white sm:h-12 sm:px-6 sm:text-base md:px-8 md:text-lg"
              onClick={() => router.push('/login')}
            >
              {t.login}
            </Button>
            <Button
              className="h-10 rounded-xl bg-[#60C10F] px-3 text-sm font-bold text-white shadow-lg hover:bg-[#60C10F]/90 sm:h-12 sm:px-6 sm:text-base md:px-8 md:text-lg"
              onClick={() => router.push('/sign-in')}
            >
              {t.signUp}
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section with Slider */}
      <section id="home" className="relative w-full overflow-hidden bg-white py-8 sm:py-12 lg:py-20">
        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12">

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 transform items-center justify-center rounded-full bg-white/80 text-xl shadow-lg transition-colors hover:bg-white sm:left-4 sm:h-12 sm:w-12 sm:text-2xl"
          >
            ‹
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 transform items-center justify-center rounded-full bg-white/80 text-xl shadow-lg transition-colors hover:bg-white sm:right-4 sm:h-12 sm:w-12 sm:text-2xl"
          >
            ›
          </button>

          {/* Slides */}
          <div className="relative min-h-[520px] sm:min-h-[560px] lg:h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="absolute inset-0 grid items-center gap-6 px-8 sm:gap-8 sm:px-10 lg:grid-cols-2 lg:gap-10 lg:px-0"
              >
                {/* Text Content */}
                <div className="z-10 order-2 space-y-4 sm:space-y-6 lg:order-1">
                  <h1 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
                    {heroSlides[currentSlide].title}
                  </h1>
                  <p className="mb-6 max-w-xl text-base font-semibold leading-relaxed text-gray-600 sm:mb-8 sm:text-lg md:text-xl lg:text-2xl">
                    {heroSlides[currentSlide].description}
                  </p>
                  <Button
                    className="h-12 w-full rounded-2xl border-0 px-6 text-base font-black uppercase text-white shadow-2xl transition-all duration-300 hover:scale-105 sm:h-14 sm:w-auto sm:px-10 sm:text-lg md:h-16 md:px-12 md:text-xl"
                    style={{
                      backgroundColor: heroSlides[currentSlide].buttonColor,
                      color: 'white',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}
                    onClick={heroSlides[currentSlide].onButtonClick}
                  >
                    {heroSlides[currentSlide].buttonText}
                  </Button>
                </div>

                {/* Hero Illustration */}
                <div className="relative order-1 flex justify-center lg:order-2">
                  <Image
                    src={heroSlides[currentSlide].image}
                    alt="Hero Illustration"
                    width={750}
                    height={600}
                    className="h-auto w-full max-w-[280px] object-contain sm:max-w-md lg:max-w-none"
                    priority
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentSlide ? 'bg-[#014CB3]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Key Features Section */}
      <section className="w-full py-10 sm:py-16 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#58595D] mb-8 sm:mb-12">{t.keyFeatures}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
            <FeatureItem img="14.png" title={t.aiSearch} />
            <FeatureItem img="10.png" title={t.qrNfc} />
            <FeatureItem img="7.png" title={t.geoAlerts} />
            <FeatureItem img="5.png" title={t.lowCostBracelet} />
          </div>
        </div>
      </section>

      {/* 4. Categories We Support Section */}
      <section id="categories" className="w-full py-10 sm:py-16 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#58595D] mb-2">{t.categoriesWeSupport}</h2>
          <p className="text-base sm:text-lg text-gray-500 font-bold mb-8 sm:mb-10">{t.categoriesSubtitle.replace('{returnName}', t.returnName)}</p>

          <div className="flex justify-center">
            <Image
              src="/photos/2.png"
              alt="Categories We Support"
              width={800}
              height={600}
              className="w-full max-w-4xl h-auto object-contain"
            />
          </div>
        </div>
      </section>

      {/* 5. Real Impact Section */}
      <section id="impacts" className="w-full py-10 sm:py-16 bg-[#F3F4F6]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
           <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#58595D] mb-8 sm:mb-12">{t.realImpact}</h2>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                 <StatCard value="3X" label={t.fasterIdentification} color="#014CB3" />
                 <StatCard value="5KM" label={t.instantGeoAlerts} color="#60C10F" />
                 <StatCard value="+40%" label={t.betterVerification} color="#014CB3" />
                 <StatCard value="100%" label={t.saferPrivacyFlow} color="#60C10F" />
              </div>
              <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                 <div className="flex flex-col gap-3 sm:flex-row sm:justify-between text-lg sm:text-2xl font-black mb-6 sm:mb-8 px-1 sm:px-4">
                    <span>{t.before}</span>
                    <span className="break-words">{t.after}(<span style={{color: "#014CB3"}}>{t.returnName}</span>)</span>
                 </div>
                 <div className="flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start px-1 sm:px-4">
                    <ul className="space-y-3 sm:space-y-4 text-gray-500 font-bold text-sm sm:text-lg">
                       <li>{t.manualPosts}</li>
                       <li>{t.slowVerification}</li>
                       <li>{t.noNearbyAlerts}</li>
                       <li>{t.privacyRisk}</li>
                    </ul>
                    <ul className="space-y-3 sm:space-y-4 text-gray-700 font-bold text-sm sm:text-lg sm:text-right">
                       <li>{t.aiMatchScan}</li>
                       <li>{t.instantAlerts}</li>
                       <li>{t.secureHandover}</li>
                       <li>{t.blindChat}</li>
                    </ul>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 6. How It Works Section */}
      <section id="how-it-works" className="w-full py-12 sm:py-20 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#58595D] mb-10 sm:mb-16 text-center">{t.howItWorks}</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {/* Step 1 Card */}
            <div className="bg-[#87CEEB] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 text-center text-white">
              <h3 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 text-[#014CB3]">{t.step1Title}</h3>
              <div className="mb-6 flex justify-center">
                <Image
                  src="/photos/4.png"
                  alt="Report Scan Process"
                  width={200}
                  height={150}
                  className="object-contain rounded-xl"
                />
              </div>
              <p className="text-base sm:text-lg font-semibold leading-relaxed text-gray-700">
                {t.step1Description}
              </p>
            </div>

            {/* Step 2 Card */}
            <div className="bg-[#90EE90] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 text-center text-white">
              <h3 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 text-[#2F7D32]">{t.step2Title}</h3>
              <div className="mb-6 flex justify-center">
                <Image
                  src="/photos/3.png"
                  alt="AI Match Process"
                  width={200}
                  height={150}
                  className="object-contain rounded-xl"
                />
              </div>
              <p className="text-base sm:text-lg font-semibold leading-relaxed text-gray-700">
                {t.step2Description}
              </p>
            </div>

            {/* Step 3 Card */}
            <div className="bg-[#87CEEB] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 text-center text-white md:col-span-2 lg:col-span-1">
              <h3 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 text-[#014CB3]">{t.step3Title}</h3>
              <div className="mb-6 flex justify-center">
                <Image
                  src="/photos/13.png"
                  alt="Secure Handover Process"
                  width={200}
                  height={150}
                  className="object-contain rounded-xl"
                />
              </div>
              <p className="text-base sm:text-lg font-semibold leading-relaxed text-gray-700">
                {t.step3Description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. About Section */}
      <section id="about" className="w-full py-12 sm:py-20 bg-white">
         <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#58595D] mb-6 sm:mb-8">{t.about}</h2>
            <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 text-center">
               <p className="text-lg sm:text-xl md:text-2xl leading-relaxed font-bold text-gray-800">
                 <span className="text-[#014CB3] font-black">{t.returnName}</span> {t.aboutDescription1} <span className="text-[#60C10F]">{t.aboutPeople}</span>{currentLanguage === 'AR' ? '، ' : ', '}<span className="text-[#60C10F]">{t.aboutVehicles}</span>{currentLanguage === 'AR' ? '، ' : ', '}<span className="text-[#60C10F]">{t.aboutPets}</span>{currentLanguage === 'AR' ? '، و' : ', and '} <span className="text-[#60C10F]">{t.aboutBelongings}</span> {t.aboutDescription2}
               </p>
               <p className="text-base sm:text-lg md:text-xl font-bold text-gray-700 leading-relaxed">
                 {t.aboutDescription3}
               </p>
               <p className="text-sm sm:text-base md:text-lg text-gray-500 font-medium leading-relaxed">
                 {t.aboutDescription4}
               </p>
               <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-2">
                  <Button
                    className="bg-[#014CB3] hover:bg-[#014CB3]/90 h-12 sm:h-14 w-full sm:w-auto px-8 sm:px-10 text-base sm:text-lg font-black rounded-2xl shadow-lg text-white"
                    onClick={() => router.push('/sign-in')}
                  >
                    {t.reportMissing}
                  </Button>
                  <Button
                    className="bg-[#60C10F] hover:bg-[#60C10F]/90 h-12 sm:h-14 w-full sm:w-auto px-8 sm:px-10 text-base sm:text-lg font-black rounded-2xl shadow-lg text-white"
                    onClick={() => router.push('/sign-in')}
                  >
                    {t.iFoundSomeone}
                  </Button>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="w-full pt-10 sm:pt-16" style={{ background: `linear-gradient(to right, ${brandBlue}, ${brandGreen})` }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pb-8 sm:pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-12">
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

            {/* Stay up to date */}
            <div className="space-y-4">
              <h4 className="text-xl font-black mb-6 text-white">{t.stayUpToDate}</h4>
              <div className="relative flex items-center bg-white/20 rounded-xl border border-white/30">
                <input
                  type="email"
                  placeholder={t.emailPlaceholder}
                  className="w-full bg-transparent py-3 ps-12 pe-4 text-white placeholder:text-white/60 focus:outline-none font-semibold rounded-xl"
                />
                <button className="absolute inset-inline-start-3 top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white transition-colors">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={currentLanguage === 'EN' ? '-scale-x-100' : ''}
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Feature Item Component */
function FeatureItem({ img, title }: { img: string, title: string }) {
  return (
    <div className="flex flex-col items-center text-center group cursor-pointer">
      <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 mb-4 sm:mb-6 flex items-center justify-center bg-white rounded-[32px] sm:rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] group-hover:shadow-xl transition-all duration-300">
        <Image src={`/photos/${img}`} alt={title} width={160} height={160} className="h-auto w-24 sm:w-32 md:w-40 object-contain" />
      </div>
      <h3 className="text-lg sm:text-xl md:text-2xl font-black text-[#58595D] px-2">{title}</h3>
    </div>
  );
}

/** Stat Card Component */
function StatCard({ value, label, color }: { value: string, label: string, color: string }) {
  return (
    <div className="rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 text-white flex flex-col items-center justify-center text-center hover:scale-105 transition-transform min-h-[100px]" style={{ backgroundColor: color }}>
       <span className="text-2xl sm:text-3xl font-black mb-1">{value}</span>
       <span className="text-xs sm:text-sm font-bold opacity-90 leading-snug">{label}</span>
    </div>
  );
}