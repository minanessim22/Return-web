'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function PricingPage() {
  return (
    <InternalPageLayout title="Pricing">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            RETURN is built on the principle that safety and reunion services should be accessible to everyone. We&apos;re designing pricing plans that balance affordability with sustainability, ensuring that our platform remains available to individuals, families, and organizations of all sizes.
          </p>

          <p className="text-xl">
            Our service model includes options for personal use, family plans, and community partnerships. Whether you&apos;re looking to protect a single loved one or outfit an entire care facility with tracking devices, we&apos;re developing flexible solutions that fit diverse needs and budgets. Detailed pricing tiers, package comparisons, and subscription options will be published soon.
          </p>

          <p className="text-xl">
            We believe in transparency and value. As we finalize our pricing structure, we&apos;re committed to offering clear, straightforward plans with no hidden fees. Stay tuned for comprehensive pricing information, special launch offers, and options designed to make RETURN accessible to those who need it most.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          <div className="p-8 bg-white border-2 border-gray-200 rounded-2xl hover:shadow-xl transition-all">
            <h3 className="text-2xl font-black text-[#58595D] mb-4">Personal</h3>
            <div className="mb-6">
              <span className="text-5xl font-black text-[#014CB3]">—</span>
            </div>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Individual protection</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Basic QR device</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>AI matching</span>
              </li>
            </ul>
            <div className="mt-6 text-sm text-gray-500 italic">Pricing details coming soon</div>
          </div>

          <div className="p-8 bg-gradient-to-br from-[#014CB3] to-[#60C10F] text-white rounded-2xl shadow-2xl transform scale-105">
            <h3 className="text-2xl font-black mb-4">Family</h3>
            <div className="mb-6">
              <span className="text-5xl font-black">—</span>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="font-bold mr-2">✓</span>
                <span>Multiple profiles</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">✓</span>
                <span>Priority alerts</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">✓</span>
                <span>Premium support</span>
              </li>
            </ul>
            <div className="mt-6 text-sm italic opacity-90">Pricing details coming soon</div>
          </div>

          <div className="p-8 bg-white border-2 border-gray-200 rounded-2xl hover:shadow-xl transition-all">
            <h3 className="text-2xl font-black text-[#58595D] mb-4">Enterprise</h3>
            <div className="mb-6">
              <span className="text-5xl font-black text-[#60C10F]">—</span>
            </div>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Unlimited devices</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Custom integration</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#60C10F] font-bold mr-2">✓</span>
                <span>Dedicated support</span>
              </li>
            </ul>
            <div className="mt-6 text-sm text-gray-500 italic">Pricing details coming soon</div>
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}
