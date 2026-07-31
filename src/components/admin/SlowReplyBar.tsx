/**
 * SlowReplyBar
 * ────────────
 * Qlobal, admin panelin hər səhifəsində görünən qırmızı xəbərdarlıq zolağı.
 * Müştəri sonuncu mesaj göndərəndən sonra 60 saniyədən artıq keçmişsə (və
 * admin/AI cavab verməyibsə) burada gözləyən sessiyaların sayı və ən köhnəsi
 * göstərilir. Kliklədikdə birbaşa Söhbətlər tabında həmin söhbətə keçir.
 *
 * Niyə transient toast yox? Toast 15 s sonra sönür — geciken müştəri ilə
 * satış itkisi çox real bir risk olduğu üçün, xəbərdarlıq problem aradan
 * qaldırılana qədər ekranda qalmalıdır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { subscribeAllSessions, sessionShortCode, type ChatSessionMeta } from '../../services/chatSessionService';

const SLOW_THRESHOLD_MS = 60_000; // 60 saniyə

interface Props {
  onJumpToSession: (sessionId: string) => void;
}

const getMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
};

const formatWait = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s < 90) return `${s} san`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} dəq ${r} san` : `${m} dəq`;
};

const SlowReplyBar: React.FC<Props> = ({ onJumpToSession }) => {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeAllSessions(setSessions);
    return () => unsub();
  }, []);

  // Re-render every 5 s so the countdown / auto-dismiss reasoning stays fresh.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const pending = useMemo(() => {
    const now = Date.now();
    // Səssiya "gözləyir" sayılır əgər:
    //  - lastRole = 'user' (sonuncu mesajı müştəri yazıb)
    //  - lastUserMessageAt yaşı > 60s
    //  - closed deyil
    //  - session dismiss edilməyib
    return sessions
      .filter((s) => {
        if (s.closed) return false;
        if (s.lastRole !== 'user') return false;
        if (dismissed.has(s.id)) return false;
        const lastMs = getMs((s as any).lastUserMessageAt) || getMs((s as any).lastActive);
        if (!lastMs) return false;
        return now - lastMs >= SLOW_THRESHOLD_MS;
      })
      .map((s) => ({
        session: s,
        waitedMs: now - (getMs((s as any).lastUserMessageAt) || getMs((s as any).lastActive)),
      }))
      .sort((a, b) => b.waitedMs - a.waitedMs);
  }, [sessions, dismissed]);

  if (pending.length === 0) return null;

  const oldest = pending[0];
  const total = pending.length;
  const label = oldest.session.contactName || `#${sessionShortCode(oldest.session.id)}`;

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9998] max-w-2xl w-[calc(100vw-24px)] dv-slow-reply-slide"
      data-testid="slow-reply-bar"
    >
      <button
        type="button"
        onClick={() => onJumpToSession(oldest.session.id)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white shadow-2xl shadow-red-500/40 border border-rose-400/40 hover:from-rose-700 hover:via-red-700 hover:to-rose-800 transition-colors text-left group"
      >
        <div className="relative w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-5 w-5" strokeWidth={2.3} />
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
            Gecikmiş cavab {total > 1 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">{total} söhbət</span>}
          </div>
          <div className="text-[13.5px] font-semibold leading-tight truncate">
            <span className="font-mono">{label}</span>{' '}
            <span className="opacity-90 font-normal">artıq</span>{' '}
            <span className="tabular-nums font-bold" data-testid="slow-reply-oldest-wait">{formatWait(oldest.waitedMs)}</span>{' '}
            <span className="opacity-90 font-normal">gözləyir — satışı itirməyin</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/15 flex-shrink-0">
          <Clock className="h-3 w-3" /> Söhbətə keç
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); setDismissed((prev) => new Set(prev).add(oldest.session.id)); }}
          className="p-1.5 rounded-full hover:bg-white/25 cursor-pointer flex-shrink-0"
          aria-label="Bu söhbəti gizlə"
          title="Bu söhbəti gizlə (növbəti müştəri mesajından sonra yenidən görünəcək)"
        >
          <X className="h-4 w-4" />
        </span>
      </button>
      <style>{`
        @keyframes dvSlowReplySlide {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to   { transform: translate(-50%, 0);      opacity: 1; }
        }
        .dv-slow-reply-slide { animation: dvSlowReplySlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
};

export default SlowReplyBar;
