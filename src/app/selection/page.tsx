'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AdminQuickActions } from '@/components/admin/AdminQuickActions';
import { useAuth } from '@/components/providers/AuthProvider';
import { isAdminUser } from '@/lib/access';

export default function SelectionPage() {
  const [currentLanguage, setCurrentLanguage] = useState<'EN' | 'AR'>('EN');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('preferred-language');
      if (savedLanguage === 'EN' || savedLanguage === 'AR') {
        setCurrentLanguage(savedLanguage);
      }
    }
  }, []);

  const translations = {
    EN: {
      textBefore: 'I am using',
      textAfter: 'as:',
      lostButton: 'Some one who lost something',
      foundButton: 'Some one who found something'
    },
    AR: {
      textBefore: 'أنا أستخدم',
      textAfter: 'كـ:',
      lostButton: 'شخص فقد شيئاً',
      foundButton: 'شخص وجد شيئاً'
    }
  } as const;

  const t = translations[currentLanguage];
  const isRTL = currentLanguage === 'AR';

  const handleSelection = (type: 'lost' | 'found') => {
    router.push(type === 'lost' ? '/lost-dashboard' : '/found-dashboard');
  };

  return (
    <div className="w-full min-h-screen bg-white font-inter" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute top-6 left-1/2 z-10 -translate-x-1/2 transform sm:top-8">
        <Image src="/photos/8.png" alt="Return Logo" width={150} height={50} className="h-auto w-28 object-contain sm:w-[150px]" />
      </div>

      <div className="flex min-h-screen flex-col lg:flex-row">
        <div className="hidden w-1/2 items-center justify-center bg-white p-12 lg:flex">
          <div className="w-full max-w-lg">
            <Image
              src="/photos/12.png"
              alt="AI Tech Illustration"
              width={600}
              height={700}
              className="h-auto w-full object-contain"
              priority
            />
          </div>
        </div>

        <div className="flex w-full items-center justify-center p-4 pt-24 sm:p-6 sm:pt-32 lg:w-1/2 lg:p-12 lg:pt-12">
          <div className="w-full max-w-2xl rounded-3xl bg-gradient-to-b from-blue-100 to-green-100 p-5 text-center shadow-2xl sm:p-8 md:p-12 lg:p-16">
            {isAdminUser(user) ? (
              <div className="mb-6 text-left sm:mb-8">
                <AdminQuickActions locale={currentLanguage} compact />
              </div>
            ) : null}

            <div className="mb-8 mt-2 sm:mb-12 lg:mt-8">
              <h1 className="text-2xl font-bold leading-relaxed sm:text-3xl md:text-4xl">
                <span className="font-medium text-black">{t.textBefore} </span>
                <span className="font-black text-green-600">RETURN</span>
                <span className="font-medium text-black"> {t.textAfter}</span>
              </h1>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:gap-5 md:gap-6">
              <button
                onClick={() => handleSelection('lost')}
                className="flex-1 rounded-xl bg-blue-500 px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 sm:px-6 sm:py-4 sm:text-base"
              >
                {t.lostButton}
              </button>

              <button
                onClick={() => handleSelection('found')}
                className="flex-1 rounded-xl bg-green-500 px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-green-600 sm:px-6 sm:py-4 sm:text-base"
              >
                {t.foundButton}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
