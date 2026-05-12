'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function PrivacyPage() {
  return (
    <InternalPageLayout title="Privacy Policy">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            Your privacy is fundamental to everything we do at RETURN. We understand that the nature of our service involves sensitive personal information, and we&apos;ve built our platform with robust privacy protections at every level. We collect only the information necessary to facilitate reunions safely and effectively, and we never sell or share your data with third parties for marketing purposes.
          </p>

          <p className="text-xl">
            Our security infrastructure includes encrypted communications, secure data storage, and strict access controls. The "blind chat" feature exemplifies our privacy-first approach—allowing users to communicate anonymously until both parties feel comfortable sharing information. User data is protected by industry-leading security protocols, and all team members with data access undergo thorough background checks and privacy training.
          </p>

          <p className="text-xl">
            A comprehensive Privacy Policy detailing exactly what data we collect, how it&apos;s used, how long it&apos;s retained, and your rights regarding your personal information will be published soon. This will include specifics on data sharing (limited to verified matches and authorized authorities when legally required), cookie usage, and your options for controlling your information. We&apos;re committed to transparency and giving you full control over your digital footprint on our platform.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          <div className="p-6 bg-gradient-to-r from-[#014CB3]/10 to-[#014CB3]/5 rounded-xl border-l-4 border-[#014CB3]">
            <h3 className="text-xl font-black text-[#014CB3] mb-3">What We Collect</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Account information (name, email, contact details)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Case details (photos, descriptions, location data)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Communication records (for safety and verification)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Device information and usage analytics</span>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-gradient-to-r from-[#60C10F]/10 to-[#60C10F]/5 rounded-xl border-l-4 border-[#60C10F]">
            <h3 className="text-xl font-black text-[#60C10F] mb-3">How We Protect It</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>End-to-end encryption for all communications</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Secure cloud storage with access controls</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Regular security audits and penetration testing</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Staff training and background checks</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Privacy-by-design product development</span>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-gradient-to-r from-[#014CB3]/10 to-[#014CB3]/5 rounded-xl border-l-4 border-[#014CB3]">
            <h3 className="text-xl font-black text-[#014CB3] mb-3">Your Rights</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Access your personal data at any time</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Request corrections or deletions</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Opt out of non-essential data collection</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Export your data in portable formats</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] font-bold mr-2">•</span>
                <span>Withdraw consent for data processing</span>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-gradient-to-r from-[#60C10F]/10 to-[#60C10F]/5 rounded-xl border-l-4 border-[#60C10F]">
            <h3 className="text-xl font-black text-[#60C10F] mb-3">Data Sharing</h3>
            <p className="text-gray-700 mb-3">
              We share your data only in these limited circumstances:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">1.</span>
                <span>With verified matches to facilitate reunions</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">2.</span>
                <span>With law enforcement when legally required</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">3.</span>
                <span>With service providers under strict confidentiality agreements</span>
              </li>
            </ul>
            <p className="text-gray-700 mt-3 font-semibold">
              We NEVER sell your data to advertisers or third parties.
            </p>
          </div>
        </div>

        <div className="mt-12 p-8 bg-gradient-to-r from-[#014CB3]/10 to-[#60C10F]/10 rounded-xl text-center">
          <h3 className="text-2xl font-black text-[#58595D] mb-4">Complete Privacy Policy Coming Soon</h3>
          <p className="text-gray-600">
            Detailed documentation including data retention periods, cookie policies, international data transfers, and GDPR/CCPA compliance details will be published soon. We&apos;re committed to full transparency.
          </p>
        </div>
      </div>
    </InternalPageLayout>
  );
}
