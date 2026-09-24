import html2canvas from 'html2canvas';

/** Viewport PNG for the agent's formatting audit. */
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
