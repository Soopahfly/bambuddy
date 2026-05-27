/**
 * PWA install-prompt capture — must be imported before React mounts.
 *
 * `beforeinstallprompt` fires once, shortly after the page `load` event.
 * `InstallAppButton` is buried inside `ProtectedRoute → Layout`, which is only
 * rendered after the auth API call resolves.  If the event fires during that
 * loading window the component-level `useEffect` listener doesn't exist yet
 * and the event is silently dropped.
 *
 * Importing this module in main.tsx (before `createRoot`) installs the global
 * listener synchronously so no event can ever be missed.  The captured prompt
 * is retrieved via `getPendingPrompt()` and re-broadcast via a custom event
 * for any component that mounts later.
 */

// The BeforeInstallPromptEvent is not in the standard TS DOM lib.
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Must match the breakpoint in InstallAppButton / useIsSidebarCompact.
const SIDEBAR_COMPACT_BREAKPOINT = 1144;

let _pendingPrompt: BeforeInstallPromptEvent | null = null;

/** Returns the most recently captured install prompt, or null. */
export function getPendingPrompt(): BeforeInstallPromptEvent | null {
  return _pendingPrompt;
}

/** Called by InstallAppButton after the prompt is consumed or dismissed. */
export function clearPendingPrompt(): void {
  _pendingPrompt = null;
}

// ── Diagnostic logging ────────────────────────────────────────────────────────
// Visible in Chrome DevTools (desktop remote-inspect or chrome://inspect).
// Helps diagnose why beforeinstallprompt may not fire.
console.log('[PWA] pwa.ts loaded — listening for beforeinstallprompt');
console.log('[PWA] viewport width:', window.innerWidth, '| standalone:', window.matchMedia('(display-mode: standalone)').matches);

window.addEventListener('load', () => {
  console.log('[PWA] page load event fired');

  // Report service worker registration state after load.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration('/').then((reg) => {
      if (reg) {
        console.log('[PWA] SW registration found — scope:', reg.scope, '| state:', reg.active?.state ?? 'no active worker');
      } else {
        console.warn('[PWA] No SW registration found for scope /');
      }
    });
  } else {
    console.warn('[PWA] navigator.serviceWorker not available');
  }

  // If beforeinstallprompt hasn't fired 5 s after load, log possible reasons.
  setTimeout(() => {
    if (!_pendingPrompt) {
      console.warn(
        '[PWA] beforeinstallprompt has not fired 5 s after load.\n' +
        '  Possible reasons:\n' +
        '  • Chrome install cooldown: Chrome suppresses the event for ~90 days after a\n' +
        '    dismissed prompt. Clearing site data does NOT reset this — it is stored in\n' +
        "    Chrome's own profile, not the site's storage.\n" +
        '    → To bypass on Android: open chrome://flags/#bypass-app-banner-engagement-checks\n' +
        "      set it to 'Enabled', relaunch Chrome, then reload this page.\n" +
        '  • PWA criteria not met: open DevTools → Issues panel (the badge next to the\n' +
        '    console filters) — Chrome lists the exact failing criteria there.\n' +
        '  • App already installed on this device (check Settings → Apps).\n' +
        '  • Running in incognito / unsupported browser.',
      );
    }
  }, 5000);
});

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('[PWA] beforeinstallprompt fired! platforms:', (e as BeforeInstallPromptEvent).platforms);

  // On desktop the sidebar install button is always visible, so suppress
  // Chrome's mini-infobar and use the button as the sole install trigger.
  // On mobile the button is buried inside the hamburger drawer, so let the
  // mini-infobar appear naturally as the primary prompt.
  if (window.innerWidth >= SIDEBAR_COMPACT_BREAKPOINT) {
    e.preventDefault();
    console.log('[PWA] desktop: e.preventDefault() called — sidebar button is the install trigger');
  } else {
    console.log('[PWA] mobile: mini-infobar will appear (e.preventDefault NOT called)');
  }

  _pendingPrompt = e as BeforeInstallPromptEvent;
  // Notify any already-mounted components (e.g. after an in-app uninstall
  // Chrome re-fires the event; we relay it via a custom event).
  window.dispatchEvent(
    new CustomEvent<BeforeInstallPromptEvent>('bambuddy:installprompt', { detail: _pendingPrompt }),
  );
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] appinstalled event fired — PWA has been installed');
  _pendingPrompt = null;
});
