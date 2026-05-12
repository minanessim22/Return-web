'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function BlogPage() {
  return (
    <InternalPageLayout title="Blog">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            Welcome to the RETURN blog—your resource for safety tips, recovery success stories, and insights into how technology is changing the landscape of lost and found services. Here, we'll share practical advice on preventing loss, protecting loved ones, and making the most of our platform's features.
          </p>

          <p className="text-xl">
            Our community is at the heart of everything we do, and this space will celebrate the real people who&apos;ve made reunions possible. From heartwarming stories of pets returned home to practical guides on using QR devices effectively, we&apos;re building a knowledge base that empowers everyone to act quickly and confidently when it matters most.
          </p>

          <p className="text-xl">
            Stay tuned as we publish new content regularly. Whether you&apos;re a concerned parent, a pet owner, or someone who wants to be prepared, you'll find valuable insights here. Check back soon as we launch our first articles and begin sharing the stories that make RETURN more than just a platform—it&apos;s a community of hope.
          </p>
        </div>

        <div className="mt-12 p-8 bg-gradient-to-r from-[#014CB3]/5 to-[#60C10F]/5 rounded-2xl border-l-4 border-[#60C10F]">
          <h3 className="text-2xl font-black text-[#014CB3] mb-4">Coming Soon</h3>
          <ul className="space-y-3 text-lg text-gray-600">
            <li className="flex items-start">
              <span className="text-[#60C10F] font-bold mr-3">✓</span>
              <span>Safety tips for protecting vulnerable loved ones</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#60C10F] font-bold mr-3">✓</span>
              <span>Success stories from our community members</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#60C10F] font-bold mr-3">✓</span>
              <span>Technical guides on QR device setup and usage</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#60C10F] font-bold mr-3">✓</span>
              <span>Industry insights on AI-powered recovery systems</span>
            </li>
          </ul>
        </div>
      </div>
    </InternalPageLayout>
  );
}
