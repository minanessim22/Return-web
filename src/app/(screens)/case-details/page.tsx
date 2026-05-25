import { Suspense } from 'react';

import CaseDetailsContent from './CaseDetailsContent';

export default function CaseDetailsPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-[#014CB3] text-white flex items-center justify-center font-bold text-xl">
          Loading case data...
        </div>
      )}
    >
      <CaseDetailsContent />
    </Suspense>
  );
}
