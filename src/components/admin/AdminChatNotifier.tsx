import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { subscribeAllSessions, type ChatSessionMeta } from '../../services/chatSessionService';
import { playNewSessionSound, playAdminMessageSound } from '../../utils/chatSounds';

interface NotificationItem {
  sessionId: string;
  kind: 'new' | 'reply';
  message: string;
  ts: number;
}

interface Props {
  onJumpToSession: (sessionId: string) => void;
}

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS = 15000;

/**
 * AdminChatNotifier — qlobal (admin panelin bütün tab-larında görünür) toast +
 * səs bildirişi. Yeni söhbət başlayanda və ya mövcud söhbətə müştəri mesaj
 * yazanda çalır. Toast üzərinə klikləmə birbaşa AI Konsultant → Söhbətlər
 * bölməsində müvafiq söhbəti açır.
 */
const AdminChatNotifier: React.FC<Props> = ({ onJumpToSession }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const knownRef = useRef<Map<string, number>>(new Map()); // sessionId → userMessageCount
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    const unsub = subscribeAllSessions((all) => {
      if (isFirstLoadRef.current) {
        all.forEach((s) => knownRef.current.set(s.id, s.userMessageCount || 0));
        isFirstLoadRef.current = false;
        return;
      }
      const fresh: NotificationItem[] = [];
      all.forEach((s: ChatSessionMeta) => {
        const prev = knownRef.current.get(s.id);
        const currentCount = s.userMessageCount || 0;
        if (prev === undefined) {
          // Brand-new session
          if (currentCount > 0) {
            fresh.push({
              sessionId: s.id,
              kind: 'new',
              message: (s.lastMessage || '').slice(0, 80) || 'Yeni müştəri söhbəti başladı',
              ts: Date.now(),
            });
          }
          knownRef.current.set(s.id, currentCount);
        } else if (currentCount > prev) {
          // Existing session — new user message
          fresh.push({
            sessionId: s.id,
            kind: 'reply',
            message: (s.lastMessage || '').slice(0, 80) || 'Yeni müştəri mesajı',
            ts: Date.now(),
          });
          knownRef.current.set(s.id, currentCount);
        }
      });
      if (fresh.length > 0) {
        // Play appropriate sound (new session priority)
        if (fresh.some((f) => f.kind === 'new')) {
          playNewSessionSound();
        } else {
          playAdminMessageSound();
        }
        setItems((prev) => {
          // Dedupe by sessionId — replace older item with newer one
          const map = new Map<string, NotificationItem>();
          [...prev, ...fresh].forEach((n) => map.set(n.sessionId, n));
          return Array.from(map.values()).slice(-MAX_VISIBLE);
        });
      }
    });
    return () => unsub();
  }, []);

  // Auto-dismiss oldest items after timeout
  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((n) => now - n.ts < AUTO_DISMISS_MS));
    }, 2000);
    return () => clearTimeout(t);
  }, [items]);

  const dismiss = (sid: string) => setItems((prev) => prev.filter((n) => n.sessionId !== sid));

  const handleClick = (n: NotificationItem) => {
    onJumpToSession(n.sessionId);
    dismiss(n.sessionId);
  };

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none" data-testid="admin-chat-notifier">
      {items.map((n) => (
        <button
          key={n.sessionId + '-' + n.ts}
          type="button"
          onClick={() => handleClick(n)}
          className={`pointer-events-auto group text-white rounded-2xl shadow-2xl px-4 py-3.5 pr-11 flex items-center gap-3 text-left transition-all relative overflow-hidden dv-notif-slide ${
            n.kind === 'new'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/40 hover:from-emerald-600 hover:to-emerald-700'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30 hover:from-blue-600 hover:to-indigo-700'
          }`}
          data-testid={`admin-notif-${n.sessionId}`}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold leading-tight">
              {n.kind === 'new' ? 'Yeni söhbət başladı!' : 'Yeni müştəri mesajı'}
            </div>
            <div className="text-[11px] text-white/85 truncate mt-0.5">
              Müştəri {n.sessionId.slice(0, 6)} · {n.message}
            </div>
            <div className="text-[10px] text-white/75 mt-1 font-semibold underline underline-offset-2">
              Söhbətə qoşul →
            </div>
          </div>
          <span
            onClick={(e) => { e.stopPropagation(); dismiss(n.sessionId); }}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/25 cursor-pointer"
            aria-label="Bağla"
          >
            <X className="h-3.5 w-3.5" />
          </span>
          {/* Pulse indicator */}
          <span aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-70" />
        </button>
      ))}
      <style>{`
        @keyframes dvNotifSlide {
          from { transform: translateX(24px); opacity: 0 }
          to   { transform: translateX(0);    opacity: 1 }
        }
        .dv-notif-slide { animation: dvNotifSlide 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
};

export default AdminChatNotifier;
