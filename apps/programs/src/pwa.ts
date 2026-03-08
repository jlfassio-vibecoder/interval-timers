import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onOfflineReady() {
    if (import.meta.env.DEV) {
      console.warn('PWA ready to work offline');
    }
  },
});
