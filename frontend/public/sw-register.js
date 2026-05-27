if ('serviceWorker' in navigator) {
  if (location.pathname.startsWith('/spoolbuddy')) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (regs.length > 0) {
        Promise.all([
          ...regs.map((r) => r.unregister()),
          caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))),
        ]).then(() => location.reload());
      }
    });
  } else {
    window.addEventListener('load', () => {
      console.log('[SW] Registering service worker…');
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered — scope:', registration.scope,
            '| installing:', registration.installing?.state,
            '| active:', registration.active?.state);
        })
        .catch((error) => {
          console.error('[SW] Registration FAILED:', error);
        });
    });
  }
}
