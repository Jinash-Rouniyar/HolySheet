import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Celina - The AI Sheets Editor',
  description:
    'Celina is an AI-powered agent for spreadsheets that plans, edits, formats and charts your data through natural language.',
  authors: [{ name: 'Celina AI' }],
  openGraph: {
    title: 'Celina - AI Assistant for Spreadsheets',
    description:
      'Transform your spreadsheet experience with an agentic AI that reads, plans and edits your workbook.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
