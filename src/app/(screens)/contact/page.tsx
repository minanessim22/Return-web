'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function ContactPage() {
  return (
    <InternalPageLayout title="Contact Us">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            We&apos;d love to hear from you. Whether you have questions about our services, need technical support, or want to share your experience with RETURN, our team is here to help. We value every connection and are committed to responding promptly to your inquiries.
          </p>

          <p className="text-xl">
            As we expand our operations, detailed contact information including office locations, phone numbers, and dedicated support channels will be made available soon. In the meantime, please feel free to reach out through our platform's messaging system or stay connected through our social media channels for updates and announcements.
          </p>

          <p className="text-xl">
            Your feedback helps us build a better service. We&apos;re constantly improving based on user experiences and community needs, so don&apos;t hesitate to share your thoughts, suggestions, or success stories with us.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          <div className="p-8 bg-white border-2 border-[#014CB3]/20 rounded-2xl hover:border-[#014CB3] transition-colors">
            <div className="w-12 h-12 bg-[#014CB3] rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#014CB3] mb-2">Email Support</h3>
            <p className="text-gray-600 font-semibold">Detailed contact information will be available soon</p>
          </div>

          <div className="p-8 bg-white border-2 border-[#60C10F]/20 rounded-2xl hover:border-[#60C10F] transition-colors">
            <div className="w-12 h-12 bg-[#60C10F] rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#60C10F] mb-2">Office Locations</h3>
            <p className="text-gray-600 font-semibold">Physical office details coming soon</p>
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}
