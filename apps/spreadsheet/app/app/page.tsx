'use client';

import dynamic from 'next/dynamic';

// Syncfusion touches `window`/`document` at import time and must never render on
// the server, so the whole workspace is loaded client-only.
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
