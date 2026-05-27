'use client';

import { TrackingHistoryPanel } from '@/components/tracking/TrackingHistoryPanel';

const DEVICE_ID = 'colota01';

export default function TrackingHistoryPage() {
  return <TrackingHistoryPanel deviceId={DEVICE_ID} deviceLabel={DEVICE_ID} />;
}
