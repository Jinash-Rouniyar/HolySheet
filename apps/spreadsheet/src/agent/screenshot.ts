import html2canvas from 'html2canvas';

/**
 * Capture the Syncfusion spreadsheet viewport as a PNG data URL for the vision
 * formatting-audit loop. html2canvas rasterizes the live DOM; it is a
 * best-effort snapshot of what the user currently sees.
 */
export async function captureSpreadsheet(): Promise<string> {
  const el = document.querySelector('.e-spreadsheet') as HTMLElement | null;
  if (!el) throw new Error('Spreadsheet element not found for screenshot.');
  const canvas = await html2canvas(el, {
    scale: window.devicePixelRatio > 1 ? 1.5 : 1,
    logging: false,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  return canvas.toDataURL('image/png');
}
