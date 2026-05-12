'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function HelpPage() {
  return (
    <InternalPageLayout title="Help Center">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            Welcome to the RETURN Help Center. Getting started with our platform is simple: create an account, report a missing case or register a found item, and let our AI-powered matching system do the work. Our intuitive interface guides you through each step, from uploading photos to managing communications with verified users.
          </p>

          <p className="text-xl">
            For reporters, the process begins with providing clear details and images of the missing person or item. Our system then broadcasts geo-alerts to nearby users while searching our database for potential matches. If you&apos;ve found someone or something, scanning the QR device or uploading a photo initiates an instant search, and our verification protocols ensure safe, secure handovers.
          </p>

          <p className="text-xl">
            Common questions about account setup, device pairing, privacy settings, and communication features are addressed in our growing knowledge base. Comprehensive tutorials, video guides, and step-by-step instructions will be available soon. For immediate assistance, our platform includes contextual help prompts throughout your user journey.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-white border-2 border-[#014CB3]/20 rounded-xl hover:border-[#014CB3] transition-colors">
            <h3 className="text-xl font-black text-[#014CB3] mb-3 flex items-center">
              <span className="w-8 h-8 bg-[#014CB3] rounded-full flex items-center justify-center text-white text-sm mr-3">1</span>
              Getting Started
            </h3>
            <p className="text-gray-600">Create your account and set up your profile with essential information</p>
          </div>

          <div className="p-6 bg-white border-2 border-[#60C10F]/20 rounded-xl hover:border-[#60C10F] transition-colors">
            <h3 className="text-xl font-black text-[#60C10F] mb-3 flex items-center">
              <span className="w-8 h-8 bg-[#60C10F] rounded-full flex items-center justify-center text-white text-sm mr-3">2</span>
              Reporting Missing
            </h3>
            <p className="text-gray-600">Learn how to file a missing report with photos and detailed descriptions</p>
          </div>

          <div className="p-6 bg-white border-2 border-[#014CB3]/20 rounded-xl hover:border-[#014CB3] transition-colors">
            <h3 className="text-xl font-black text-[#014CB3] mb-3 flex items-center">
              <span className="w-8 h-8 bg-[#014CB3] rounded-full flex items-center justify-center text-white text-sm mr-3">3</span>
              Found Someone/Something
            </h3>
            <p className="text-gray-600">Scan QR codes or upload photos to match found items with owners</p>
          </div>

          <div className="p-6 bg-white border-2 border-[#60C10F]/20 rounded-xl hover:border-[#60C10F] transition-colors">
            <h3 className="text-xl font-black text-[#60C10F] mb-3 flex items-center">
              <span className="w-8 h-8 bg-[#60C10F] rounded-full flex items-center justify-center text-white text-sm mr-3">4</span>
              Secure Communication
            </h3>
            <p className="text-gray-600">Use blind chat to connect safely while protecting your privacy</p>
          </div>

          <div className="p-6 bg-white border-2 border-[#014CB3]/20 rounded-xl hover:border-[#014CB3] transition-colors">
            <h3 className="text-xl font-black text-[#014CB3] mb-3 flex items-center">
              <span className="w-8 h-8 bg-[#014CB3] rounded-full flex items-center justify-center text-white text-sm mr-3">5</span>
              QR Device Setup
            </h3>
            <p className="text-gray-600">Pair and configure your QR bracelet or NFC device</p>
          </div>

          <div className="p-6 bg-white border-2 border-[#60C10F]/20 rounded-xl hover:border-[#60C10F] transition-colors">
            <h3 className="text-xl font-black text-[#60C10F] mb-3 flex items-center">
              <span className="w-8 h-8 bg-[#60C10F] rounded-full flex items-center justify-center text-white text-sm mr-3">6</span>
              Troubleshooting
            </h3>
            <p className="text-gray-600">Common issues and solutions for optimal platform use</p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-gradient-to-r from-[#014CB3]/10 to-[#60C10F]/10 rounded-xl">
          <p className="text-center text-gray-600 font-semibold">
            Detailed guides and video tutorials will be available soon. For urgent support, please contact us directly.
          </p>
        </div>
      </div>
    </InternalPageLayout>
  );
}
