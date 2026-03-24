/// <reference path="../.astro/types.d.ts" />

/**
 * Typed `actions` for `import { actions } from 'astro:actions'` in client code.
 * Astro normally generates this in `.astro/actions.d.ts` (gitignored); CI often
 * runs `tsc` without `astro sync`, so we mirror the shape from `src/actions`.
 */
declare module 'astro:actions' {
  type AppActions = typeof import('./actions/index')['server'];
  export const actions: AppActions;
}

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
