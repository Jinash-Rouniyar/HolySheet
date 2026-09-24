'use client';

import dynamic from 'next/dynamic';

// Syncfusion touches window at import time.
const SpreadsheetWorkspace = dynamic(
  () => import('@/components/SpreadsheetWorkspace'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Loading Celina…
      </div>
    ),
  },
);

export default function AppPage() {
  return <SpreadsheetWorkspace />;
}
