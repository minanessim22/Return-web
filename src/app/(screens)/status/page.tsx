'use client';

import { InternalPageLayout } from "@/components/layout/InternalPageLayout";

export default function StatusPage() {
  return (
    <InternalPageLayout title="System Status">
      <div className="prose prose-lg max-w-none">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className="text-xl">
            System reliability is critical when seconds count. The RETURN Status page will provide real-time monitoring of our platform&apos;s health, including API availability, mobile app performance, notification systems, and database responsiveness. This transparency ensures you always know the operational state of the services you depend on.
          </p>

          <p className="text-xl">
            When incidents occur, this page will serve as your primary source for updates, including issue identification, impact assessment, resolution progress, and post-mortem analysis. We&apos;re building monitoring infrastructure that tracks uptime, response times, and service quality across all components of our ecosystem.
          </p>

          <p className="text-xl">
            Our comprehensive Status dashboard, complete with historical data, scheduled maintenance notifications, and subscription options for status alerts, will be available soon. In the meantime, critical service announcements will be communicated through our primary platform and social media channels. We&apos;re committed to maintaining the highest standards of reliability and keeping our community informed.
          </p>
        </div>

        <div className="mt-12 p-8 bg-gradient-to-r from-[#60C10F]/20 to-[#60C10F]/10 rounded-2xl border-2 border-[#60C10F]">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-[#60C10F] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h3 className="text-3xl font-black text-[#60C10F] text-center mb-2">All Systems Operational</h3>
          <p className="text-center text-gray-600 font-semibold">Platform services are running smoothly</p>
        </div>

        <div className="mt-12 space-y-6">
          <h3 className="text-2xl font-black text-[#58595D]">Upcoming Features</h3>

          <div className="p-6 bg-[#014CB3]/5 rounded-xl border-l-4 border-[#014CB3]">
            <h4 className="text-lg font-black text-[#014CB3] mb-2">Real-Time Monitoring Dashboard</h4>
            <p className="text-gray-600">
              Live status updates, incident tracking, and historical uptime data will be available on this page soon.
            </p>
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}
