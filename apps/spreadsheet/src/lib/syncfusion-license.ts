import { registerLicense } from '@syncfusion/ej2-base';

let registered = false;

/**
 * Register the Syncfusion community/enterprise license once, client-side.
 * CRA exposed only REACT_APP_* to the browser; under Next the equivalent is
 * NEXT_PUBLIC_*. The key major version must match the installed @syncfusion/ej2-*
 * packages (currently 28.x) or Syncfusion reports the key as invalid.
 */
export function registerSyncfusionLicense(): void {
  if (registered) return;
  registered = true;
  const key = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE?.trim();
  if (key) {
    registerLicense(key);
  }
}
