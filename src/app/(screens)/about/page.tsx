'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function AboutPage() {
  return (
    <InternalPageLayout title="About Us">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            RETURN is a technology-driven platform dedicated to reuniting people with what matters most—whether that&apos;s a missing loved one, a lost pet, a misplaced vehicle, or valuable belongings. Our mission is to bridge the gap between those searching and those who can help, using advanced AI recognition, smart devices, and the power of community collaboration. We believe that everyone deserves a safe, efficient way to recover what's been lost.
          </p>

          <p className="text-xl">
            Our ecosystem combines cutting-edge technology with human compassion. Through QR-enabled devices, intelligent matching algorithms, and secure communication channels, we&apos;re transforming how communities respond to missing persons and lost property cases. RETURN empowers users to take immediate action while maintaining privacy, security, and dignity throughout the recovery process.
          </p>

          <p className="text-xl">
            As we continue to grow, we&apos;re committed to expanding our reach and refining our tools to serve communities worldwide. Our vision is a future where no one has to face the uncertainty of loss alone, and where technology serves as a bridge to bring families, pets, and belongings safely home.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-gradient-to-br from-[#014CB3]/10 to-[#60C10F]/10 rounded-2xl">
            <div className="text-4xl font-black text-[#014CB3] mb-2">Mission</div>
            <p className="text-gray-600 font-semibold">Reunite what's lost with advanced technology and community power</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-[#60C10F]/10 to-[#014CB3]/10 rounded-2xl">
            <div className="text-4xl font-black text-[#60C10F] mb-2">Vision</div>
            <p className="text-gray-600 font-semibold">A world where no one faces loss alone</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-[#014CB3]/10 to-[#60C10F]/10 rounded-2xl">
            <div className="text-4xl font-black text-[#014CB3] mb-2">Values</div>
            <p className="text-gray-600 font-semibold">Privacy, Security, Compassion, Innovation</p>
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}
