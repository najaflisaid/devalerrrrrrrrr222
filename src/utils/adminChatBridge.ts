/**
 * Shared cross-component signal for admin panel to open a specific chat session
 * inside `AiConsultantTab` → Söhbətlər sub-tab.
 *
 * Yaddaşda saxlanır (module-level) və event dispatch edilir, belə ki:
 *   1. AiConsultantTab hələ mount olmayıbsa (fərqli tab-dadır), sessionId
 *      module-level variable-də qalır və növbəti mount-da tətbiq olunur.
 *   2. AiConsultantTab artıq mount olubsa, custom event-i dinləyib dərhal
 *      söhbəti açır.
 */

const EVENT_NAME = 'dv:admin-open-session';

let pendingSessionId: string | null = null;

export const requestOpenChatSession = (sessionId: string) => {
  pendingSessionId = sessionId;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: sessionId }));
  } catch { /* ignore */ }
};

export const consumePendingChatSession = (): string | null => {
  const sid = pendingSessionId;
  pendingSessionId = null;
  return sid;
};

export const onOpenChatSession = (cb: (sessionId: string) => void): (() => void) => {
  const handler = (e: Event) => {
    const sid = (e as CustomEvent<string>).detail;
    if (sid) cb(sid);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
