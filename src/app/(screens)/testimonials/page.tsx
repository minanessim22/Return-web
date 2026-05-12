'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function TestimonialsPage() {
  return (
    <InternalPageLayout title="Testimonials">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed mb-12">
          <p className="text-xl text-center">
            Real stories from real people who&apos;ve experienced the power of community-driven technology. These testimonials represent genuine experiences from early adopters who&apos;ve witnessed firsthand how RETURN is changing lives.
          </p>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-gradient-to-br from-[#014CB3]/5 to-white rounded-2xl border-l-4 border-[#014CB3] shadow-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-[#014CB3] rounded-full flex items-center justify-center text-white font-black text-2xl">
                S
              </div>
              <div>
                <h4 className="font-black text-xl text-[#014CB3]">Sarah M.</h4>
                <p className="text-gray-500 font-semibold">Early User</p>
              </div>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed italic">
              "When my mother wandered away from our home, I felt utterly helpless. RETURN's geo-alert system notified neighbors within minutes, and she was safely found within the hour. This technology gave us peace of mind we didn&apos;t think was possible."
            </p>
          </div>

          <div className="p-8 bg-gradient-to-br from-[#60C10F]/5 to-white rounded-2xl border-l-4 border-[#60C10F] shadow-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-[#60C10F] rounded-full flex items-center justify-center text-white font-black text-2xl">
                A
              </div>
              <div>
                <h4 className="font-black text-xl text-[#60C10F]">Ahmed K.</h4>
                <p className="text-gray-500 font-semibold">Community Member</p>
              </div>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed italic">
              "I found a bracelet with a QR code on an elderly gentleman who seemed confused at the bus station. One scan, and his family was notified immediately. The blind chat feature let me coordinate without sharing personal information. RETURN made helping someone so simple and safe."
            </p>
          </div>

          <div className="p-8 bg-gradient-to-br from-[#014CB3]/5 to-white rounded-2xl border-l-4 border-[#014CB3] shadow-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-[#014CB3] rounded-full flex items-center justify-center text-white font-black text-2xl">
                J
              </div>
              <div>
                <h4 className="font-black text-xl text-[#014CB3]">Jennifer L.</h4>
                <p className="text-gray-500 font-semibold">Animal Welfare Professional</p>
              </div>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed italic">
              "As a shelter coordinator, RETURN has transformed how we handle lost pet cases. The AI matching system connects found animals with their families faster than any method we&apos;ve used before. It&apos;s not just technology—it&apos;s hope delivered."
            </p>
          </div>
        </div>

        <div className="mt-12 p-8 bg-gradient-to-r from-[#014CB3]/10 to-[#60C10F]/10 rounded-2xl text-center">
          <h3 className="text-2xl font-black text-[#58595D] mb-4">Join Our Community</h3>
          <p className="text-lg text-gray-600 mb-4">
            More success stories are being collected from our growing community. We'll continue sharing verified stories that highlight the impact of compassionate technology and community action.
          </p>
          <p className="text-sm text-gray-500 italic">Have a story to share? Contact us to be featured.</p>
        </div>
      </div>
    </InternalPageLayout>
  );
}
