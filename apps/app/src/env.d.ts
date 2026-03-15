/// <reference path="../.astro/types.d.ts" />

declare module 'ua-parser-js' {
  export class UAParser {
    constructor(userAgent?: string);
    getBrowser(): { name?: string; version?: string };
    getDevice(): { type?: string; vendor?: string };
    getOS(): { name?: string };
  }
}

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration) => void;
    onRegisterError?: (error: unknown) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}
