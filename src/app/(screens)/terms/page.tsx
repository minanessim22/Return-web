'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function TermsPage() {
  return (
    <InternalPageLayout title="Terms of Service">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            By using RETURN, you agree to participate in our community responsibly and honor our commitment to safety, privacy, and respectful interaction. Our platform is designed to facilitate connections between those who&apos;ve lost something and those who can help, and we expect all users to engage honestly and with good intentions.
          </p>

          <p className="text-xl">
            Users are responsible for the accuracy of information they provide and must comply with local laws and regulations when reporting or responding to cases. RETURN serves as a facilitating platform and encourages users to follow proper verification procedures and involve appropriate authorities when necessary, particularly in cases involving vulnerable individuals.
          </p>

          <p className="text-xl">
            Our full Terms of Service, including detailed provisions regarding user conduct, liability limitations, dispute resolution, and account management, will be published soon. We&apos;re committed to creating a fair, transparent framework that protects both the community and the individuals we serve. By continuing to use our platform, you acknowledge your agreement to abide by these guidelines as they&apos;re finalized.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          <div className="p-6 border-l-4 border-[#014CB3] bg-[#014CB3]/5 rounded-r-xl">
            <h3 className="text-xl font-black text-[#014CB3] mb-3">User Responsibilities</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-[#014CB3] mr-2">•</span>
                <span>Provide accurate and truthful information when filing reports</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] mr-2">•</span>
                <span>Respect privacy and dignity of all individuals involved</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] mr-2">•</span>
                <span>Comply with local laws and involve authorities when appropriate</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#014CB3] mr-2">•</span>
                <span>Use the platform for legitimate recovery purposes only</span>
              </li>
            </ul>
          </div>

          <div className="p-6 border-l-4 border-[#60C10F] bg-[#60C10F]/5 rounded-r-xl">
            <h3 className="text-xl font-black text-[#60C10F] mb-3">Platform Guidelines</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-[#60C10F] mr-2">•</span>
                <span>Follow verification procedures before physical meetups</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] mr-2">•</span>
                <span>Report suspicious activity or misuse immediately</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] mr-2">•</span>
                <span>Maintain respectful communication in all interactions</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] mr-2">•</span>
                <span>Close cases promptly once reunions are completed</span>
              </li>
            </ul>
          </div>

          <div className="p-6 border-l-4 border-[#58595D] bg-gray-50 rounded-r-xl">
            <h3 className="text-xl font-black text-[#58595D] mb-3">Liability & Disclaimers</h3>
            <p className="text-gray-700">
              RETURN serves as a facilitating platform to connect users. While we employ advanced technology and security measures, users are responsible for their own safety and verification of identities. Detailed liability provisions and disclaimers will be included in the complete Terms of Service document.
            </p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-gradient-to-r from-[#014CB3]/10 to-[#60C10F]/10 rounded-xl text-center">
          <p className="text-gray-600 font-semibold">
            Complete Terms of Service documentation will be published soon. By using the platform, you agree to the principles outlined above.
          </p>
        </div>
      </div>
    </InternalPageLayout>
  );
}
