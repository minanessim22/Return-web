'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function LegalPage() {
  return (
    <InternalPageLayout title="Legal">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            RETURN operates with a commitment to legal compliance and ethical standards across all jurisdictions where our services are available. We take seriously our responsibilities regarding data protection, user safety, and regulatory adherence. Our platform is designed with privacy-by-design principles and implements industry-standard security measures.
          </p>

          <p className="text-xl">
            We work closely with legal experts, community safety organizations, and regulatory bodies to ensure our services meet or exceed applicable requirements. This includes compliance with data protection regulations, consumer protection laws, and standards for platforms facilitating interpersonal connections. Our practices are regularly reviewed and updated to reflect evolving legal landscapes.
          </p>

          <p className="text-xl">
            Detailed legal documentation, including jurisdiction-specific compliance statements, liability disclaimers, intellectual property notices, and regulatory certifications, will be made available in this section soon. For legal inquiries or concerns, formal channels for communication will be established as our operations expand.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          <div className="p-8 bg-white border-2 border-[#014CB3]/20 rounded-2xl">
            <div className="w-12 h-12 bg-[#014CB3] rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#014CB3] mb-3">Data Protection</h3>
            <p className="text-gray-600 leading-relaxed">
              Compliance with GDPR, CCPA, and other international data protection regulations. User data is encrypted, securely stored, and never sold to third parties.
            </p>
          </div>

          <div className="p-8 bg-white border-2 border-[#60C10F]/20 rounded-2xl">
            <div className="w-12 h-12 bg-[#60C10F] rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#60C10F] mb-3">Regulatory Compliance</h3>
            <p className="text-gray-600 leading-relaxed">
              Adherence to consumer protection laws, platform service regulations, and standards for technology facilitating community safety and interpersonal connections.
            </p>
          </div>

          <div className="p-8 bg-white border-2 border-[#014CB3]/20 rounded-2xl">
            <div className="w-12 h-12 bg-[#014CB3] rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#014CB3] mb-3">Intellectual Property</h3>
            <p className="text-gray-600 leading-relaxed">
              All platform technology, branding, and content are protected by copyright and trademark laws. User-generated content remains the property of users, with limited license granted to RETURN.
            </p>
          </div>

          <div className="p-8 bg-white border-2 border-[#60C10F]/20 rounded-2xl">
            <div className="w-12 h-12 bg-[#60C10F] rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#60C10F] mb-3">Legal Documentation</h3>
            <p className="text-gray-600 leading-relaxed">
              Comprehensive legal agreements, disclaimers, and jurisdiction-specific notices will be published as operations expand. Contact us for specific legal inquiries.
            </p>
          </div>
        </div>

        <div className="mt-12 p-8 bg-gray-50 rounded-2xl border border-gray-200">
          <h3 className="text-2xl font-black text-[#58595D] mb-4 text-center">Legal Inquiries</h3>
          <p className="text-center text-gray-600">
            For formal legal inquiries, subpoenas, or compliance requests, dedicated contact channels will be established soon. We maintain strict protocols for responding to legal requests while protecting user privacy.
          </p>
        </div>
      </div>
    </InternalPageLayout>
  );
}
