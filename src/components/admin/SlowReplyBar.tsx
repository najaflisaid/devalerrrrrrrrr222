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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { subscribeAllSessions, sessionShortCode, type ChatSessionMeta } from '../../services/chatSessionService';

const SLOW_THRESHOLD_MS = 60_000; // 60 saniyə
const AUTO_HIDE_MS = 10_000; // 10 saniyə sonra avtomatik itir

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
  const [visible, setVisible] = useState(false);
  const [batch, setBatch] = useState<{ session: ChatSessionMeta; waitedMs: number; key: string }[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());
  const hideTimerRef = useRef<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeAllSessions(setSessions);
    return () => unsub();
  }, []);

  // 5 saniyədə bir yenilə ki, 60s həddini keçən söhbətlər aşkarlansın.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  const pending = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => {
        if (s.closed) return false;
        if (s.lastRole !== 'user') return false;
        const lastMs = getMs((s as any).lastUserMessageAt) || getMs((s as any).lastActive);
        if (!lastMs) return false;
        return now - lastMs >= SLOW_THRESHOLD_MS;
      })
      .map((s) => {
        const lastMs = getMs((s as any).lastUserMessageAt) || getMs((s as any).lastActive);
        return { session: s, waitedMs: now - lastMs, key: `${s.id}:${lastMs}` };
      })
      .sort((a, b) => b.waitedMs - a.waitedMs);
  }, [sessions, tick]);

  // Yeni gözləyən söhbət yarananda bar-ı BİR DƏFƏ göstər, 10 saniyə sonra gizlət.
  // Eyni gözləyən söhbət təkrar-təkrar göstərilmir (yalnız yeni müştəri mesajı gələndə).
  useEffect(() => {
    if (visible) return;
    const hasNew = pending.some((p) => !notifiedRef.current.has(p.key));
    if (!hasNew) return;
    setBatch(pending);
    setVisible(true);
    pending.forEach((p) => notifiedRef.current.add(p.key));
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, [pending, visible]);

  // X — bütün gözləyən söhbətləri birdən bağlayır (bar tamamilə itir).
  const hideNow = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(false);
  };

  if (!visible || batch.length === 0) return null;

  const oldest = batch[0];
  const total = batch.length;
  const label = oldest.session.contactName || `#${sessionShortCode(oldest.session.id)}`;

  return (
    <div
      className="fixed top-[76px] sm:top-3 left-1/2 -translate-x-1/2 z-[9998] max-w-2xl w-[calc(100vw-24px)] dv-slow-reply-slide"
      data-testid="slow-reply-bar"
    >
      <button
        type="button"
        onClick={() => { onJumpToSession(oldest.session.id); hideNow(); }}
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
          onClick={(e) => { e.stopPropagation(); hideNow(); }}
          className="p-1.5 rounded-full hover:bg-white/25 cursor-pointer flex-shrink-0"
          aria-label="Bildirişi bağla"
          title="Bağla"
          data-testid="slow-reply-dismiss"
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
