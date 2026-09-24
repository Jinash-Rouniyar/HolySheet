import { registerLicense } from '@syncfusion/ej2-base';

let registered = false;

/** Once, client-side. Key major version must match the installed @syncfusion/ej2-* packages. */
export function registerSyncfusionLicense(): void {
  if (registered) return;
  registered = true;
  const key = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE?.trim();
  if (key) {
    registerLicense(key);
  }
}
