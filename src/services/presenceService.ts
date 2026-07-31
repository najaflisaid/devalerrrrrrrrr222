/**
 * Live visitor presence tracker.
 *
 * Every browser tab writes a heartbeat doc into the `sitePresence` collection
 * every ~25 seconds while the tab is visible. Consumers (the admin analytics
 * dashboard) subscribe to the same collection and count docs whose `lastSeen`
 * is within the past 60 seconds — that's the number of live visitors.
 *
 * Design notes
 * ────────────
 * • We use a stable per-tab id kept in sessionStorage so refreshes reuse it
 *   and don't inflate counts.
 * • Heartbeat pauses when the tab is hidden (Page Visibility API) — this
 *   avoids counting people who left the site in a background tab.
 * • We do NOT rely on unload/beforeunload for cleanup (unreliable on mobile).
 *   Stale docs simply age out via the 60 s freshness window on the reader
 *   side.
 * • Occasional writes → cheap. 4 writes/min per active tab is well within
 *   Firestore free-tier limits for a boutique storefront.
 */

import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';

const COLLECTION = 'sitePresence';
const HEARTBEAT_INTERVAL_MS = 25_000;
export const PRESENCE_FRESHNESS_MS = 60_000; // consider a visitor live if lastSeen < 60s ago

const TAB_ID_KEY = 'dv_presence_tab_id';

const getTabId = (): string => {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const fresh = 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    sessionStorage.setItem(TAB_ID_KEY, fresh);
    return fresh;
  } catch {
    return 'p_' + Math.random().toString(36).slice(2, 10);
  }
};

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;

/**
 * Start (or resume) heartbeats for this tab. Idempotent — safe to call more
 * than once. Returns a stop function that cleans everything up.
 */
export const startPresenceHeartbeat = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const tabId = getTabId();
  const ref = doc(db, COLLECTION, tabId);

  const write = async () => {
    try {
      await setDoc(
        ref,
        {
          lastSeen: serverTimestamp(),
          path: (typeof location !== 'undefined' ? location.pathname : '') || '/',
          referrer: (typeof document !== 'undefined' ? document.referrer : '') || '',
          userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 200),
        },
        { merge: true }
      );
    } catch {
      /* offline / permission — silently ignore */
    }
  };

  const startIfVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (heartbeatTimer) return;
    void write();
    heartbeatTimer = setInterval(() => void write(), HEARTBEAT_INTERVAL_MS);
  };
  const stopIfHidden = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  startIfVisible();

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') startIfVisible();
    else stopIfHidden();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // Best-effort cleanup on unload — modern browsers may skip this.
  const unloadHandler = () => { void deleteDoc(ref); };
  window.addEventListener('pagehide', unloadHandler);

  return () => {
    stopIfHidden();
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    window.removeEventListener('pagehide', unloadHandler);
  };
};

export interface LiveVisitor {
  id: string;
  path: string;
  referrer?: string;
  userAgent?: string;
  lastSeenMs: number;
}

/**
 * Subscribe to the live visitor list. The callback receives ONLY docs
 * whose lastSeen is within `PRESENCE_FRESHNESS_MS`. A repeating timer
 * re-invokes the callback every 15 s so stale visitors drop off even
 * when Firestore has no pending updates.
 */
export const subscribeLiveVisitors = (
  cb: (visitors: LiveVisitor[]) => void
): (() => void) => {
  let lastRaw: LiveVisitor[] = [];
  const emitFiltered = () => {
    const now = Date.now();
    cb(lastRaw.filter((v) => v.lastSeenMs > 0 && now - v.lastSeenMs < PRESENCE_FRESHNESS_MS));
  };
  const unsub = onSnapshot(
    collection(db, COLLECTION),
    (snap) => {
      const list: LiveVisitor[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const ls = data?.lastSeen;
        const ms = typeof ls?.seconds === 'number' ? ls.seconds * 1000
          : typeof ls?.toMillis === 'function' ? ls.toMillis() : 0;
        list.push({
          id: d.id,
          path: data?.path || '/',
          referrer: data?.referrer || '',
          userAgent: data?.userAgent || '',
          lastSeenMs: ms,
        });
      });
      lastRaw = list;
      emitFiltered();
    },
    () => cb([])
  );
  const tick = setInterval(emitFiltered, 15_000);
  return () => { unsub(); clearInterval(tick); };
};
